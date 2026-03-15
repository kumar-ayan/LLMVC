import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, saveConfig } from '../utils/config.js';

export async function configCommand(options: { show?: boolean }) {
  const current = getConfig();

  if (options.show) {
    console.log(chalk.bold('\nPromptVault Configuration:'));
    
    const maskedKey = current.apiKey 
      ? `${current.apiKey.substring(0, 4)}...${current.apiKey.substring(current.apiKey.length - 4)}` 
      : '(not set)';
      
    console.log(`  API Key:      ${chalk.cyan(maskedKey)}`);
    console.log(`  Model:        ${chalk.cyan(current.model)}`);
    console.log(`  Default Tags: ${chalk.cyan(current.defaultTags.join(', ') || '(none)')}`);
    console.log(`  Auto-analyze: ${chalk.cyan(current.autoAnalyze ? 'Yes' : 'No')}`);
    console.log('');
    return;
  }

  console.log(chalk.bold('\nConfigure PromptVault:'));

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'OpenAI (or compatible) API Key (leave blank to keep current):',
      mask: '*'
    },
    {
      type: 'input',
      name: 'model',
      message: 'Default LLM Model:',
      default: current.model
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

  const newConfig: any = {
    model: answers.model.trim() || current.model,
    defaultTags: answers.defaultTags.split(',').map((t: string) => t.trim()).filter(Boolean),
    autoAnalyze: answers.autoAnalyze
  };

  if (answers.apiKey.trim()) {
    newConfig.apiKey = answers.apiKey.trim();
  }

  saveConfig(newConfig);
  console.log(`\n${chalk.green('✓')} Configuration saved!\n`);
}
