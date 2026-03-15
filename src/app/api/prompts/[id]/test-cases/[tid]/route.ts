import { NextRequest, NextResponse } from "next/server";
import { deleteTestCase } from "@/lib/test-cases";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  try {
    const { tid } = await params;
    const deleted = deleteTestCase(tid);
    if (!deleted) {
      return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete test case" },
      { status: 500 }
    );
  }
}
