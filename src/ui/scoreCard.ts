import chalk from 'chalk';
import boxen from 'boxen';
import type { AnalysisRow } from '../db/queries.js';

export function getScoreColor(score: number): any {
  if (score >= 80) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

function renderProgressBar(score: number): string {
  const totalBlocks = 10;
  const filledBlocks = Math.round(score / 10);
  const emptyBlocks = totalBlocks - filledBlocks;
  return getScoreColor(score)('█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks));
}

function padRow(label: string, score: number): string {
  const lblStr = label.padEnd(23, ' ');
  const scoreStr = `${Math.round(score)} / 100`.padStart(9, ' ');
  return `${lblStr} ${scoreStr}  ${renderProgressBar(score)}`;
}

export function displayScoreCard(versionNum: number, analysis: AnalysisRow | any): void {
  const overalColor = getScoreColor(analysis.overall);
  
  let issuesArr: string[] = [];
  try {
    issuesArr = analysis.issues || JSON.parse(analysis.issues_json || '[]');
  } catch (e) {
    issuesArr = [];
  }

  let issuesText = '';
  if (issuesArr.length > 0) {
    issuesText = '\n  Issues found:\n' + issuesArr.map(i => `  ⚠ ${chalk.yellow(i)}`).join('\n');
  } else {
    issuesText = '\n  Issues found:\n  ' + chalk.green('✓ None detected');
  }

  // Format summary to wrap nicely
  const summaryLines = analysis.summary.match(/.{1,36}(\s|$)/g) || [];
  const wrappedSummary = summaryLines.map((line: string) => `  ${line.trim()}`).join('\n');

  const content = [
    `  ${chalk.bold('Overall Score'.padEnd(23))} ${overalColor(`${analysis.overall} / 100`.padStart(9))}  ${renderProgressBar(analysis.overall)}`,
    '',
    padRow('  Clarity', analysis.clarity),
    padRow('  Specificity', analysis.specificity),
    padRow('  Context', analysis.context_score),
    padRow('  Instruction Quality', analysis.instruction_quality),
    chalk.dim('├' + '─'.repeat(41) + '┤'),
    issuesText,
    chalk.dim('├' + '─'.repeat(41) + '┤'),
    `  Summary: \n${wrappedSummary}`
  ].join('\n');

  console.log('\n' + boxen(content, {
    padding: 0,
    margin: 1,
    borderStyle: 'single',
    borderColor: 'gray',
    title: `PromptVault Analysis — v${versionNum}`,
    titleAlignment: 'center'
  }) + '\n');
}
