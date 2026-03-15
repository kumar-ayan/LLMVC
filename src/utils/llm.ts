import axios from 'axios';
import { getConfig, getApiKey } from './config.js';

export async function callLLM(
  systemMessage: string, 
  userMessage: string, 
  jsonFormat: boolean = false
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Run "pv config" first.');
  }

  const { model } = getConfig();
  
  const payload: any = {
    model: model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
  };

  if (jsonFormat) {
    payload.response_format = { type: 'json_object' };
  }

  const res = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return res.data.choices[0].message.content;
}

export async function callLLMJson<T>(systemMessage: string, userMessage: string): Promise<T> {
  const content = await callLLM(systemMessage, userMessage, true);
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error('Failed to parse JSON response from LLM');
  }
}
