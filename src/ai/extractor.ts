import { callLLMJson } from '../utils/llm.js';

export interface ExtractedPrompt {
  title: string;
  description: string;
  tags: string[];
  text: string;
}

export interface ExtractionResult {
  prompts: ExtractedPrompt[];
}

const SYSTEM_PROMPT = `You are an AI assistant designed to extract user prompts or instructions from disorganized chat logs, webpages, or text dumps.
Identify any distinct "prompts" the user might want to save to a prompt library.

For each extracted prompt, generate:
- A concise title (max 5 words)
- A 1-sentence description
- 2-4 relevant tags (lowercase)
- The raw text of the prompt itself (cleaned of markdown blocks if appropriate)

Respond EXACTLY in this JSON format:
{
  "prompts": [
    {
      "title": "Code Reviewer",
      "description": "A system prompt instructing the AI to act as a harsh JS code reviewer.",
      "tags": ["coding", "javascript", "review"],
      "text": "You are a senior engineer. Review the following code for security and performance issues..."
    }
  ]
}`;

export async function extractPrompts(rawText: string): Promise<ExtractedPrompt[]> {
  const res = await callLLMJson<ExtractionResult>(SYSTEM_PROMPT, `Extract prompts from the following text:\n\n${rawText.slice(0, 100000)}`);
  return res.prompts || [];
}
