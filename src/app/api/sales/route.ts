import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuth } from "@/lib/auth/require-auth";
import { createSaleSchema, listSalesQuerySchema } from "@/lib/validation/sales";
import { createSale } from "@/controller/sales/batchesWIse/conteoller";
import { BatchNotSellableError } from "@/controller/batches/controller";
// import { createSale } from "@/controller/sales/controller";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listSalesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const whereClause = eq(sales.organizationId, auth.organizationId);

    const [rows, countResult] = await Promise.all([
      db.query.sales.findMany({
        where: whereClause,
        with: {
          items: {
            with: {
              batch: true,
            },
          },
          party: { columns: { id: true, name: true } },
        },
        orderBy: (table, { desc }) => [desc(table.invoiceNumber)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(sales).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      sales: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /sales failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }


    const result = await createSale(auth.organizationId, auth.userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof BatchNotSellableError) {
      return NextResponse.json(
        { error: err.message, batchId: err.batchId, reason: err.reason },
        { status: 400 },
      );
    }
 
    console.error("POST /api/sales failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}