import { NextRequest, NextResponse } from "next/server";
import { getTestCases, createTestCase } from "@/lib/test-cases";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testCases = getTestCases(id);
    return NextResponse.json(testCases);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch test cases" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, input, expected_output } = body;

    if (!name || !input) {
      return NextResponse.json(
        { error: "Name and input are required" },
        { status: 400 }
      );
    }

    const testCase = createTestCase(id, name, input, expected_output || "");
    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create test case" },
      { status: 500 }
    );
  }
}
