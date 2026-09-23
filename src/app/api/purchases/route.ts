import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAuth } from "@/lib/auth/require-auth";
import { createPurchaseSchema, listPurchasesQuerySchema } from "@/lib/validation/purchases";
import { createPurchase } from "@/controller/purchase/controller";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listPurchasesQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const whereClause = eq(purchases.organizationId, auth.organizationId);

    const [rows, countResult] = await Promise.all([
      db.query.purchases.findMany({
        where: whereClause,
        with: {
          items: true,
          supplier: { columns: { id: true, name: true } }, // added — no separate fetch needed
        },
        orderBy: (table, { desc }) => [desc(table.purchaseDate)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(purchases).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return NextResponse.json({
      purchases: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /purchases failed:", error);
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
    const parsed = createPurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await createPurchase(auth.organizationId, auth.userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /purchases failed:", error);
    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
  }
}