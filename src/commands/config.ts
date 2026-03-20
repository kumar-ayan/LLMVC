import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getConfig, saveConfig } from '../utils/config.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

const execFileAsync = promisify(execFile);

function isValidModelName(model: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model);
}

async function detectVRAM(): Promise<number> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('wmic', ['path', 'win32_VideoController', 'get', 'AdapterRAM']);
      const lines = stdout.split('\n').filter(line => line.trim().length > 0);
      let maxVram = 0;
      // skip the header "AdapterRAM"
      for (let i = 1; i < lines.length; i++) {
        const val = parseInt(lines[i].trim(), 10);
        if (!isNaN(val) && val > maxVram) maxVram = val;
      }
      if (maxVram > 0) return maxVram;
    }
  } catch (err) {
    // Ignore wmic errors
  }
  
  // Fallback to system RAM
  return os.totalmem();
}

function recommendModels(vramBytes: number) {
  const gb = vramBytes / (1024 * 1024 * 1024);
  
  const models = [
    { name: 'llama3:8b (Fast, Great reasoning)', value: 'llama3:8b', reqGb: 6 },
    { name: 'gemma2:9b (Excellent accuracy)', value: 'gemma2:9b', reqGb: 8 },
    { name: 'qwen2.5:7b (Incredible general knowledge)', value: 'qwen2.5:7b', reqGb: 6 },
    { name: 'qwen2.5:0.5b (Ultra fast, lower quality)', value: 'qwen2.5:0.5b', reqGb: 1 },
    { name: 'llama3.1:70b (Highest quality, requires heavy hardware)', value: 'llama3.1:70b', reqGb: 32 }
  ];

  // Map to select choices, highlighting recommended ones
  return models.map(m => {
    const recommended = gb >= m.reqGb ? chalk.green('✓ Recommended') : chalk.red('⚠ May be too large for your system');
    return {
      name: `${m.name.padEnd(60)} ${recommended}`,
      value: m.value
    };
  });
}

export async function configCommand(options: { show?: boolean }) {
  const current = getConfig();

  if (options.show) {
    console.log(chalk.bold('\nPromptVault Local Configuration:'));
    console.log(`  Ollama Model: ${chalk.cyan(sanitizeForTerminal(current.ollamaModel || '(not set)'))}`);
    console.log(`  Ollama Host:  ${chalk.cyan(sanitizeForTerminal(current.ollamaUrl))}`);
    console.log(`  Default Tags: ${chalk.cyan(sanitizeForTerminal(current.defaultTags.join(', ') || '(none)'))}`);
    console.log(`  Auto-analyze: ${chalk.cyan(current.autoAnalyze ? 'Yes' : 'No')}`);
    console.log('');
    return;
  }

  console.log(chalk.bold('\nConfigure PromptVault Local Models:'));
  const spinner = ora('Detecting system RAM/VRAM to recommend models...').start();
  
  const vram = await detectVRAM();
  const gb = Math.round(vram / (1024 * 1024 * 1024));
  spinner.succeed(`Detected ~${gb}GB Memory available for models`);

  const uiChoices = recommendModels(vram);
  uiChoices.push({ name: 'Enter custom Ollama tag...', value: 'custom' });
  uiChoices.push({ name: 'Skip model selection (I already have one set)', value: 'skip' });

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelSelection',
      message: 'Select a local Ollama model to use for PromptVault:',
      choices: uiChoices
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
        console.log(chalk.red('⚠ Model name contains unsupported characters.'));
        return;
      }

      const pullSpinner = ora(`Pulling ${finalModel} via Ollama (this may take a while)...`).start();
      try {
        await execFileAsync('ollama', ['pull', finalModel]);
        pullSpinner.succeed(`Successfully downloaded ${finalModel}`);
      } catch (err: any) {
        pullSpinner.fail(`Failed to pull model: ${finalModel}`);
        console.log(chalk.red(`⚠ Is Ollama installed and running? Run 'ollama serve' first.`));
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

  const newConfig = {
    ollamaModel: finalModel,
    ollamaUrl: prefs.ollamaUrl.trim() || current.ollamaUrl,
    defaultTags: prefs.defaultTags.split(',').map((t: string) => t.trim()).filter(Boolean),
    autoAnalyze: prefs.autoAnalyze
  };

  try {
    saveConfig(newConfig);
    console.log(`\n${chalk.green('✓')} Local Configuration saved!\n`);
  } catch (err: any) {
    console.log(chalk.red(`\n⚠ ${err.message}\n`));
  }
}
