import { callLLMJson } from '../utils/llm.js';

export interface EvalScore {
  score: number; // 1-10
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an impartial evaluator grading an AI's output against an expected baseline.
For the given input, how well does the ACTUAL OUTPUT match the expected criteria or EXPECTED OUTPUT?
Score from 1 to 10.
1 = Completely wrong, hallucinated, or irrelevant.
5 = Partially correct, missing key details.
10 = Perfectly matches intent and expected format.

You MUST respond ONLY with valid JSON:
{
  "score": 8,
  "reasoning": "Mostly correct, but omitted the final requested detail."
}`;

export async function judgeOutput(input: string, expectedOutput: string, actualOutput: string): Promise<EvalScore> {
  const prompt = `INPUT:
${input}

EXPECTED OUTPUT:
${expectedOutput || '(None provided - evaluate general quality and appropriateness for the input)'}

ACTUAL OUTPUT:
${actualOutput}
`;
  return callLLMJson<EvalScore>(SYSTEM_PROMPT, prompt);
}
