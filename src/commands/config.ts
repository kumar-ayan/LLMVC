import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Config, getConfig, saveConfig, LlmProvider } from '../utils/config.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

const execFileAsync = promisify(execFile);

const GEMINI_MODELS = [
  { name: 'gemini-2.5-flash (Balanced, recommended)', value: 'gemini-2.5-flash' },
  { name: 'gemini-2.5-flash-lite (Fastest and cheapest)', value: 'gemini-2.5-flash-lite' },
  { name: 'gemini-2.5-pro (Best reasoning quality)', value: 'gemini-2.5-pro' }
];

function isValidModelName(model: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model);
}

async function detectVRAM(): Promise<number> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('wmic', ['path', 'win32_VideoController', 'get', 'AdapterRAM']);
      const lines = stdout.split('\n').filter(line => line.trim().length > 0);
      let maxVram = 0;

      for (let i = 1; i < lines.length; i++) {
        const val = parseInt(lines[i].trim(), 10);
        if (!isNaN(val) && val > maxVram) {
          maxVram = val;
        }
      }

      if (maxVram > 0) {
        return maxVram;
      }
    }
  } catch {
    // Ignore detection errors and fall back to system RAM.
  }

  return os.totalmem();
}

function recommendModels(vramBytes: number) {
  const gb = vramBytes / (1024 * 1024 * 1024);

  const models = [
    { name: 'gemma3:1b (Tiny, very fast)', value: 'gemma3:1b', reqGb: 2 },
    { name: 'gemma3:4b (Balanced lightweight option)', value: 'gemma3:4b', reqGb: 4 },
    { name: 'gemma3:12b (Stronger reasoning, larger footprint)', value: 'gemma3:12b', reqGb: 10 },
    { name: 'gemma3:27b (High quality, heavy hardware)', value: 'gemma3:27b', reqGb: 24 },
    { name: 'llama3:8b (Fast, Great reasoning)', value: 'llama3:8b', reqGb: 6 },
    { name: 'gemma2:9b (Excellent accuracy)', value: 'gemma2:9b', reqGb: 8 },
    { name: 'qwen2.5:7b (Incredible general knowledge)', value: 'qwen2.5:7b', reqGb: 6 },
    { name: 'qwen2.5:0.5b (Ultra fast, lower quality)', value: 'qwen2.5:0.5b', reqGb: 1 },
    { name: 'llama3.1:70b (Highest quality, requires heavy hardware)', value: 'llama3.1:70b', reqGb: 32 }
  ];

  return models.map(model => {
    const recommended = gb >= model.reqGb
      ? chalk.green('[Recommended]')
      : chalk.red('[May be too large for your system]');

    return {
      name: `${model.name.padEnd(60)} ${recommended}`,
      value: model.value
    };
  });
}

async function configureOllama(current: Config): Promise<Partial<Config>> {
  console.log(chalk.bold('\nConfigure PromptVault with Ollama:'));
  const spinner = ora('Detecting system RAM/VRAM to recommend models...').start();

  const vram = await detectVRAM();
  const gb = Math.round(vram / (1024 * 1024 * 1024));
  spinner.succeed(`Detected ~${gb}GB Memory available for models`);

  const uiChoices = recommendModels(vram);
  uiChoices.push({ name: 'Enter custom Ollama tag...', value: 'custom' });
  uiChoices.push({
    name: current.ollamaModel
      ? `Keep current Ollama model (${current.ollamaModel})`
      : 'Keep current Ollama model',
    value: 'skip'
  });

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelSelection',
      message: 'Select a local Ollama model to use for PromptVault:',
      choices: uiChoices,
      default: current.ollamaModel ? 'skip' : undefined
    }
  ]);

  let finalModel = current.ollamaModel;

  if (answers.modelSelection !== 'skip') {
    if (answers.modelSelection === 'custom') {
      const customModelRes = await inquirer.prompt([{
        type: 'input',
        name: 'model',
        message: 'Enter Ollama model tag (e.g. mistral:latest):'
      }]);
      finalModel = customModelRes.model.trim();
    } else {
      finalModel = answers.modelSelection;
    }

    if (finalModel) {
      if (!isValidModelName(finalModel)) {
        throw new Error('Model name contains unsupported characters.');
      }

      const pullSpinner = ora(`Pulling ${finalModel} via Ollama (this may take a while)...`).start();
      try {
        await execFileAsync('ollama', ['pull', finalModel]);
        pullSpinner.succeed(`Successfully downloaded ${finalModel}`);
      } catch (err: any) {
        pullSpinner.fail(`Failed to pull model: ${finalModel}`);
        console.log(chalk.red(`Warning: Is Ollama installed and running? Run 'ollama serve' first.`));
        console.log(chalk.dim(err.message));
      }
    }
  }

  const prefs = await inquirer.prompt([
    {
      type: 'input',
      name: 'ollamaUrl',
      message: 'Ollama Host URL:',
      default: current.ollamaUrl
    },
    {
      type: 'input',
      name: 'defaultTags',
      message: 'Default Tags (comma separated):',
      default: current.defaultTags.join(', ')
    },
    {
      type: 'confirm',
      name: 'autoAnalyze',
      message: 'Auto-run analyze on new versions?',
      default: current.autoAnalyze
    }
  ]);

  return {
    provider: 'ollama',
    ollamaModel: finalModel,
    ollamaUrl: prefs.ollamaUrl.trim() || current.ollamaUrl,
    defaultTags: prefs.defaultTags.split(',').map((tag: string) => tag.trim()).filter(Boolean),
    autoAnalyze: prefs.autoAnalyze
  };
}

