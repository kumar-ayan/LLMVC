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

const SYSTEM_PROMPT = `You are a brutally honest prompt quality auditor. Your job is to find flaws, not to encourage.

SCORING RULES — follow these exactly:
- A prompt with no output format defined:        specificity   MAX 40
- A prompt with no persona or context:           context_score MAX 35  
- A prompt with vague verbs (help, discuss, do): clarity       MAX 45
- A prompt under 20 words:                       overall       MAX 30
- A prompt with no constraints at all:           overall       MAX 40
- Only a genuinely well-engineered prompt scores above 75

SCORING MINDSET:
- Assume the model reading this prompt is stupid. Does it have EVERYTHING it needs?
- Missing output format = automatic specificity penalty
- Missing persona = automatic context penalty  
- Vague task = automatic clarity penalty
- If you feel like giving 70+, ask yourself: what is still undefined? There's always something.
- A score of 80+ means the prompt is genuinely production-ready. Most are not.

Return ONLY this JSON, no markdown:
{
  "clarity": <number 0-100>,
  "specificity": <number 0-100>,
  "context_score": <number 0-100>,
  "instruction_quality": <number 0-100>,
  "overall": <number 0-100>,
  "issues": ["<specific actionable issue>"],
  "summary": "<1-2 sentences, lead with the biggest weakness>"
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