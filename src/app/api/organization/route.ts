import { getOrganization, updateOrganization } from "@/controller/auth/orgDetail/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updateOrganizationSchema } from "@/lib/validation/organiztion";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await getOrganization(auth.organizationId);
    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error("GET /organization failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// update organization detail
export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!auth.isOwner) {
      return NextResponse.json({ error: "Forbidden — owner access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateOrganization(auth.organizationId, parsed.data);
    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error("PATCH /organization failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update organization";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}