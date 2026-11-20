import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="It’s free. Get examiner-style marking for your handwritten essays."
    >
      <SignUpForm />
    </AuthCard>
  );
}
