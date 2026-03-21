import fs from 'fs';
import path from 'path';
import os from 'os';

export type LlmProvider = 'ollama' | 'gemini';

export interface Config {
  provider: LlmProvider;
  ollamaModel: string;
  ollamaUrl: string;
  geminiModel: string;
  geminiApiKey: string;
  defaultTags: string[];
  autoAnalyze: boolean;
}

const VAULT_DIR = path.join(os.homedir(), '.promptvault');
const CONFIG_PATH = path.join(VAULT_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  provider: 'ollama',
  ollamaModel: '',
  ollamaUrl: 'http://localhost:11434',
  geminiModel: 'gemini-2.5-flash',
  geminiApiKey: '',
  defaultTags: [],
  autoAnalyze: false,
};

export function ensureVaultExists(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
  const exportsDir = path.join(VAULT_DIR, 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
}

export function getConfig(): Config {
  ensureVaultExists();
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    if (parsed.apiKey !== undefined && parsed.ollamaModel === undefined) {
      parsed.ollamaModel = parsed.model || '';
      parsed.ollamaUrl = parsed.ollamaUrl || DEFAULT_CONFIG.ollamaUrl;
      delete parsed.apiKey;
      delete parsed.model;
    }

    if (parsed.provider !== 'ollama' && parsed.provider !== 'gemini') {
      parsed.provider = parsed.geminiApiKey ? 'gemini' : 'ollama';
    }

    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Partial<Config>): Config {
  ensureVaultExists();
  const current = getConfig();
  const updated = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function getOllamaModel(): string {
  const config = getConfig();
  return config.ollamaModel;
}

export function getProvider(): LlmProvider {
  return getConfig().provider;
}

export function isAiConfigured(): boolean {
  const config = getConfig();
  if (config.provider === 'gemini') {
    return Boolean(config.geminiApiKey && config.geminiModel);
  }

  return Boolean(config.ollamaModel);
}

export function getVaultDir(): string {
  return VAULT_DIR;
}
