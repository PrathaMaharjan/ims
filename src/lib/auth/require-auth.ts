import { NextRequest } from "next/server";
import { verifyAccessToken } from "./tokens";

export interface AuthContext {
  userId: string;
  organizationId: string;
  isOwner: boolean;
}

// Plain function — no wrapping, just call it and check the result yourself.
export function getAuth(req: NextRequest): AuthContext | null {

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      isOwner: payload.isOwner,
    };
  } catch {
    return null;
  }
}