import { NextRequest, NextResponse } from "next/server";
import { rollbackToVersion } from "@/lib/versions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { targetVersion } = body;

    if (!targetVersion || typeof targetVersion !== "number") {
      return NextResponse.json(
        { error: "targetVersion (number) is required" },
        { status: 400 }
      );
    }

    const newVersion = rollbackToVersion(id, targetVersion);
    if (!newVersion) {
      return NextResponse.json({ error: "Target version not found" }, { status: 404 });
    }

    return NextResponse.json(newVersion);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rollback" },
      { status: 500 }
    );
  }
}
