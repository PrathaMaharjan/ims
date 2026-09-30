import Link from "next/link";
import CursorRingField from "../components/cursor-ring-field";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white">
      {/* Animated dot field (white bg, grey/black dots) */}
      <div className="absolute inset-0">
        <CursorRingField
          background="#ffffff"
          colors={{ items: ["#a1a1aa", "#52525b", "#18181b"] }}
        />
      </div>

      {/* Soft white glow so the text stays readable over the dots */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.6)_30%,transparent_65%)]" />

      {/* Content — pointer-events-none so the ring still follows the cursor */}
      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">


        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
          Always know what you have in stock.
        </h1>

        <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
          Track stock levels, batches and suppliers, and manage purchases, sales and returns in one simple system.
        </p>

        <Link
          href="/login"
          className="pointer-events-auto mt-10 inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-8 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}