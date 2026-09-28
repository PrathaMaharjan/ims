import { createParty, listParties } from "@/controller/party/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { getCached, setCached } from "@/lib/cache";
import { createPartySchema, listPartiesQuerySchema } from "@/lib/validation/party";
import { NextRequest, NextResponse } from "next/server";

// GET /api/parties?type=SUPPLIER|CUSTOMER&search=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = listPartiesQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, search, type } = parsed.data;
    const cacheKey = `parties:list:${auth.organizationId}:type=${type ?? ""}:page=${page}:limit=${limit}:search=${search ?? ""}`;

    const cached = await getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = await listParties(auth.organizationId, parsed.data);
    await setCached(cacheKey, result, 60 * 5);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /parties failed:", error);
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
    const parsed = createPartySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createParty(auth.organizationId, parsed.data);
    return NextResponse.json({ party: created }, { status: 201 });
  } catch (error) {
    console.error("POST /parties failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
