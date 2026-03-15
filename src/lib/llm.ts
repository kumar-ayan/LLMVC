export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getConfig(): LLMConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  };
}

export async function generateCompletion(
  systemPrompt: string,
  userInput: string,
  config: LLMConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error("API key not configured. Set OPENAI_API_KEY in Settings.");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function judgeOutput(
  input: string,
  expected: string,
  actual: string,
  config: LLMConfig
): Promise<{ score: number; reasoning: string }> {
  const judgePrompt = `You are an expert evaluator. Score the ACTUAL output against the EXPECTED output for the given INPUT.

Rate on a scale of 0-10 where:
- 0: Completely wrong or irrelevant
- 5: Partially correct but missing key elements
- 10: Perfect match in meaning and quality

Respond ONLY in this exact JSON format:
{"score": <number>, "reasoning": "<one sentence explanation>"}`;

  const judgeInput = `INPUT: ${input}

EXPECTED OUTPUT: ${expected}

ACTUAL OUTPUT: ${actual}`;

  const response = await generateCompletion(judgePrompt, judgeInput, config);

  try {
    const parsed = JSON.parse(response);
    return {
      score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
      reasoning: String(parsed.reasoning || "No reasoning provided"),
    };
  } catch {
    return { score: 0, reasoning: "Failed to parse judge response: " + response.slice(0, 200) };
  }
}
