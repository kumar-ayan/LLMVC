import { NextRequest, NextResponse } from "next/server";
import { getEvalRun, getEvalResults } from "@/lib/evals";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = getEvalRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Eval run not found" }, { status: 404 });
    }
    const results = getEvalResults(runId);
    return NextResponse.json({ run, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch eval results" },
      { status: 500 }
    );
  }
}
