import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { REFRESH_TOKEN_EXPIRY_MS, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/tokens";

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken); // throws if invalid/expired signature

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, payload.sessionId),
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new Error("Session expired");
  }

  const tokenMatches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
  if (!tokenMatches) {
    // Token doesn't match what's stored — treat as compromised, kill the session.
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new Error("Invalid refresh token");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });
  if (!user) {
    throw new Error("User not found");
  }

  // Rotate: issue a new refresh token, invalidate the old one by replacing its hash.
  const newRefreshToken = signRefreshToken({ userId: user.id, sessionId: session.id });
  const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 12);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await db
    .update(sessions)
    .set({ refreshTokenHash: newRefreshTokenHash, expiresAt: newExpiresAt })
    .where(eq(sessions.id, session.id));

  const accessToken = signAccessToken({
    userId: user.id,
    organizationId: user.organizationId,
    isOwner: user.isOwner,
  });

  return { accessToken, refreshToken: newRefreshToken };
}