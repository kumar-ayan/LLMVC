import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getSettings(): Settings {
  if (existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
      /* fall through */
    }
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  };
}

function saveSettings(settings: Settings): void {
  const dir = path.dirname(SETTINGS_PATH);
  const { mkdirSync } = require("fs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function GET() {
  try {
    const settings = getSettings();
    // Mask the API key for security
    return NextResponse.json({
      ...settings,
      apiKey: settings.apiKey ? "sk-......" + settings.apiKey.slice(-4) : "",
      hasApiKey: !!settings.apiKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const current = getSettings();

    const updated: Settings = {
      apiKey: body.apiKey !== undefined ? body.apiKey : current.apiKey,
      baseUrl: body.baseUrl !== undefined ? body.baseUrl : current.baseUrl,
      model: body.model !== undefined ? body.model : current.model,
    };

    saveSettings(updated);

    return NextResponse.json({
      ...updated,
      apiKey: updated.apiKey ? "sk-......" + updated.apiKey.slice(-4) : "",
      hasApiKey: !!updated.apiKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
