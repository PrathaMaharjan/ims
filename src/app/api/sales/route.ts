import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuth } from "@/lib/auth/require-auth";
import { createSaleSchema, listSalesQuerySchema } from "@/lib/validation/sales";
import { createSale } from "@/controller/sales/batchesWIse/conteoller";
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
        with: { items: true, customer: { columns: { id: true, name: true } } },
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
    console.log(parsed.data.items)

    const result = await createSale(auth.organizationId, auth.userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /sales failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create sale";
    const status = message.startsWith("Insufficient stock") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}