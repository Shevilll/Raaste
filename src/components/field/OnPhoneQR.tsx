"use client";

import { useMemo, useState } from "react";
import { Smartphone, Link2, Check, X } from "lucide-react";
import { qrModules } from "@/lib/qr";
import { useEscape } from "@/lib/useEscape";

export default function OnPhoneQR({
  station,
  shiftId,
}: {
  station: string;
  shiftId: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEscape(() => setOpen(false));

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/field?s=${encodeURIComponent(station)}&shift=${shiftId}`;
  }, [station, shiftId]);

  const modules = useMemo(() => (open && url ? qrModules(url) : null), [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-amber-500/10"
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden />
        Open on phone
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Open this beat on a phone"
            className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-strong)]">
                Scan to patrol
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {station} · {shiftId}
            </div>

            {modules && (
              <div className="mt-4 flex justify-center">
                <svg
                  viewBox={`0 0 ${modules.length} ${modules.length}`}
                  className="h-52 w-52 rounded-lg bg-white p-2"
                  shapeRendering="crispEdges"
                >
                  {modules.flatMap((row, r) =>
                    row.map((dark, c) =>
                      dark ? (
                        <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0a0a0a" />
                      ) : null,
                    ),
                  )}
                </svg>
              </div>
            )}

            <button
              onClick={copy}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden /> Link copied
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" aria-hidden /> Copy link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
