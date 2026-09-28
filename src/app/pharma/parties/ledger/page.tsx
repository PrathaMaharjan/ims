"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin text-[#044d73]" />
          Loading party ledger...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-slate-600 font-medium">No parties created yet.</p>
      <Link
        href="/pharma/parties"
        className="rounded-lg bg-[#044d73] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#033f60]"
      >
        Go to Parties to Add One
      </Link>
    </div>
  );
}
