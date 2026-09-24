import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateCache } from "@/lib/cache";
import { ChangePasswordInput, UpdateProfileInput } from "@/lib/validation/userDetail";
import { and, eq, ne } from "drizzle-orm";

function profileCacheKey(userId: string) {
  return `user:profile:${userId}`;
}

const profileColumns = {
  id: true,
  name: true,
  email: true,
  isOwner: true,
} as const;

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (Object.keys(input).length === 0) {
    throw new Error("Nothing to update");
  }

  if (input.email) {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.email, input.email), ne(users.id, userId)),
      columns: { id: true },
    });
    if (existing) {
      throw new Error("Email is already in use");
    }
  }

  const [updated] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isOwner: users.isOwner,
    });

  if (!updated) {
    throw new Error("User not found");
  }
  await invalidateCache(profileCacheKey(userId));

  return updated;
}

// chnage password function
export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { passwordHash: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const currentPasswordValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await Promise.all([
    db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)),
  ]);

  return { success: true };
}