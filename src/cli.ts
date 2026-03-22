#!/usr/bin/env node

import { Command } from 'commander';
import { GitAnalyzer } from './services/git-analyzer';
import { ContributionEngine } from './services/contribution-engine';
import { logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('contrib-attrib')
  .description('Contributor Attribution Engine - Analyze git repos and compute fair contribution weights')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a git repository for contribution metrics')
  .argument('<path>', 'Path to the git repository')
  .option('-o, --output <file>', 'Output file for results')
  .option('-f, --format <format>', 'Output format (json|yaml|markdown)', 'json')
  .option('--ai', 'Enable AI-powered assessment (requires VENICE_API_KEY)')
  .action(async (repoPath: string, options: { output?: string; format?: string; ai?: boolean }) => {
    try {
      const absolutePath = path.resolve(repoPath);
      logger.info(`Analyzing repository: ${absolutePath}`);

      const analyzer = new GitAnalyzer(absolutePath);
      const repoAnalysis = await analyzer.analyze();

      const engine = new ContributionEngine({
        aiAssessment: {
          enabled: options.ai ?? false,
          model: 'llama-3.3-70b',
          confidenceThreshold: 0.7
        }
      });

      // Calculate totals for scoring
      const totals = {
        totalCommits: repoAnalysis.totalCommits,
        totalAdditions: repoAnalysis.contributors.reduce((sum, c) => sum + c.additions, 0),
        totalDeletions: repoAnalysis.contributors.reduce((sum, c) => sum + c.deletions, 0),
        totalFilesChanged: repoAnalysis.contributors.reduce((sum, c) => sum + c.filesChanged, 0),
        timespanDays: repoAnalysis.timespan.firstCommit && repoAnalysis.timespan.lastCommit
          ? Math.ceil((repoAnalysis.timespan.lastCommit.getTime() - repoAnalysis.timespan.firstCommit.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      };

      const scores = await engine.computeScores(repoAnalysis.contributors, totals);

      const analysis = {
        id: `analysis-${Date.now()}`,
        repository: absolutePath,
        analysisDate: new Date(),
        totalContributors: repoAnalysis.contributors.length,
        totalCommits: repoAnalysis.totalCommits,
        totalAdditions: totals.totalAdditions,
        totalDeletions: totals.totalDeletions,
        contributionScores: scores,
        normalizedScores: scores,
        weightedScores: scores,
        sliceConfig: await engine.generateSliceConfig({
          id: `analysis-${Date.now()}`,
          repository: absolutePath,
          analysisDate: new Date(),
          totalContributors: repoAnalysis.contributors.length,
          totalCommits: repoAnalysis.totalCommits,
          totalAdditions: totals.totalAdditions,
          totalDeletions: totals.totalDeletions,
          contributionScores: scores,
          normalizedScores: scores,
          weightedScores: scores,
          sliceConfig: {} as any,
          talentCredentials: [],
          aiAssessment: {
            enabled: options.ai ?? false,
            model: 'llama-3.3-70b',
            confidence: 0.9,
            notes: 'Analysis complete'
          },
          metadata: {
            config: {} as any,
            version: '1.0.0',
            analysisVersion: '1.0.0',
            timestamp: new Date().toISOString()
          }
        }),
        talentCredentials: [],
        aiAssessment: {
          enabled: options.ai ?? false,
          model: 'llama-3.3-70b',
          confidence: 0.9,
          notes: 'Analysis complete'
        },
        metadata: {
          config: {} as any,
          version: '1.0.0',
          analysisVersion: '1.0.0',
          timestamp: new Date().toISOString()
        }
      };

      const report = await engine.generateContributionReport(analysis, options.format as 'json' | 'yaml' | 'markdown');

      if (options.output) {
        fs.writeFileSync(options.output, report);
        logger.info(`Report written to ${options.output}`);
      } else {
        console.log(report);
      }

      // Summary
      console.log('\n=== Contribution Summary ===');
      scores.slice(0, 10).forEach((score, i) => {
        console.log(`${i + 1}. ${score.contributor}: ${score.score.toFixed(2)} points`);
      });

    } catch (error) {
      logger.error('Analysis failed', error);
      process.exit(1);
    }
  });

program
  .command('slice')
  .description('Generate Slice payment splitter configuration')
  .argument('<analysis-file>', 'Path to analysis JSON file')
  .option('-v, --value <amount>', 'Total value to distribute', '1000')
  .option('-o, --output <file>', 'Output file for Slice config')
  .action(async (analysisFile: string, options: { value?: string; output?: string }) => {
    try {
      const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf-8'));
      const engine = new ContributionEngine();
      
      const sliceConfig = await engine.generateSliceConfig(analysis, parseInt(options.value ?? '1000'));

      const output = JSON.stringify(sliceConfig, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, output);
        logger.info(`Slice config written to ${options.output}`);
      } else {
        console.log(output);
      }

    } catch (error) {
      logger.error('Slice config generation failed', error);
      process.exit(1);
    }
  });

program
  .command('credentials')
  .description('Generate Talent Protocol verifiable credentials')
  .argument('<analysis-file>', 'Path to analysis JSON file')
  .option('-o, --output <file>', 'Output file for credentials')
  .action(async (analysisFile: string, options: { output?: string }) => {
    try {
      const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf-8'));
      const engine = new ContributionEngine();
      
      const sliceConfig = await engine.generateSliceConfig(analysis);
      const credentials = await engine.generateTalentCredentials(analysis, sliceConfig);

      const output = JSON.stringify(credentials, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, output);
        logger.info(`Credentials written to ${options.output}`);
      } else {
        console.log(output);
      }

    } catch (error) {
      logger.error('Credential generation failed', error);
      process.exit(1);
    }
  });

program.parse();
