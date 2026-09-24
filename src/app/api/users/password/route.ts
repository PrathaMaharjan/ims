import { changePassword } from "@/controller/userDetails/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { changePasswordSchema } from "@/lib/validation/userDetail";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await changePassword(auth.userId, parsed.data);
    return NextResponse.json({ success: true, message: "Password changed. Please log in again." });
  } catch (error) {
    console.error("PATCH /users/me/password failed:", error);
    const message = error instanceof Error ? error.message : "Failed to change password";
    const status = message === "Current password is incorrect" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}