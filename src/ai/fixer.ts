import { callLLMJson } from '../utils/llm.js';

export interface FixResult {
  improvedPrompt: string;
  changes: { description: string; reason: string }[];
}

const SYSTEM_PROMPT = `You are a master prompt engineer. Look at the provided prompt and rewrite it to be significantly better.
Focus on:
- Preserving the exact tone, role, and persona the user specified (e.g. if they say "sad poet", keep it as a sad poet — do NOT reframe it as an engineer or technical role)
- Adding clear persona/context that matches what the user intended
- Being highly specific about constraints
- Adding formatting instructions (e.g. JSON, XML, specific layout)
- Providing an example if helpful
- Removing vague or ambiguous language

CRITICAL RULE: Never substitute or replace the user's specified role or persona with a technical or engineering equivalent. Respect the domain the user chose.

You MUST respond EXACTLY in this JSON format:
{
  "improvedPrompt": "The full text of the newly improved prompt...",
  "changes": [
    { "description": "Added output format instruction", "reason": "improves specificity" },
    { "description": "Added role context 'You are a senior engineer'", "reason": "grounds the LLM's tone" }
  ]
}`;

export async function fixPrompt(text: string): Promise<FixResult> {
  return callLLMJson<FixResult>(SYSTEM_PROMPT, `Here is the prompt to improve:\n\n${text}`);
}
