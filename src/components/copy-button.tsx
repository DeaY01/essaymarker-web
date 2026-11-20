"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** Copies `value` to the clipboard; shows a tick for two seconds after. */
export function CopyButton({
  value,
  label,
  showText = false,
}: {
  value: string;
  label: string;
  showText?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <button
      type="button"
      className={showText ? "button button-secondary button-sm" : "icon-button"}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard can be blocked; the text is still visible to copy by hand.
        }
      }}
    >
      {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      {showText && (copied ? "Copied" : "Copy")}
    </button>
  );
}
