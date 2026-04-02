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

async function callOpenRouter(systemMessage: string, userMessage: string, jsonFormat: boolean): Promise<string> {
  const { openrouterApiKey, openrouterModel } = getConfig();
  if (!openrouterApiKey) {
    throw new Error('No OpenRouter API key configured. Run "pv config" and choose OpenRouter first.');
  }
  if (!openrouterModel) {
    throw new Error('No OpenRouter model configured. Run "pv config" and choose OpenRouter first.');
  }

  const payload: any = {
    model: openrouterModel,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    top_p: 0.9
  };

  if (jsonFormat) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterApiKey}`
        }
      }
    );

    const content = res.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter returned an empty response.');
    }

    return content;
  } catch (err: any) {
    const status = err.response?.status;
    const apiMessage =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message;

    if (status === 400) {
      throw new Error(`OpenRouter API rejected the request: ${apiMessage}`);
    }
    if (status === 401 || status === 403) {
      throw new Error('OpenRouter API key was rejected. Update it with "pv config".');
    }

    throw new Error(`OpenRouter API error: ${apiMessage}`);
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
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemMessage}\n\n${userMessage}` }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9
    }
  };

  if (jsonFormat && !geminiModel.toLowerCase().includes('gemma')) {
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

  if (provider === 'openrouter') {
    return callOpenRouter(systemMessage, userMessage, jsonFormat);
  }

  return callOllama(systemMessage, userMessage, jsonFormat);
}

export async function callLLMJson<T>(systemMessage: string, userMessage: string): Promise<T> {
  const content = await callLLM(systemMessage, userMessage, true);

  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1]) as T;
    }

    throw new Error(`Failed to parse JSON from model response:\n${content}`);
  }
}