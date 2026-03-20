import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { fetchAndCleanWebpage } from '../utils/fetch.js';
import { extractPrompts } from '../ai/extractor.js';
import { createPrompt } from '../db/queries.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

export async function importCommand(options: { url?: string, text?: boolean }) {
  let rawText = '';

  if (options.url) {
    const spinner = ora('Fetching and cleaning URL').start();
    try {
      rawText = await fetchAndCleanWebpage(options.url);
      spinner.succeed('Webpage downloaded and cleaned');
    } catch (err: any) {
      spinner.fail('Failed to fetch URL');
      console.log(chalk.red(`⚠ ${err.message}`));
      return;
    }
  } else if (options.text) {
    const res = await inquirer.prompt([
      {
        type: 'editor',
        name: 'text',
        message: 'Paste your raw text/chat log (opens in $EDITOR, close to import)'
      }
    ]);
    rawText = res.text.trim();
  } else {
    console.log(chalk.red('⚠ Please specify either --url <url> or --text'));
    return;
  }

  if (!rawText) {
    console.log(chalk.dim('\nNo text provided.'));
    return;
  }

  const aiSpinner = ora('Extracting prompts via AI').start();
  let extracted = [];
  try {
    extracted = await extractPrompts(rawText);
    aiSpinner.succeed(`Found ${extracted.length} prompt(s)`);
  } catch (err: any) {
    aiSpinner.fail('Failed to extract prompts');
    console.log(chalk.red(`⚠ ${err.message}`));
    return;
  }

  if (extracted.length === 0) {
    console.log(chalk.yellow('\nNo valid generative AI prompts detected in text.'));
    return;
  }

  console.log('');
  const choices = extracted.map((ext, idx) => ({
    name: `${chalk.bold(sanitizeForTerminal(ext.title))} ${chalk.dim(`(${sanitizeForTerminal(ext.tags.join(', '))})`)}\n  ${chalk.italic(sanitizeForTerminal(ext.description))}`,
    value: ext,
    checked: true
  }));

  const answer = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: 'Select the prompts to import:',
      choices
    }
  ]);

  if (answer.selected.length === 0) {
    console.log(chalk.dim('\nImport cancelled.'));
    return;
  }

  for (const ext of answer.selected) {
    const tagsStr = ext.tags.join(', ');
    const id = createPrompt(ext.title, ext.description, tagsStr, ext.text);
    console.log(`\n${chalk.green('✓')} Imported "${sanitizeForTerminal(ext.title)}" -> ID: ${chalk.cyan(id.split('-')[0])}`);
  }
}
