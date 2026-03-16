import axios from 'axios';
import { getConfig, getOllamaModel } from './config.js';

export async function callLLM(
  systemMessage: string, 
  userMessage: string, 
  jsonFormat: boolean = false
): Promise<string> {
  const model = getOllamaModel();
  if (!model) {
    throw new Error('No local Ollama model configured. Run "pv config" first.');
  }

  const { ollamaUrl } = getConfig();
  
  const payload: any = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    stream: false,
    options: {
      temperature: 0.7
    }
  };

  if (jsonFormat) {
    payload.format = 'json';
  }

  try {
    const res = await axios.post(`${ollamaUrl}/api/chat`, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return res.data.message.content;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      throw new Error(`Connection to Ollama refused on ${ollamaUrl}. Is the Ollama app running locally?`);
    }
    throw new Error(`Ollama API error: ${err.message}`);
  }
}

export async function callLLMJson<T>(systemMessage: string, userMessage: string): Promise<T> {
  const content = await callLLM(systemMessage, userMessage, true);
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error('Failed to parse JSON response from local model.');
  }
}
