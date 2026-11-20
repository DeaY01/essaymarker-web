import Image from "next/image";
import { CheckIcon } from "@/components/icons";
import { CopyrightNotice } from "@/components/site-footer";

const HIGHLIGHTS = [
  "Upload photos of your handwritten essay",
  "Get a score out of 50 on the WAEC / NECO COEM rubric",
  "See line-by-line corrections and what to practise next",
];

/** Full-screen, branded layout for sign-in, sign-up and password pages. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="brand auth-brand-logo">
            <Image className="brand-logo" src="/logo.png" alt="" width={44} height={44} priority />
            EssayMarker
          </div>

          <div className="auth-brand-copy">
            <p className="auth-brand-kicker">WAEC &amp; NECO essay practice</p>
            <h2>Write it by hand. Get it marked like the real exam.</h2>
            <ul className="auth-highlights">
              {HIGHLIGHTS.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="auth-brand-footnote">
            AI-powered essay assessment assistant. Official results are set by WAEC
            and NECO examiners.
          </p>
        </div>
      </aside>

      <div className="auth-main">
        <main className="auth-content">{children}</main>
        <footer className="auth-footer">
          <CopyrightNotice />
        </footer>
      </div>
    </div>
  );
}
