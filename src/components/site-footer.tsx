/** Company line shared by the app footer and the sign-in / sign-up pages. */
export function CopyrightNotice() {
  return (
    <span>
      © 2026 Olearn Digital Global <span aria-hidden="true">•</span> Built in
      Ogun - Nigeria
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <CopyrightNotice />
        <span>
          AI-powered essay assessment assistant. Official results are set by WAEC
          and NECO examiners.
        </span>
      </div>
    </footer>
  );
}
