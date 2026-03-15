import { callLLMJson } from '../utils/llm.js';

export interface AnalysisResult {
  clarity: number;     // 0-100
  specificity: number; // 0-100
  context_score: number; // 0-100
  instruction_quality: number; // 0-100
  overall: number;     // 0-100
  issues: string[];    // list of specific problems
  summary: string;     // 1-2 sentence overview
}

const SYSTEM_PROMPT = `You are an expert prompt engineer. Evaluate the provided system/user prompt on a scale of 0 to 100 for four criteria:
1. Clarity (how easy is it to understand the goal?)
2. Specificity (are the constraints, formats, and output expectations explicit?)
3. Context (is enough background/persona given to ground the LLM?)
4. Instruction Quality (are the steps logical and well-ordered?)

You MUST respond in EXACTLY this JSON structure:
{
  "clarity": 90,
  "specificity": 75,
  "context_score": 80,
  "instruction_quality": 85,
  "overall": 82,
  "issues": [
    "Missing output format instruction",
    "No example provided"
  ],
  "summary": "Strong clarity but lacks output constraints. Add a format example to improve specificity."
}`;

export async function analyzePrompt(text: string): Promise<AnalysisResult> {
  return callLLMJson<AnalysisResult>(SYSTEM_PROMPT, `Here is the prompt to evaluate:\n\n${text}`);
}
