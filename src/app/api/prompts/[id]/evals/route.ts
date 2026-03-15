import { NextRequest, NextResponse } from "next/server";
import { getEvalRuns, runEval } from "@/lib/evals";
import { getConfig } from "@/lib/llm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const runs = getEvalRuns(id);
    return NextResponse.json(runs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch eval runs" },
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
    const { version_id, api_key, base_url, model } = body;

    if (!version_id) {
      return NextResponse.json(
        { error: "version_id is required" },
        { status: 400 }
      );
    }

    const defaultConfig = getConfig();
    const config = {
      apiKey: api_key || defaultConfig.apiKey,
      baseUrl: base_url || defaultConfig.baseUrl,
      model: model || defaultConfig.model,
    };

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "API key is required. Set it in Settings or pass api_key in the request." },
        { status: 400 }
      );
    }

    const evalRun = await runEval(id, version_id, config);
    return NextResponse.json(evalRun, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run eval" },
      { status: 500 }
    );
  }
}
