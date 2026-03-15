import { NextRequest, NextResponse } from "next/server";
import { getVersionByNumber } from "@/lib/versions";
import { computeLineDiff } from "@/lib/diff-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const v1 = parseInt(searchParams.get("v1") || "");
    const v2 = parseInt(searchParams.get("v2") || "");

    if (isNaN(v1) || isNaN(v2)) {
      return NextResponse.json(
        { error: "Both v1 and v2 query params are required (version numbers)" },
        { status: 400 }
      );
    }

    const version1 = getVersionByNumber(id, v1);
    const version2 = getVersionByNumber(id, v2);

    if (!version1 || !version2) {
      return NextResponse.json({ error: "One or both versions not found" }, { status: 404 });
    }

    const diff = computeLineDiff(version1.content, version2.content);

    return NextResponse.json({
      v1: { version_number: version1.version_number, message: version1.message, created_at: version1.created_at },
      v2: { version_number: version2.version_number, message: version2.message, created_at: version2.created_at },
      diff,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute diff" },
      { status: 500 }
    );
  }
}
