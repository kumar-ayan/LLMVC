import { callLLMJson } from '../utils/llm.js';

export interface FixResult {
  improvedPrompt: string;
  changes: { description: string; reason: string }[];
}

const SYSTEM_PROMPT = `You are a master prompt engineer. Look at the provided prompt and rewrite it to be significantly better. 
Focus on:
- Adding clear persona/context
- Being highly specific about constraints
- Adding formatting instructions (e.g. JSON, XML, specific layout)
- Providing an example if helpful
- Removing vague or ambiguous language

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
