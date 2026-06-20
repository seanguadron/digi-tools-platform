"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={copied ? "skill-copy is-copied" : "skill-copy"}
      onClick={copy}
      aria-label={label ?? `Copy ${value}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
