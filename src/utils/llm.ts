import axios from 'axios';
import { getConfig } from './config.js';

function extractGeminiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part: any) => typeof part?.text === 'string' ? part.text : '')
      .join('')
      .trim();

    if (text) {
      return text;
    }
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked the request: ${blockReason}`);
  }

  throw new Error('Gemini returned an empty response.');
}

async function callOllama(systemMessage: string, userMessage: string, jsonFormat: boolean): Promise<string> {
  const { ollamaModel, ollamaUrl } = getConfig();
  if (!ollamaModel) {
    throw new Error('No Ollama model configured. Run "pv config" and choose Ollama first.');
  }

  const payload: any = {
    model: ollamaModel,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    stream: false,
    options: {
      temperature: 0.7,
      seed: Math.floor(Math.random() * 999999),
      top_p: 0.9,
      repeat_penalty: 1.1
    }
  };

  if (jsonFormat) {
    payload.format = 'json';
  }

  try {
    const res = await axios.post(`${ollamaUrl}/api/chat`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    return res.data.message.content;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      throw new Error(`Connection to Ollama refused on ${ollamaUrl}. Is the Ollama app running locally?`);
    }

    throw new Error(`Ollama API error: ${err.message}`);
  }
}

async function callGemini(systemMessage: string, userMessage: string, jsonFormat: boolean): Promise<string> {
  const { geminiApiKey, geminiModel } = getConfig();
  if (!geminiApiKey) {
    throw new Error('No Gemini API key configured. Run "pv config" and choose Gemini first.');
  }
  if (!geminiModel) {
    throw new Error('No Gemini model configured. Run "pv config" and choose Gemini first.');
  }

  const payload: any = {
    systemInstruction: {
      parts: [{ text: systemMessage }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9
    }
  };

  if (jsonFormat) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey
        }
      }
    );

    return extractGeminiText(res.data);
  } catch (err: any) {
    const status = err.response?.status;
    const apiMessage =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message;

    if (status === 400) {
      throw new Error(`Gemini API rejected the request: ${apiMessage}`);
    }
    if (status === 401 || status === 403) {
      throw new Error('Gemini API key was rejected. Update it with "pv config".');
    }

    throw new Error(`Gemini API error: ${apiMessage}`);
  }
}

export async function callLLM(
  systemMessage: string,
  userMessage: string,
  jsonFormat: boolean = false
): Promise<string> {
  const { provider } = getConfig();

  if (provider === 'gemini') {
    return callGemini(systemMessage, userMessage, jsonFormat);
  }

  return callOllama(systemMessage, userMessage, jsonFormat);
}

/**
 * Attempt to extract the first complete JSON object from a string that may
 * contain extra text before/after the JSON (e.g. chain-of-thought reasoning
 * from models like gemma that ignore responseMimeType).
 */
function extractJsonFromText(text: string): string | null {
  // Strategy 1: look for ```json ... ``` fenced blocks
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // Strategy 2: find the first top-level { ... } by brace-matching
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }

  return null;
}

export async function callLLMJson<T>(systemMessage: string, userMessage: string): Promise<T> {
  const content = await callLLM(systemMessage, userMessage, true);

  // 1) Try parsing the raw response directly
  try {
    return JSON.parse(content) as T;
  } catch {
    // 2) Try extracting JSON from mixed text/JSON response
    const extracted = extractJsonFromText(content);
    if (extracted) {
      try {
        return JSON.parse(extracted) as T;
      } catch {
        // Fall through to error
      }
    }

    throw new Error(`Failed to parse JSON from model response:\n${content}`);
  }
}
