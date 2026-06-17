import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Demo — Raaste",
  description:
    "Watch the Raaste walkthrough: parking-congestion intelligence and a deployable patrol plan for the Bengaluru Traffic Police.",
};

export default function DemoVideoPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--track)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Map
        </Link>
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          Raa<span className="text-[var(--accent-text)]">ste</span> demo
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
        <div className="w-full max-w-4xl">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
              Product walkthrough
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-[var(--text-strong)] sm:text-3xl">
              See Raaste in action
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              A three-minute tour — from the city-wide hotspot map and the
              parking-to-congestion proof to a deployable patrol plan and the
              constable&apos;s field sheet.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black shadow-xl">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/demo-poster.jpg"
              className="h-auto w-full"
            >
              <source src="/demo.mp4" type="video/mp4" />
              Your browser can&apos;t play this video.{" "}
              <a href="/demo.mp4" className="underline">
                Download it instead.
              </a>
            </video>
          </div>

          <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
            Built for the Bengaluru Traffic Police ·{" "}
            <Link href="/" className="text-[var(--accent-text)] hover:underline">
              open the live dashboard
            </Link>
          </p>
          <p className="mt-3 text-center text-[11px] text-[var(--text-faint)]">
            Music: &ldquo;Inspired&rdquo; by Kevin MacLeod (incompetech.com),
            licensed under Creative Commons: By Attribution 4.0.
          </p>
        </div>
      </main>
    </div>
  );
}
