import { invalidateCache } from "../cache";

export async function invalidateUserProfileCache(userId: string) {
  await invalidateCache(`user:profile:${userId}`);
}