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
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

const DEFAULT_CONFIG: Config = {
  provider: 'ollama',
  ollamaModel: '',
  ollamaUrl: 'http://localhost:11434',
  geminiModel: 'gemini-2.5-flash',
  geminiApiKey: '',
  defaultTags: [],
  autoAnalyze: false,
};

function tightenPermissions(targetPath: string, mode: number): void {
  try {
    fs.chmodSync(targetPath, mode);
  } catch {
    // Windows may ignore POSIX permission bits.
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function normalizeOllamaUrl(urlStr: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new Error('Ollama Host URL must be a valid absolute URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ollama Host URL must use http:// or https://.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Ollama Host URL cannot include credentials.');
  }

  if (parsed.search || parsed.hash) {
    throw new Error('Ollama Host URL cannot include query strings or fragments.');
  }

  if (parsed.pathname && parsed.pathname !== '/') {
    throw new Error('Ollama Host URL must point to the Ollama host root, not a nested path.');
  }

  if (!isLoopbackHost(parsed.hostname) && process.env.PROMPTVAULT_ALLOW_REMOTE_OLLAMA !== '1') {
    throw new Error('Remote Ollama hosts are blocked by default. Use localhost/127.0.0.1/::1, or set PROMPTVAULT_ALLOW_REMOTE_OLLAMA=1 if you intentionally want a remote host.');
  }

  parsed.pathname = '';
  return parsed.toString().replace(/\/$/, '');
}

export function ensureVaultExists(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true, mode: DIRECTORY_MODE });
  }
  tightenPermissions(VAULT_DIR, DIRECTORY_MODE);
  const exportsDir = path.join(VAULT_DIR, 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true, mode: DIRECTORY_MODE });
  }
  tightenPermissions(exportsDir, DIRECTORY_MODE);
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

    const merged = { ...DEFAULT_CONFIG, ...parsed };
    try {
      merged.ollamaUrl = normalizeOllamaUrl(merged.ollamaUrl);
    } catch {
      merged.ollamaUrl = DEFAULT_CONFIG.ollamaUrl;
    }

    return merged;
  } catch (err) {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Partial<Config>): Config {
  ensureVaultExists();
  const current = getConfig();
  const updated = { ...current, ...config };

  if (updated.ollamaUrl) {
    updated.ollamaUrl = normalizeOllamaUrl(updated.ollamaUrl);
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), { encoding: 'utf-8', mode: FILE_MODE });
  tightenPermissions(CONFIG_PATH, FILE_MODE);
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
