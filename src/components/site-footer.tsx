import Image from "next/image";

/** Company line shared by the app footer and the sign-in / sign-up pages. */
export function CopyrightNotice() {
  return (
    <span>
      © 2026 Olearn Digital Global <span aria-hidden="true">•</span>{" "}
      <span className="country-label">
        Nigeria
        <Image
          className="nigeria-flag"
          src="/nigeria-flag.svg"
          alt="Nigeria flag"
          width={24}
          height={16}
        />
      </span>
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
