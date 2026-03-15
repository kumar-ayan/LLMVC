import inquirer from 'inquirer';
import chalk from 'chalk';
import { createPrompt } from '../db/queries.js';
import { getConfig } from '../utils/config.js';

export async function addCommand(inlineText?: string) {
  const config = getConfig();

  let text = inlineText || '';
  
  if (!text) {
    const res = await inquirer.prompt([
      {
        type: 'editor',
        name: 'text',
        message: 'Write your prompt content (opens in your default $EDITOR)',
      }
    ]);
    text = res.text.trim();
  }

  if (!text) {
    console.log(chalk.red('⚠ Prompt cannot be empty.'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Title (e.g. "Code Reviewer"):',
      validate: (input) => input.trim().length > 0 || 'Title is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Brief description (optional):',
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma separated):',
      default: config.defaultTags.join(', ')
    }
  ]);

  const tagsArray = answers.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  const tagsStr = tagsArray.join(', ');

  const id = createPrompt(answers.title, answers.description, tagsStr, text);

  console.log(`\n${chalk.green('✓')} Prompt saved successfully!`);
  console.log(`ID: ${chalk.cyan(id.split('-')[0])}`);
}
