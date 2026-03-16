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

const DEFAULT_CONFIG: Config = {
  ollamaModel: '',
  ollamaUrl: 'http://localhost:11434',
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
    
    // Migrate old format to new format
    if (parsed.apiKey !== undefined && parsed.ollamaModel === undefined) {
       parsed.ollamaModel = parsed.model || '';
       parsed.ollamaUrl = 'http://localhost:11434';
       delete parsed.apiKey;
       delete parsed.model;
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

export function getVaultDir(): string {
  return VAULT_DIR;
}
