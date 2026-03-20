import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Config {
  ollamaModel: string;
  ollamaUrl: string;
  defaultTags: string[];
  autoAnalyze: boolean;
}

const VAULT_DIR = path.join(os.homedir(), '.promptvault');
const CONFIG_PATH = path.join(VAULT_DIR, 'config.json');
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

const DEFAULT_CONFIG: Config = {
  ollamaModel: '',
  ollamaUrl: 'http://localhost:11434',
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
    
    // Migrate old format to new format
    if (parsed.apiKey !== undefined && parsed.ollamaModel === undefined) {
       parsed.ollamaModel = parsed.model || '';
       parsed.ollamaUrl = 'http://localhost:11434';
       delete parsed.apiKey;
       delete parsed.model;
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

export function getVaultDir(): string {
  return VAULT_DIR;
}
