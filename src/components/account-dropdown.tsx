"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CoinsIcon, LogOutIcon } from "@/components/icons";

interface AccountDropdownProps {
  initials: string;
  name: string;
  email: string;
  /** Shows the Partner programme link; only approved partners can open it. */
  isPartner: boolean;
  signOutAction: () => Promise<void>;
}

export function AccountDropdown({ initials, name, email, isPartner, signOutAction }: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="account-dropdown" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="avatar-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
      </button>
      {open && (
        <div className="account-popover" id={menuId} role="menu">
          <div className="account-identity">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          {isPartner && (
            <Link
              className="menu-item"
              role="menuitem"
              href="/partners"
              onClick={() => setOpen(false)}
            >
              <CoinsIcon size={15} />
              Partner programme
            </Link>
          )}
          <form action={signOutAction}>
            <button type="submit" className="menu-item" role="menuitem">
              <LogOutIcon size={15} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
