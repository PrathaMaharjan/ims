import { db } from "../../db";
import { users, sessions } from "../../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { z } from "zod";
import { REFRESH_TOKEN_EXPIRY_MS, signAccessToken, signRefreshToken } from "@/lib/auth/tokens";
import { verifyPassword } from "@/lib/auth/password";

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export async function login({ email, password }: LoginInput) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      refreshTokenHash: "", // placeholder, filled in right after
      expiresAt,
    })
    .returning();

  const refreshToken = signRefreshToken({ userId: user.id, sessionId: session.id });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

  await db
    .update(sessions)
    .set({ refreshTokenHash })
    .where(eq(sessions.id, session.id));

  const accessToken = signAccessToken({
    userId: user.id,
    organizationId: user.organizationId,
    isOwner: user.isOwner,
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, isOwner: user.isOwner },
  };
}