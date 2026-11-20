"use client";

import { useActionState } from "react";
import { requestPayout, type PayoutState } from "@/app/(app)/partners/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/auth/form-fields";
import { formatNaira } from "@/lib/billing";

const INITIAL_STATE: PayoutState = { status: "idle" };

export function PayoutForm({ availableNaira }: { availableNaira: number }) {
  const [state, action] = useActionState(requestPayout, INITIAL_STATE);

  if (state.status === "submitted" && state.message) {
    return <FormMessage tone="success">{state.message}</FormMessage>;
  }

  return (
    <form action={action} className="auth-form payout-form" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <div className="payout-grid">
        <TextField
          label="Bank"
          name="bankName"
          autoComplete="off"
          placeholder="e.g. GTBank"
          required
          defaultValue={state.values?.bankName}
          error={state.fieldErrors?.bankName}
        />
        <TextField
          label="Account number"
          name="accountNumber"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="10 digits"
          required
          defaultValue={state.values?.accountNumber}
          error={state.fieldErrors?.accountNumber}
        />
      </div>
      <TextField
        label="Account name"
        name="accountName"
        autoComplete="name"
        required
        defaultValue={state.values?.accountName}
        error={state.fieldErrors?.accountName}
      />
      <SubmitButton pendingLabel="Requesting…">
        Request {formatNaira(availableNaira)} payout
      </SubmitButton>
    </form>
  );
}
