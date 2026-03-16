import { getDb } from '../db/schema.js';
import chalk from 'chalk';
import ora from 'ora';
import { getLatestVersion, saveAnalysis } from '../db/queries.js';
import { analyzePrompt } from '../ai/analyzer.js';
import { displayScoreCard } from '../ui/scoreCard.js';

export async function analyzeCommand(id: string) {

  const row = getDb().prepare('SELECT id, title FROM prompts WHERE id LIKE ?').get(`${id}%`) as { id: string, title: string } | undefined;
  
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

  console.log(`Analyzing: ${chalk.bold(row.title)} (v${version.version_num})`);

  const spinner = ora('AI is grading your prompt...').start();
  try {
    const analysis = await analyzePrompt(version.text);
    spinner.succeed('Analysis complete');
    
    // Save to DB
    saveAnalysis(version.id, {
      clarity: analysis.clarity,
      specificity: analysis.specificity,
      context_score: analysis.context_score,
      instruction_quality: analysis.instruction_quality,
      overall: analysis.overall,
      issues_json: JSON.stringify(analysis.issues),
      summary: analysis.summary
    });

    displayScoreCard(version.version_num, analysis);
  } catch (err: any) {
    spinner.fail('Analysis failed');
    console.log(chalk.red(`⚠ ${err.message}`));
  }
}
