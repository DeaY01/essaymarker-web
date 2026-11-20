"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Mark essay" },
  { href: "/history", label: "My essays" },
  { href: "/past-questions", label: "Past questions" },
  { href: "/learn", label: "Learn" },
] as const;

const PARTNER_ITEM = { href: "/partners", label: "Earn" } as const;

/** The nav links; `pathname` highlights the current section when known. */
/** Earn (`/partners`) is only shown to approved partners. */
export function NavLinks({
  pathname,
  showEarn = false,
}: {
  pathname: string | null;
  showEarn?: boolean;
}) {
  const items = showEarn ? [...NAV_ITEMS, PARTNER_ITEM] : NAV_ITEMS;
  return (
    <nav className="site-nav" aria-label="Main">
      {items.map(({ href, label }) => {
        const isActive =
          pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Reads the URL, which on dynamic routes is only known at request time, so it
 * must render inside <Suspense> (the fallback is <NavLinks pathname={null} />).
 */
export function ActiveNavLinks({ showEarn = false }: { showEarn?: boolean }) {
  return <NavLinks pathname={usePathname()} showEarn={showEarn} />;
}
