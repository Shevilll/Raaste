"use client";

import { useEffect, useState } from "react";
import { useEscape } from "@/lib/useEscape";

const STORAGE_KEY = "raaste_tour_seen";

const STEPS = [
  {
    title: "Welcome to Raaste",
    body: "Parking-congestion intelligence for Bengaluru Traffic Police, built on 298,450 real BTP violations.",
  },
  {
    title: "Find the worst zones",
    body: "The map shows impact-scored hotspots; click any to see its peak hour, offences and nearby congestion.",
  },
  {
    title: "See it across the day",
    body: "Use the time scrubber up top (▶ to animate) to watch hotspots shift by hour and day.",
  },
  {
    title: "Act on it",
    body: "Turn on Congestion to see the parking↔congestion proof, switch on Forecast, or hit Patrol plan for a deployable schedule.",
  },
];

export default function IntroTour() {
  // Start hidden; only reveal after the mount-time localStorage check so we
  // never flash the overlay for returning visitors.
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // Private mode / storage blocked — just skip the tour quietly.
    }
  }, []);

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — closing the overlay is what matters to the user.
    }
    setOpen(false);
  }

  useEscape(markSeen);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative flex max-h-[90dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="raaste-tour-title"
      >
        <button
          onClick={markSeen}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]"
          aria-label="Dismiss tour"
        >
          ✕
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-7">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
            Step {step + 1} of {STEPS.length}
          </div>

          <h2
            id="raaste-tour-title"
            className="text-lg font-semibold text-[var(--text-strong)]"
          >
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
            {current.body}
          </p>

          {/* Step dots */}
          <div className="mt-5 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-amber-500" : "w-1.5 bg-[var(--track)]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-6 py-3">
          <button
            onClick={markSeen}
            className="px-1 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirst}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-30 sm:py-1.5"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (isLast) markSeen();
                else setStep((s) => Math.min(STEPS.length - 1, s + 1));
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 sm:py-1.5"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
