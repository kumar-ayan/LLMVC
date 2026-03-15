import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Config {
  apiKey: string;
  model: string;
  defaultTags: string[];
  autoAnalyze: boolean;
}

const VAULT_DIR = path.join(os.homedir(), '.promptvault');
const CONFIG_PATH = path.join(VAULT_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  model: 'gpt-4o',
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

export function getApiKey(): string {
  const config = getConfig();
  return config.apiKey || process.env.OPENAI_API_KEY || '';
}

export function getVaultDir(): string {
  return VAULT_DIR;
}
