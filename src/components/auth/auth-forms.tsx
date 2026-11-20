"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/app/(auth)/actions";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/auth/form-fields";
import { CheckIcon, MailIcon } from "@/components/icons";
import { normaliseReferralCode, REFERRAL_PARAM } from "@/lib/referral";

const INITIAL_STATE: AuthFormState = { status: "idle" };

/** Reads `?next=` so the student returns to where they were after signing in. */
function useNextPath() {
  const next = useSearchParams().get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function withNext(path: string, next: string) {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

function CheckEmail({ message }: { message: string }) {
  return (
    <div className="auth-success">
      <span className="auth-success-icon" aria-hidden="true">
        <MailIcon size={22} />
      </span>
      <h2>Check your email</h2>
      <p role="status">{message}</p>
      <p className="auth-muted">
        Didn’t get it? Check your spam folder, or wait a minute and try again.
      </p>
    </div>
  );
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, INITIAL_STATE);
  const searchParams = useSearchParams();
  const next = useNextPath();
  const linkFailed = searchParams.get("error") === "link";

  return (
    <form action={action} className="auth-form" noValidate>
      <input type="hidden" name="next" value={next} />
      {linkFailed && state.status === "idle" && (
        <FormMessage tone="error">
          That link is invalid or has expired. Sign in, or request a new link.
        </FormMessage>
      )}
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
        labelAction={
          <Link className="text-link small" href="/forgot-password">
            Forgot password?
          </Link>
        }
      />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="auth-switch">
        New to EssayMarker?{" "}
        <Link className="text-link" href={withNext("/sign-up", next)}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, INITIAL_STATE);
  const next = useNextPath();
  const referralCode = normaliseReferralCode(useSearchParams().get(REFERRAL_PARAM));

  if (state.status === "success" && state.message) {
    return <CheckEmail message={state.message} />;
  }

  return (
    <form action={action} className="auth-form" noValidate>
      <input type="hidden" name="next" value={next} />
      {referralCode && (
        <p className="referral-note">
          <CheckIcon size={14} />
          Invited with code <strong>{referralCode}</strong>
        </p>
      )}
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="auth-switch">
        Already have an account?{" "}
        <Link className="text-link" href={withNext("/sign-in", next)}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL_STATE);

  if (state.status === "success" && state.message) {
    return <CheckEmail message={state.message} />;
  }

  return (
    <form action={action} className="auth-form" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending link…">Send reset link</SubmitButton>
      <p className="auth-switch">
        Remembered it?{" "}
        <Link className="text-link" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, INITIAL_STATE);

  return (
    <form action={action} className="auth-form" noValidate>
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}
