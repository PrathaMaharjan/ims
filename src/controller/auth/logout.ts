import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function logout(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}