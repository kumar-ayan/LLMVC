import chalk from 'chalk';
import {
  getLatestPromptScores,
  getMostImprovedPrompt,
  getVaultCounts,
  type PromptScoreSummary
} from '../db/queries.js';
import { getScoreColor } from '../ui/scoreCard.js';
import { sanitizeForTerminal } from '../utils/terminal.js';

interface ScoreBucket {
  label: string;
  min: number;
  max: number;
}

const SCORE_BUCKETS: ScoreBucket[] = [
  { label: '00-19', min: 0, max: 19 },
  { label: '20-39', min: 20, max: 39 },
  { label: '40-59', min: 40, max: 59 },
  { label: '60-79', min: 60, max: 79 },
  { label: '80-100', min: 80, max: 100 }
];

function formatScore(score: number | null): string {
  if (score === null) {
    return chalk.dim('n/a');
  }

  const rounded = Math.round(score * 100) / 100;
  return getScoreColor(score)(`${rounded}/100`);
}

function renderDistribution(scores: number[]): string[] {
  const maxCount = Math.max(...SCORE_BUCKETS.map(bucket => scores.filter(score => score >= bucket.min && score <= bucket.max).length), 1);

  return SCORE_BUCKETS.map(bucket => {
    const count = scores.filter(score => score >= bucket.min && score <= bucket.max).length;
    const barLength = count === 0 ? 0 : Math.max(1, Math.round((count / maxCount) * 20));
    const bar = count === 0 ? '' : '#'.repeat(barLength);
    return `${bucket.label.padEnd(6)}| ${chalk.cyan(bar.padEnd(20))} ${chalk.dim(`(${count})`)}`;
  });
}

function renderTopPromptLine(prompt: PromptScoreSummary, index: number): string {
  const safeTitle = sanitizeForTerminal(prompt.title);
  const shortId = prompt.id.split('-')[0];
  return `${index + 1}. ${chalk.bold(safeTitle)} ${chalk.dim(`#${shortId}`)}  ${formatScore(prompt.latest_score)}`;
}

export async function statsCommand() {
  const counts = getVaultCounts();
  const latestScores = getLatestPromptScores();
  const scoredPrompts = latestScores.filter(prompt => prompt.latest_score !== null);
  const numericScores = scoredPrompts.map(prompt => prompt.latest_score as number);
  const averageScore = numericScores.length > 0
    ? numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
    : null;
  const topPrompts = scoredPrompts.slice(0, 3);
  const mostImproved = getMostImprovedPrompt();

  console.log(`\n${chalk.bold('PromptVault Stats')}`);
  console.log(chalk.dim('Vault-wide analytics from local SQLite data only.\n'));

  console.log(chalk.cyan('Overview'));
  console.log(`Prompts:       ${chalk.bold(counts.prompt_count.toString())}`);
  console.log(`Versions:      ${chalk.bold(counts.version_count.toString())}`);
  console.log(`Evals run:     ${chalk.bold(counts.eval_run_count.toString())}`);
  console.log(`Avg score:     ${averageScore === null ? chalk.dim('n/a') : formatScore(averageScore)}`);

  console.log(`\n${chalk.cyan('Top 3 Highest Scored')}`);
  if (topPrompts.length === 0) {
    console.log(chalk.dim('No scored prompts yet.'));
  } else {
    topPrompts.forEach((prompt, index) => console.log(renderTopPromptLine(prompt, index)));
  }

  console.log(`\n${chalk.cyan('Most Improved')}`);
  if (!mostImproved) {
    console.log(chalk.dim('Not enough scored history yet.'));
  } else {
    const safeTitle = sanitizeForTerminal(mostImproved.title);
    const delta = mostImproved.latest_score - mostImproved.first_score;
    const deltaColor = delta >= 0 ? chalk.green : chalk.red;
    console.log(`${chalk.bold(safeTitle)}  ${deltaColor(`${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`)}`);
    console.log(chalk.dim(`v1 ${mostImproved.first_score.toFixed(2)} -> latest ${mostImproved.latest_score.toFixed(2)}`));
  }

  console.log(`\n${chalk.cyan('Score Distribution')}`);
  if (numericScores.length === 0) {
    console.log(chalk.dim('No scores to chart yet.'));
  } else {
    renderDistribution(numericScores).forEach(line => console.log(line));
  }

  console.log('');
}
