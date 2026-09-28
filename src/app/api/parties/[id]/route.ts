import { deleteParty, getPartyById, updateParty } from "@/controller/party/controller";
import { getAuth } from "@/lib/auth/require-auth";
import { updatePartySchema } from "@/lib/validation/party";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const party = await getPartyById(auth.organizationId, id);

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    return NextResponse.json({ party });
  } catch (error) {
    console.error("GET /parties/[id] failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updatePartySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateParty(auth.organizationId, id, parsed.data);
    return NextResponse.json({ party: updated });
  } catch (error) {
    console.error("PATCH /parties/[id] failed:", error);
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteParty(auth.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /parties/[id] failed:", error);
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }
}