async function configureGemini(current: Config): Promise<Partial<Config>> {
  console.log(chalk.bold('\nConfigure PromptVault with Gemini:'));

  const modelChoices = GEMINI_MODELS.map(model => ({
    ...model,
    name: model.value === current.geminiModel ? `${model.name} ${chalk.green('(current)')}` : model.name
  }));
  if (current.geminiModel) {
    modelChoices.unshift({
      name: `Keep current Gemini model (${current.geminiModel})`,
      value: 'current'
    });
  }
  modelChoices.push({ name: 'Enter custom Gemini model...', value: 'custom' });

  const questions: any[] = [
    {
      type: 'list',
      name: 'geminiModelSelection',
      message: 'Select a Gemini model for AI features:',
      default: current.geminiModel ? 'current' : 'gemini-2.5-flash',
      choices: modelChoices
    },
    {
      type: 'confirm',
      name: 'updateGeminiApiKey',
      message: 'Update Gemini API key?',
      default: false,
      when: () => Boolean(current.geminiApiKey)
    },
    {
      type: 'password',
      name: 'geminiApiKey',
      message: current.geminiApiKey
        ? 'Gemini API Key (leave blank to keep current key):'
        : 'Gemini API Key:',
      mask: '*',
      when: (answers: any) => !current.geminiApiKey || answers.updateGeminiApiKey,
      validate: (input: string) => {
        if (input.trim() || current.geminiApiKey) {
          return true;
        }

        return 'Gemini API key is required when Gemini is the selected provider.';
      }
    },
    {
      type: 'input',
      name: 'defaultTags',
      message: 'Default Tags (comma separated):',
      default: current.defaultTags.join(', ')
    },
    {
      type: 'confirm',
      name: 'autoAnalyze',
      message: 'Auto-run analyze on new versions?',
      default: current.autoAnalyze
    }
  ];

  const answers = await inquirer.prompt(questions);

  let geminiModel = answers.geminiModelSelection;
  if (geminiModel === 'current') {
    geminiModel = current.geminiModel;
  } else if (geminiModel === 'custom') {
    const customModelRes = await inquirer.prompt([{
      type: 'input',
      name: 'model',
      message: 'Enter Gemini model name (e.g. gemini-2.5-flash):',
      default: current.geminiModel || 'gemini-2.5-flash'
    }]);
    geminiModel = customModelRes.model.trim();
  }

  if (!isValidModelName(geminiModel)) {
    throw new Error('Model name contains unsupported characters.');
  }

  return {
    provider: 'gemini',
    geminiModel,
    geminiApiKey: (answers.geminiApiKey || '').trim() || current.geminiApiKey,
    defaultTags: answers.defaultTags.split(',').map((tag: string) => tag.trim()).filter(Boolean),
    autoAnalyze: answers.autoAnalyze
  };
}

