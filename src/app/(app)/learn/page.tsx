import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn essay writing",
  description:
    "Video lessons on WAEC and NECO essay writing: letters, argumentative essays, speeches, grammar and more.",
};

export default function LearnPage() {
  return (
    <main className="container">
      <div className="page-heading">
        <h1>Learn essay writing</h1>
        <p>
          Video lessons to help you prepare for WAEC and NECO essay writing are
          coming soon.
        </p>
      </div>

      <section className="card coming-soon-card" aria-labelledby="coming-soon-title">
        <h2 id="coming-soon-title">Coming soon</h2>
        <p>We’re preparing lessons to help you strengthen your essay writing.</p>
      </section>
    </main>
  );
}
