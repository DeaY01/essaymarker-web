import { connection } from "next/server";
import { Suspense } from "react";
import { EssayMarker } from "@/components/essay-marker";
import { getAccountSummary } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";

/** Reads the session, so it streams in behind the Suspense boundary below. */
async function EssayMarkerForUser() {
  // Request-time from here on, before anything touches Supabase (same as AccountMenu).
  await connection();

  const user = await getCurrentUser();
  const account = user ? await getAccountSummary() : null;
  return (
    <EssayMarker
      authStatus={user ? "signed-in" : "signed-out"}
      credits={account ? account.credits : null}
    />
  );
}

export default function Home() {
  return (
    <main className="container">
      <div className="page-heading">
        <h1>Mark your handwritten essay like an examiner would</h1>
        <p>
          Write your essay on paper, just as in the exam, and upload a photo of
          each page. You’ll get a score out of 50, a breakdown across the four
          COEM criteria, line-by-line corrections, and clear next steps.
        </p>
      </div>

      <Suspense fallback={<EssayMarker authStatus="checking" />}>
        <EssayMarkerForUser />
      </Suspense>
    </main>
  );
}
