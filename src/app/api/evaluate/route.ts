import { NextResponse } from "next/server";
import { APICallError, NoObjectGeneratedError } from "ai";
import {
  evaluateHandwrittenEssay,
  EvaluationConfigError,
  type EssayPage,
  type MarkedEssayResponse,
} from "@/lib/ai/evaluate-essay";
import { BillingNotConfiguredError, refundUnit, reserveUnit } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { saveEvaluation } from "@/lib/essay-history";
import { MAX_PAGE_BYTES, MAX_PAGES } from "@/lib/essay-rules";
import { getSupabaseConfig, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/config";

// Reading and marking the photos is one model call; give the platform a
// ceiling longer than the evaluator's own timeout.
export const maxDuration = 120;

// Abuse guard: a full set of pages at the per-page limit, plus form overhead.
const MAX_BODY_BYTES = MAX_PAGES * MAX_PAGE_BYTES + 64 * 1024;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/** Identifies the image format from its leading bytes; never trust the declared type. */
function detectImageType(bytes: Uint8Array): EssayPage["mediaType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  return null;
}

export async function POST(request: Request) {
  // Marking uses a paid AI service, so only signed-in students may use it.
  if (!getSupabaseConfig()) {
    console.error(SUPABASE_NOT_CONFIGURED);
    return errorResponse("Accounts aren’t set up yet. Please try again later.", 503);
  }
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("Please sign in to get your essay marked.", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse("The photos are too large to upload. Please use smaller images.", 413);
  }

  // Essays are accepted only as photos of handwritten pages.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return errorResponse(
      "Only photos of a handwritten essay are accepted. Send them as multipart/form-data in a \"pages\" field.",
      415,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("The upload could not be read. Please try again.", 400);
  }

  const topicField = form.get("topic");
  const topic = typeof topicField === "string" ? topicField : "";

  const pages: EssayPage[] = [];
  for (const entry of form.getAll("pages")) {
    if (typeof entry === "string") {
      return errorResponse("Only photos of a handwritten essay are accepted.", 415);
    }
    if (entry.size > MAX_PAGE_BYTES) {
      return errorResponse(
        `Each photo must be smaller than ${Math.round(MAX_PAGE_BYTES / (1024 * 1024))} MB.`,
        413,
      );
    }
    const data = new Uint8Array(await entry.arrayBuffer());
    const mediaType = detectImageType(data);
    if (!mediaType) {
      return errorResponse("Each page must be a JPG or PNG photo.", 415);
    }
    pages.push({ data, mediaType });
  }

  // Charge one unit before the (paid) AI call. An upload with no pages is
  // scored 0 without calling the AI, so it is free.
  let unitReserved = false;
  let creditsRemaining: number | null = null;
  if (pages.length > 0) {
    try {
      creditsRemaining = await reserveUnit(user.id);
    } catch (error) {
      console.error(error instanceof BillingNotConfiguredError ? error.message : error);
      return errorResponse("Essay marking is not available right now. Please try again later.", 503);
    }
    if (creditsRemaining === null) {
      return errorResponse(
        "You have no units left. Buy units to keep getting your essays marked.",
        402,
      );
    }
    unitReserved = true;
  }

  try {
    const evaluation = await evaluateHandwrittenEssay(
      { topic, pages },
      { abortSignal: request.signal },
    );

    if (evaluation.needsResnap) {
      unitReserved = false;
      let refundedCredits: number | null;
      try {
        refundedCredits = await refundUnit(user.id);
      } catch (refundError) {
        console.error(`Failed to refund a unit after a resnap for user ${user.id}:`, refundError);
        return errorResponse(
          "The photos could not be read, and we couldn't confirm that your unit was returned. Please refresh your balance or contact support before trying again.",
          503,
        );
      }
      if (refundedCredits === null) {
        return errorResponse(
          "The photos could not be read, and we couldn't confirm that your unit was returned. Please refresh your balance or contact support before trying again.",
          503,
        );
      }

      const response: MarkedEssayResponse = {
        ...evaluation,
        savedReportId: null,
        creditsRemaining: refundedCredits,
      };
      return NextResponse.json(response);
    }

    // Marking succeeded, so the unit is spent. A failed save must not lose the
    // marking the student just waited for, so the report is returned either way.
    unitReserved = false;
    const savedReportId = await saveEvaluation(user.id, topic, evaluation);
    const response: MarkedEssayResponse = { ...evaluation, savedReportId, creditsRemaining };
    return NextResponse.json(response);
  } catch (error) {
    // Marking didn't complete, so the student isn't charged.
    let refundFailed = false;
    if (unitReserved) {
      unitReserved = false;
      try {
        refundFailed = (await refundUnit(user.id)) === null;
      } catch (refundError) {
        console.error(`Failed to refund a unit for user ${user.id}:`, refundError);
        refundFailed = true;
      }
    }

    if (request.signal.aborted) {
      // The client went away; nobody is listening for this response.
      return new Response(null, { status: 499 });
    }

    if (refundFailed) {
      return errorResponse(
        "Essay marking failed, and we couldn't confirm that your unit was returned. Please refresh your balance or contact support.",
        503,
      );
    }

    if (error instanceof EvaluationConfigError) {
      console.error(error.message);
      return errorResponse(
        "Essay marking is not configured yet. Please try again later.",
        503,
      );
    }

    if (isTimeoutError(error)) {
      return errorResponse(
        "The examiner took too long to respond. Please try again.",
        504,
      );
    }

    if (APICallError.isInstance(error) && error.statusCode === 429) {
      return errorResponse(
        "The examiner is busy right now. Please wait a moment and try again.",
        503,
      );
    }

    if (NoObjectGeneratedError.isInstance(error)) {
      console.error(
        "The AI response did not match the required schema:",
        error.cause ?? error,
      );
      return errorResponse(
        "The examiner returned an unreadable result. Please try again.",
        502,
      );
    }

    console.error("Failed to evaluate essay:", error);
    return errorResponse("Essay marking failed. Please try again.", 502);
  }
}
