"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";

export default function GeneralLedgerRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [noParties, setNoParties] = useState(false);

  useEffect(() => {
    api
      .get("/api/parties", { params: { limit: 1 } })
      .then((res) => {
        const first = res.data?.parties?.[0];
        if (first?.id) {
          router.replace(`/pharma/parties/${first.id}/ledger`);
        } else {
          setNoParties(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to find party for ledger redirect:", err);
        setLoading(false);
        setNoParties(true);
      });
  }, [router]);

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header Banner */}
      <div className="rounded-xl bg-[#044d73] px-6 py-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Party Ledger</h1>
          <p className="text-xs sm:text-sm text-white/80 mt-1">
            Party account ledger and transaction statement
          </p>
        </div>
        <Link
          href="/pharma/parties"
          className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Parties
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-16 shadow-sm">
          <DotsLoader text="Opening party ledger..." size="md" />
        </div>
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <p className="text-slate-600 font-medium">No parties created yet.</p>
          <Link
            href="/pharma/parties"
            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Go to Parties to Add One
          </Link>
        </div>
      )}
    </div>
  );
}
