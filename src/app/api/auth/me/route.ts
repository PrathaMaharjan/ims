import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCached, setCached } from "@/lib/cache";
import { getAuth } from "@/lib/auth/require-auth";

interface CachedUser {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = `user:profile:${auth.userId}`;

  const cached = await getCached<CachedUser>(cacheKey);
  if (cached) {
    return NextResponse.json({ user: cached });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { id: true, name: true, email: true, isOwner: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await setCached(cacheKey, user, 60 * 10); // 10 minutes

  return NextResponse.json({ user });
}