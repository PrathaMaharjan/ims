import "dotenv/config";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { and, eq, gt } from "drizzle-orm";
import z from "zod";
import bcrypt from "bcrypt";
import { hashPassword } from "@/lib/auth/password";

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes, for the step-2 → step-3 window

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// reuest for code
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function requestPasswordReset(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) return;

  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  try {
    await db.insert(passwordResets).values({
      userId: user.id,
      codeHash,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, code);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error sending password reset email:", error.message);
      throw new Error("Error sending password reset email");
    }
    console.error("Error sending password reset email:", error);
  }
}

// verify code
export const verifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
export async function verifyResetCode(
  email: string,
  code: string,
): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) throw new Error("Invalid or expired code");
  const resetRequest = await db.query.passwordResets.findFirst({
    where: and(
      eq(passwordResets.userId, user.id),
      eq(passwordResets.verified, false),
      gt(passwordResets.expiresAt, new Date()),
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  if (!resetRequest) throw new Error("Invalid or expired code");

  const codeMatches = await bcrypt.compare(code, resetRequest.codeHash);
  if (!codeMatches) throw new Error("Invalid or expired code");

  await db
    .update(passwordResets)
    .set({ verified: true })
    .where(eq(passwordResets.id, resetRequest.id));

  return resetRequest.id;
}

// reset password
export const resetPasswordSchema = z.object({
  resetId: z.string().uuid(),
  newPassword: z.string().min(8),
});

export async function resetPassword(resetId: string, newPassword: string) {
  try {
    const resetRequest = await db.query.passwordResets.findFirst({
      where: and(
        eq(passwordResets.id, resetId),
        eq(passwordResets.verified, true),
        gt(
          passwordResets.expiresAt,
          new Date(Date.now() - RESET_TOKEN_EXPIRY_MS),
        ),
      ),
    });

    if (!resetRequest)
      throw new Error("Reset session expired, please start again");

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetRequest.userId));

    await db.delete(sessions).where(eq(sessions.userId, resetRequest.userId));

    // Clean up: this reset request is now used, delete it so it can't be reused.
    await db
      .delete(passwordResets)
      .where(eq(passwordResets.id, resetRequest.id));
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error resetting password:", error.message);
      throw new Error("Error resetting password");
    }
    console.error("Error resetting password:", error);
  }
}
