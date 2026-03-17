import { callLLMJson } from '../utils/llm.js';

export interface AnalysisResult {
  clarity: number;
  specificity: number;
  context_score: number;
  instruction_quality: number;
  overall: number;
  issues: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are an expert prompt engineer. Critically evaluate the user-provided prompt.

Score each dimension from 0-100 based ONLY on what is actually written in the prompt:

- clarity: Is the goal unambiguous? Deduct for vague verbs, unclear intent, or multiple conflicting goals.
- specificity: Are output format, length, tone, and constraints explicitly defined? Deduct for anything left to assumption.
- context_score: Is enough background, persona, or domain context provided? Deduct if the LLM would need to guess the situation.
- instruction_quality: Are instructions logically ordered with no contradictions? Deduct for passive phrasing or missing steps.
- overall: Your honest weighted average. Do NOT just average the four scores mechanically.
- issues: Concrete, specific problems you found. If the prompt is strong, this array can be empty.
- summary: 1-2 sentences. Be direct about the biggest weakness.

Rules:
- Scores MUST vary based on actual prompt quality. A weak prompt should score 20-40, a decent one 50-70, a strong one 80+.
- Never output the same scores twice. Every prompt is different.
- Do not use placeholder numbers. Every score must reflect your actual evaluation.
- Return ONLY valid JSON, no markdown, no explanation outside the JSON.

Return this exact shape:
{
  "clarity": <number>,
  "specificity": <number>,
  "context_score": <number>,
  "instruction_quality": <number>,
  "overall": <number>,
  "issues": ["<specific issue>"],
  "summary": "<honest 1-2 sentence assessment>"
}`;

export async function analyzePrompt(text: string): Promise<AnalysisResult> {
  const result = await callLLMJson<AnalysisResult>(
    SYSTEM_PROMPT,
    `Evaluate this prompt carefully and score it based on its actual content:\n\n"""\n${text}\n"""`
  );

  // Clamp all scores to 0-100 in case model drifts
  return {
    ...result,
    clarity: Math.min(100, Math.max(0, result.clarity)),
    specificity: Math.min(100, Math.max(0, result.specificity)),
    context_score: Math.min(100, Math.max(0, result.context_score)),
    instruction_quality: Math.min(100, Math.max(0, result.instruction_quality)),
    overall: Math.min(100, Math.max(0, result.overall)),
  };
}