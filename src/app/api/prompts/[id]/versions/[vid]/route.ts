import { NextRequest, NextResponse } from "next/server";
import { getVersionById } from "@/lib/versions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  try {
    const { vid } = await params;
    const version = getVersionById(vid);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json(version);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch version" },
      { status: 500 }
    );
  }
}
