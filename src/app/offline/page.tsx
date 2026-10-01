"use client";

import { useState } from "react";

export default function OfflinePage() {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleReload = () => {
    setIsRetrying(true);
    window.location.reload();
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-800 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          Connection lost
        </div>

        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-900/5">
          <svg
            className="h-10 w-10 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18M10.5 6.5A12.03 12.03 0 0118 8.5M6 10a12.03 12.03 0 014.288-1.5M12 15a4.5 4.5 0 002.577-.8M8.53 12.5a6.002 6.002 0 015.34-1.25M12 19h.01"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Check your internet connection. Sales, stock, and billing require an active connection to stay synchronized and accurate.
        </p>

        <button
          onClick={handleReload}
          disabled={isRetrying}
          className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-[#044d73] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#044d73]/20 transition-all hover:bg-[#033b58] active:scale-[0.98] disabled:opacity-75"
        >
          <svg
            className={`h-4 w-4 stroke-2 ${isRetrying ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRetrying ? "Checking connection..." : "Try again"}
        </button>
      </div>
    </main>
  );
}