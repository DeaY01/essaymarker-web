import { NextResponse } from "next/server";
import { z } from "zod";
import { applyPaystackTransaction } from "@/lib/payments";
import {
  isValidWebhookSignature,
  PaystackNotConfiguredError,
  paystackTransactionSchema,
} from "@/lib/paystack";

/**
 * Paystack calls this after every charge. The signature proves the request
 * came from Paystack, so a successful charge is credited straight away.
 * Set the URL in Paystack: Settings → API Keys & Webhooks → Webhook URL
 *   https://<your-domain>/api/paystack/webhook
 */
export async function POST(request: Request) {
  // The signature covers the exact raw body, so read it before parsing.
  const rawBody = await request.text();

  try {
    if (!isValidWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof PaystackNotConfiguredError) {
      console.error(error.message);
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }
    throw error;
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Falls through to the "Malformed event" response below.
  }
  const event = z.object({ event: z.string(), data: z.unknown() }).safeParse(payload);
  if (!event.success) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  // Other events (transfers, subscriptions…) aren't used; acknowledge them.
  if (event.data.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const transaction = paystackTransactionSchema.safeParse(event.data.data);
  if (!transaction.success) {
    console.error("Paystack charge.success with unexpected shape:", transaction.error.message);
    return NextResponse.json({ error: "Malformed transaction" }, { status: 400 });
  }

  try {
    const outcome = await applyPaystackTransaction(transaction.data);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    // A 5xx makes Paystack retry later, which is what we want for a database hiccup.
    console.error("Failed to apply Paystack payment:", error);
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }
}
