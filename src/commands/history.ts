import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import { getPrompt, getVersions, getLatestAnalysis } from '../db/queries.js';
import Table from 'cli-table3';
import { formatTimeAgo } from '../utils/time.js';
import { getScoreColor } from '../ui/scoreCard.js';

export async function historyCommand(id: string) {

  const row = getDb().prepare('SELECT id FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string } | undefined;
  
  if (!row) {
    console.log(chalk.red(`⚠ Prompt with ID "${id}" not found.`));
    return;
  }

  const promptId = row.id;
  const prompt = getPrompt(promptId);
  const versions = getVersions(promptId);

  if (!prompt) return;

  console.log(`\nHistory for: ${chalk.bold(prompt.title)} (${chalk.dim(promptId.split('-')[0])})`);

  const table = new Table({
    head: [chalk.cyan('Version'), chalk.cyan('Score'), chalk.cyan('Date'), chalk.cyan('Lines')],
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': '  '
    },
    style: { 'padding-left': 0, 'padding-right': 0 }
  });

  for (const v of versions) {
    const analysis = getLatestAnalysis(v.id);
    let scoreStr = chalk.dim('-');
    if (analysis) {
      scoreStr = getScoreColor(analysis.overall)(analysis.overall.toString());
    }
    
    const linesCount = v.text.split('\n').length;
    const dateStr = chalk.dim(formatTimeAgo(v.created_at));

    table.push([`v${v.version_num}`, scoreStr, dateStr, chalk.dim(`${linesCount} lines`)]);
  }

  console.log('\n' + table.toString() + '\n');
}
