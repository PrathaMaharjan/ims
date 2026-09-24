import { updateProfile } from "@/controller/userDetails/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateProfileSchema } from "@/lib/validation/userDetail";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateProfile(auth.userId, parsed.data);
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /users/me failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update profile";
    const status = message === "Email is already in use" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}