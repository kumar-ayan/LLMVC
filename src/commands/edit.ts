import chalk from 'chalk';
import inquirer from 'inquirer';
import { getLatestVersion, createVersion } from '../db/queries.js';

export async function editCommand(id: string) {
  const db = require('../db/schema.js').getDb();
  const row = db.prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const version = getLatestVersion(promptId);

  if (!version) {
    console.log(chalk.red('⚠ Error loading prompt details.'));
    return;
  }

  console.log(`Editing prompt: ${chalk.bold(row.title)}`);

  const res = await inquirer.prompt([
    {
      type: 'editor',
      name: 'text',
      message: 'Edit your prompt content',
      default: version.text
    }
  ]);

  const newText = res.text.trim();

  if (!newText || newText === version.text) {
    console.log(chalk.dim('\nNo changes made.'));
    return;
  }

  createVersion(promptId, newText);

  console.log(`\n${chalk.green('✓')} Saved new version!`);
}
