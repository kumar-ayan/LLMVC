import chalk from 'chalk';
import inquirer from 'inquirer';
import { deletePrompt } from '../db/queries.js';

export async function deleteCommand(id: string) {
  const db = require('../db/schema.js').getDb();
  const row = db.prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const res = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete "${chalk.bold(row.title)}"? This cannot be undone.`,
      default: false
    }
  ]);

  if (!res.confirm) {
    console.log(chalk.dim('\nCancelled.'));
    return;
  }

  const success = deletePrompt(row.id);
  
  if (success) {
    console.log(`\n${chalk.green('✓')} Deleted prompt successfully.`);
  } else {
    console.log(`\n${chalk.red('⚠')} Failed to delete prompt.`);
  }
}
