#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { viewCommand } from './commands/view.js';
import { editCommand } from './commands/edit.js';
import { diffCommand } from './commands/diff.js';
import { rollbackCommand } from './commands/rollback.js';
import { analyzeCommand } from './commands/analyze.js';
import { fixCommand } from './commands/fix.js';
import { evalCommand } from './commands/eval.js';
import { historyCommand } from './commands/history.js';
import { deleteCommand } from './commands/delete.js';
import { exportCommand } from './commands/export.js';
import { configCommand } from './commands/config.js';
import { searchCommand } from './commands/search.js';
import { importCommand } from './commands/importCmd.js';
import { getProvider, isAiConfigured } from './utils/config.js';

const program = new Command();

program
  .name('pv')
  .description(chalk.bold('PromptVault') + ' - Local-first version control for LLM prompts.')
  .version('1.0.0');

function requireAiProvider(action: (...args: any[]) => void) {
  return async (...args: any[]) => {
    if (!isAiConfigured()) {
      const provider = getProvider();
      const setupHint = provider === 'gemini'
        ? 'Run pv config to add your Gemini API key and model.'
        : 'Run pv config to choose or download an Ollama model.';

      console.log(chalk.yellow('\nWarning: This feature requires an AI provider to be configured.'));
      console.log(`${chalk.cyan(setupHint)}\n`);
      process.exit(1);
    }

    await action(...args);
  };
}

program
  .command('add [inline-text]')
  .description('Add a new prompt (opens $EDITOR if no text provided)')
  .action(addCommand);

program
  .command('import')
  .description('Import prompts from text or a webpage URL')
  .option('--text', 'Open editor to paste multi-line text mapping to prompts')
  .option('--url <url>', 'Fetch a webpage and extract prompts')
  .action(requireAiProvider(importCommand));

program
  .command('list')
  .description('List all tracked prompts')
  .option('--tag <tag>', 'Filter list by tag')
  .action(listCommand);

program
  .command('view <id>')
  .description('View a specific prompt and its latest analysis')
  .action(viewCommand);

program
  .command('edit <id>')
  .description('Open prompt in editor and save as new version')
  .action(editCommand);

program
  .command('diff <id>')
  .description('Word-level diff between two prompt versions')
  .requiredOption('--v1 <num>', 'Base version number')
  .requiredOption('--v2 <num>', 'Target version number')
  .action(diffCommand);

program
  .command('rollback <id>')
  .description('Roll back to a previous version of a prompt')
  .requiredOption('--to <num>', 'Version number to roll back to')
  .action(rollbackCommand);

program
  .command('analyze <id>')
  .description('Run AI analysis and get a 0-100 scorecard')
  .action(requireAiProvider(analyzeCommand));

program
  .command('fix <id>')
  .description('Generate an improved version of the prompt using AI')
  .action(requireAiProvider(fixCommand));

program
  .command('eval <id>')
  .description('Manage & run test suites evaluating output accuracy')
  .option('--add', 'Add a new test case')
  .option('--run', 'Run all test cases using LLM-as-judge')
  .action(requireAiProvider(evalCommand));

program
  .command('history <id>')
  .description('Show temporal history of versions and scores')
  .action(historyCommand);

program
  .command('delete <id>')
  .description('Delete a prompt and its history entirely')
  .action(deleteCommand);

program
  .command('export')
  .description('Export the entire vault to a readable file')
  .option('--json', 'Export raw JSON backup with versions')
  .option('--md', 'Export markdown concatenated list')
  .action(exportCommand);

program
  .command('config')
  .description('Choose AI provider and configure model, API key, and preferences')
  .option('--show', 'Show current settings')
  .action(configCommand);

program
  .command('search <keyword>')
  .description('Full-text search across all prompts and tags')
  .action(searchCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