async function configureOpenRouter(current: Config): Promise<Partial<Config>> {
  console.log(chalk.bold('\nConfigure PromptVault with OpenRouter:'));

  const questions: any[] = [
    {
      type: 'input',
      name: 'openrouterModel',
      message: 'Enter OpenRouter model ID (e.g., anthropic/claude-3.5-sonnet):',
      default: current.openrouterModel || 'anthropic/claude-3.5-sonnet',
      validate: (input: string) => isValidModelName(input.trim()) || 'Invalid model name format.'
    },
    {
      type: 'confirm',
      name: 'updateOpenRouterApiKey',
      message: 'Update OpenRouter API key?',
      default: false,
      when: () => Boolean(current.openrouterApiKey)
    },
    {
      type: 'password',
      name: 'openrouterApiKey',
      message: current.openrouterApiKey
        ? 'OpenRouter API Key (leave blank to keep current key):'
        : 'OpenRouter API Key:',
      mask: '*',
      when: (answers: any) => !current.openrouterApiKey || answers.updateOpenRouterApiKey,
      validate: (input: string) => {
        if (input.trim() || current.openrouterApiKey) return true;
        return 'OpenRouter API key is required.';
      }
    },
    {
      type: 'input',
      name: 'defaultTags',
      message: 'Default Tags (comma separated):',
      default: current.defaultTags.join(', ')
    },
    {
      type: 'confirm',
      name: 'autoAnalyze',
      message: 'Auto-run analyze on new versions?',
      default: current.autoAnalyze
    }
  ];

  const answers = await inquirer.prompt(questions);

  return {
    provider: 'openrouter',
    openrouterModel: answers.openrouterModel.trim(),
    openrouterApiKey: (answers.openrouterApiKey || '').trim() || current.openrouterApiKey,
    defaultTags: answers.defaultTags.split(',').map((tag: string) => tag.trim()).filter(Boolean),
    autoAnalyze: answers.autoAnalyze
  };
}

export async function configCommand(options: { show?: boolean; provider?: string; model?: string; key?: string }) {
  const current = getConfig();

  if (options.show) {
    console.log(chalk.bold('\nPromptVault Local Configuration:'));
    console.log(`  Provider:        ${chalk.cyan(sanitizeForTerminal(current.provider))}`);
    console.log(`  Ollama Model:    ${chalk.cyan(sanitizeForTerminal(current.ollamaModel || '(not set)'))}`);
    console.log(`  Ollama Host:     ${chalk.cyan(sanitizeForTerminal(current.ollamaUrl))}`);
    console.log(`  Gemini Model:    ${chalk.cyan(sanitizeForTerminal(current.geminiModel || '(not set)'))}`);
    console.log(`  Gemini Key:      ${chalk.cyan(current.geminiApiKey ? '(set)' : '(not set)')}`);
    console.log(`  OpenRouter Mod:  ${chalk.cyan(sanitizeForTerminal(current.openrouterModel || '(not set)'))}`);
    console.log(`  OpenRouter Key:  ${chalk.cyan(current.openrouterApiKey ? '(set)' : '(not set)')}`);
    console.log(`  Default Tags:    ${chalk.cyan(sanitizeForTerminal(current.defaultTags.join(', ') || '(none)'))}`);
    console.log(`  Auto-analyze:    ${chalk.cyan(current.autoAnalyze ? 'Yes' : 'No')}`);
    console.log('');
    return;
  }

  if (options.provider || options.model || options.key) {
    try {
      const newConfig: Partial<Config> = {};
      if (options.provider) {
        if (['ollama', 'gemini', 'openrouter'].includes(options.provider)) {
          newConfig.provider = options.provider as any;
        } else {
          throw new Error('Invalid provider. Use "ollama", "gemini", or "openrouter".');
        }
      }

      const activeProvider = (options.provider || current.provider) as LlmProvider;

      if (options.model) {
        if (!isValidModelName(options.model)) {
          throw new Error('Invalid model name format.');
        }
        if (activeProvider === 'gemini') newConfig.geminiModel = options.model;
        else if (activeProvider === 'openrouter') newConfig.openrouterModel = options.model;
        else newConfig.ollamaModel = options.model;
      }

      if (options.key) {
        if (activeProvider === 'gemini') newConfig.geminiApiKey = options.key;
        else if (activeProvider === 'openrouter') newConfig.openrouterApiKey = options.key;
        else throw new Error('API key is only used for "gemini" or "openrouter" providers.');
      }

      saveConfig(newConfig);
      console.log(`\n${chalk.green('Saved!')} Configuration updated from flags.\n`);
      return;
    } catch (err: any) {
      console.log(chalk.red(`\nError: ${err.message}\n`));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose the provider PromptVault should use for AI features:',
      default: current.provider,
      choices: [
        { name: 'Ollama (local model on this machine)', value: 'ollama' },
        { name: 'Gemini API (cloud model via API key)', value: 'gemini' },
        { name: 'OpenRouter (unified API for multiple models)', value: 'openrouter' }
      ]
    }
  ]);

  try {
    let newConfig: Partial<Config>;
    if (answers.provider === 'gemini') {
      newConfig = await configureGemini(current);
    } else if (answers.provider === 'openrouter') {
      newConfig = await configureOpenRouter(current);
    } else {
      newConfig = await configureOllama(current);
    }

    saveConfig(newConfig);
    console.log(`\n${chalk.green('Saved!')} Local Configuration saved.\n`);
  } catch (err: any) {
    console.log(chalk.red(`\nWarning: ${err.message}\n`));
  }
}
