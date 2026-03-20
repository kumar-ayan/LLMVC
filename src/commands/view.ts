import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import { getPrompt, getLatestVersion } from '../db/queries.js';
import { marked } from 'marked';
// @ts-ignore
import TerminalRenderer from 'marked-terminal';
import { sanitizeForTerminal } from '../utils/terminal.js';

// Setup marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer()
});

export async function viewCommand(id: string) {
  // Find full ID based on prefix if short ID provided

  const row = getDb().prepare('SELECT id FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string } | undefined;

  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID starting with "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const prompt = getPrompt(promptId);
  const version = getLatestVersion(promptId);

  if (!prompt || !version) {
    console.log(chalk.red('⚠ Error loading prompt details.'));
    return;
  }

  console.log('\n' + chalk.bold(sanitizeForTerminal(prompt.title)));
  if (prompt.description) console.log(chalk.dim(sanitizeForTerminal(prompt.description)));
  if (prompt.tags) console.log(chalk.blue(sanitizeForTerminal(prompt.tags)));

  console.log(chalk.dim(`\n--- v${version.version_num} ---`));

  // Render markdown after stripping terminal control sequences from stored content.
  const mdText = marked.parse(sanitizeForTerminal(version.text)) as string;
  console.log(mdText);
}
