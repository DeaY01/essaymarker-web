import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard title="Sign in to EssayMarker" subtitle="Welcome! Sign in to mark your essays and see your feedback.">
      <SignInForm />
    </AuthCard>
  );
}
