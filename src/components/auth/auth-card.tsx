import { Suspense, type ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-card-header">
        <h1 id="auth-title">{title}</h1>
        <p>{subtitle}</p>
      </div>
      {/* Forms read the URL (?next=, ?error=), which is request-time data. */}
      <Suspense fallback={<div className="auth-form-skeleton skeleton" aria-hidden="true" />}>
        {children}
      </Suspense>
    </section>
  );
}
