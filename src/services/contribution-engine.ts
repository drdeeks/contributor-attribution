import { ContributionScore, ContributorMetrics, ContributionAnalysis, SlicePaymentConfig, TalentProtocolCredential } from '../types';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

export class ContributionEngine {
  private config: {
    weightFactors: {
      code: number;
      documentation: number;
      reviews: number;
      issues: number;
      community: number;
      impact: number;
    };
    timeDecay: {
      halfLife: number; // days
      maxWeight: number;
      minWeight: number;
    };
    normalization: {
      minScore: number;
      maxScore: number;
      defaultWeight: number;
    };
    aiAssessment: {
      enabled: boolean;
      model: string;
      confidenceThreshold: number;
    };
  };

  constructor(config?: Partial<typeof ContributionEngine.prototype.config>) {
    this.config = {
      weightFactors: {
        code: 0.4,
        documentation: 0.15,
        reviews: 0.15,
        issues: 0.1,
        community: 0.1,
        impact: 0.1
      },
      timeDecay: {
        halfLife: 365, // 1 year
        maxWeight: 1,
        minWeight: 0.1
      },
      normalization: {
        minScore: 0,
        maxScore: 100,
        defaultWeight: 1
      },
      aiAssessment: {
        enabled: false,
        model: 'claude-opus-4-5',
        confidenceThreshold: 0.7
      },
      ...config
    };
  }

  async computeScores(
    contributors: ContributorMetrics[],
    analysis: {
      totalCommits: number;
      totalAdditions: number;
      totalDeletions: number;
      totalFilesChanged: number;
      timespanDays: number;
    }
  ): Promise<ContributionScore[]> {
    logger.info('Computing contribution scores');

    const scores = contributors.map(contrib => {
      const timeDecay = this.calculateTimeDecay(contrib, analysis.timespanDays);
      const baseScore = this.calculateBaseScore(contrib, analysis);
      const weightedScore = baseScore * timeDecay;

      return {
        contributor: contrib.email,
        score: weightedScore,
        factors: {
          code: this.calculateCodeFactor(contrib, analysis),
          documentation: this.calculateDocumentationFactor(contrib),
          reviews: this.calculateReviewsFactor(contrib),
          issues: this.calculateIssuesFactor(contrib),
          community: this.calculateCommunityFactor(contrib),
          impact: this.calculateImpactFactor(contrib, analysis),
          recency: timeDecay
        },
        breakdown: {
          commits: contrib.totalCommits,
          linesAdded: contrib.additions,
          linesDeleted: contrib.deletions,
          filesChanged: contrib.filesChanged,
          issuesResolved: 0, // Would need issue data
          reviewsCompleted: 0 // Would need review data
        },
        aiAssessment: null,
        timestamp: new Date()
      };
    });

    return this.normalizeScores(scores);
  }

  private calculateTimeDecay(contrib: ContributorMetrics, timespanDays: number): number {
    if (!contrib.lastCommitDate || !contrib.firstCommitDate) {
      return this.config.timeDecay.minWeight;
    }

    const lastCommitDays = (Date.now() - contrib.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
    const contributionSpan = (contrib.lastCommitDate.getTime() - contrib.firstCommitDate.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay based on last commit
    const decay = Math.pow(0.5, lastCommitDays / this.config.timeDecay.halfLife);
    const minDecay = this.config.timeDecay.minWeight;
    const maxDecay = this.config.timeDecay.maxWeight;

    return Math.max(minDecay, Math.min(maxDecay, decay));
  }

  private calculateBaseScore(contrib: ContributorMetrics, analysis: any): number {
    const commitWeight = contrib.totalCommits / analysis.totalCommits;
    const additionsWeight = contrib.additions / analysis.totalAdditions;
    const deletionsWeight = contrib.deletions / analysis.totalDeletions;
    const filesWeight = contrib.filesChanged / analysis.totalFilesChanged;

    return (
      commitWeight * this.config.weightFactors.code +
      additionsWeight * this.config.weightFactors.code +
      deletionsWeight * this.config.weightFactors.code +
      filesWeight * this.config.weightFactors.code
    ) * 100;
  }

  private calculateCodeFactor(contrib: ContributorMetrics, analysis: any): number {
    const commitFactor = contrib.totalCommits / analysis.totalCommits;
    const linesFactor = (contrib.additions + contrib.deletions) / (analysis.totalAdditions + analysis.totalDeletions);
    const filesFactor = contrib.filesChanged / analysis.totalFilesChanged;

    return (
      commitFactor * 0.4 +
      linesFactor * 0.4 +
      filesFactor * 0.2
    ) * 100;
  }

  private calculateDocumentationFactor(contrib: ContributorMetrics): number {
    // Heuristic: check for documentation-related files
    const docFiles = contrib.filesChanged > 0 ? 0.1 : 0;
    const readmeCommits = contrib.totalCommits > 0 ? 0.05 : 0;
    return (docFiles + readmeCommits) * 100;
  }

  private calculateReviewsFactor(contrib: ContributorMetrics): number {
    // Would need actual review data - estimate based on commit patterns
    const reviewCommits = contrib.totalCommits > 50 ? 0.15 : 0;
    return reviewCommits * 100;
  }

  private calculateIssuesFactor(contrib: ContributorMetrics): number {
    // Would need actual issue data - estimate based on commit frequency
    const issueFactor = contrib.totalCommits > 100 ? 0.1 : 0;
    return issueFactor * 100;
  }

  private calculateCommunityFactor(contrib: ContributorMetrics): number {
    // Heuristic: longer active periods indicate community involvement
    const activeDays = contrib.activeDays || 0;
    const communityFactor = activeDays > 365 ? 0.1 : (activeDays / 3650);
    return communityFactor * 100;
  }

  private calculateImpactFactor(contrib: ContributorMetrics, analysis: any): number {
    // Simplified impact - files changed and lines modified
    const impact = (contrib.filesChanged / analysis.totalFilesChanged) * 0.5 +
                  ((contrib.additions + contrib.deletions) / (analysis.totalAdditions + analysis.totalDeletions)) * 0.5;
    return impact * 100;
  }

  private normalizeScores(scores: ContributionScore[]): ContributionScore[] {
    const minScore = this.config.normalization.minScore;
    const maxScore = this.config.normalization.maxScore;

    if (scores.length === 0) return scores;
    
    // Handle single contributor case
    if (scores.length === 1) {
      return scores.map(score => ({ ...score, score: maxScore }));
    }

    const maxRawScore = Math.max(...scores.map(s => s.score));
    const minRawScore = Math.min(...scores.map(s => s.score));
    
    // Handle case where all scores are equal
    if (maxRawScore === minRawScore) {
      return scores.map(score => ({ ...score, score: (minScore + maxScore) / 2 }));
    }

    return scores.map(score => {
      const normalized = ((score.score - minRawScore) / (maxRawScore - minRawScore)) * (maxScore - minScore) + minScore;
      return { ...score, score: normalized };
    });
  }

  async generateContributionReport(
    analysis: ContributionAnalysis,
    format: 'json' | 'yaml' | 'markdown' = 'json'
  ): Promise<string> {
    logger.info('Generating contribution report');

    switch (format) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      case 'yaml':
        // Simplified YAML generation
        return [
          'analysis:',
          `  id: ${analysis.id}`,
          `  repository: ${analysis.repository}`,
          `  analysisDate: ${analysis.analysisDate.toISOString()}`,
          '  totalContributors: ' + analysis.totalContributors,
          '  totalCommits: ' + analysis.totalCommits,
          '  contributionScores:',
          ...analysis.contributionScores.map(score => {
            return [
              `  - contributor: ${score.contributor}`,
              `    score: ${score.score.toFixed(2)}`,
              '    factors:',
              `      code: ${score.factors.code.toFixed(2)}`,
              `      documentation: ${score.factors.documentation.toFixed(2)}`,
              `      reviews: ${score.factors.reviews.toFixed(2)}`,
              `      issues: ${score.factors.issues.toFixed(2)}`,
              `      community: ${score.factors.community.toFixed(2)}`,
              `      impact: ${score.factors.impact.toFixed(2)}`,
              `      recency: ${score.factors.recency.toFixed(2)}`,
              '    breakdown:',
              `      commits: ${score.breakdown.commits}`,
              `      linesAdded: ${score.breakdown.linesAdded}`,
              `      linesDeleted: ${score.breakdown.linesDeleted}`,
              `      filesChanged: ${score.breakdown.filesChanged}`
            ].join('\n');
          })
        ].join('\n');
      case 'markdown':
        return [
          '# Contribution Analysis Report',
          `**Repository**: ${analysis.repository}`,
          `**Analysis Date**: ${analysis.analysisDate.toDateString()}`,
          `**Total Contributors**: ${analysis.totalContributors}`,
          `**Total Commits**: ${analysis.totalCommits}`,
          '',
          '## Contribution Scores',
          '| Contributor | Score | Code | Documentation | Reviews | Issues | Community | Impact | Recency |',
          '|-------------|-------|------|---------------|---------|--------|-----------|--------|---------|',
          ...analysis.contributionScores.map(score => {
            return `| ${score.contributor} | ${score.score.toFixed(2)} | ${score.factors.code.toFixed(2)} | ${score.factors.documentation.toFixed(2)} | ${score.factors.reviews.toFixed(2)} | ${score.factors.issues.toFixed(2)} | ${score.factors.community.toFixed(2)} | ${score.factors.impact.toFixed(2)} | ${score.factors.recency.toFixed(2)} |`;
          }),
          '',
          '## Summary',
          `Top Contributor: ${analysis.contributionScores[0]?.contributor || 'N/A'} (${analysis.contributionScores[0]?.score.toFixed(2) || 0})`,
          `Bottom Contributor: ${analysis.contributionScores[analysis.contributionScores.length - 1]?.contributor || 'N/A'} (${analysis.contributionScores[analysis.contributionScores.length - 1]?.score.toFixed(2) || 0})`
        ].join('\n');
    }
  }

  async generateSliceConfig(
    analysis: ContributionAnalysis,
    totalValue: number = 1000
  ): Promise<SlicePaymentConfig> {
    logger.info('Generating Slice payment configuration');

    const totalScore = analysis.contributionScores.reduce((sum, score) => sum + score.score, 0);
    const contributors = analysis.contributionScores.map(score => ({
      address: this.generateMockAddress(score.contributor),
      name: score.contributor,
      weight: score.score,
      share: totalScore > 0 ? (score.score / totalScore) * 100 : 0,
      role: 'contributor',
      contributionScore: score.score
    }));

    return {
      version: '1.0.0',
      totalValue,
      contributors,
      metadata: {
        analysisId: analysis.id,
        timestamp: new Date().toISOString(),
        repository: analysis.repository,
        version: '1.0.0',
        config: this.config
      }
    };
  }

  async generateTalentCredentials(
    analysis: ContributionAnalysis,
    sliceConfig: SlicePaymentConfig
  ): Promise<TalentProtocolCredential[]> {
    logger.info('Generating Talent Protocol credentials');

    return analysis.contributionScores.map(score => ({
      id: `cred-${Date.now()}-${score.contributor}`,
      type: 'ContributionCredential',
      issuer: 'https://talent.app',
      issued: new Date().toISOString(),
      claim: {
        contributor: {
          name: score.contributor,
          address: this.generateMockAddress(score.contributor),
          email: score.contributor.includes('@') ? score.contributor : `${score.contributor}@example.com`
        },
        contribution: {
          repository: analysis.repository,
          analysisId: analysis.id,
          totalScore: score.score,
          breakdown: score.factors,
          timestamp: new Date().toISOString(),
          sliceConfig: sliceConfig
        },
        verification: {
          analysisHash: this.hashContribution(analysis),
          contributionHash: this.hashScore(score),
          signedBy: ['contrib-attrib-1.0.0']
        }
      },
      proof: {
        type: 'JsonWebSignature2020',
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:example:123',
        signatureValue: this.signCredential(score.contributor, score.score)
      },
      metadata: {
        version: '1.0.0',
        source: 'contrib-attrib',
        analysisVersion: '1.0.0',
        sliceVersion: '1.0.0',
        talentVersion: '1.0.0'
      }
    }));
  }

  private generateMockAddress(contributor: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(contributor)
      .digest('hex');
    return `0x${hash.substring(0, 40)}`;
  }

  private hashContribution(analysis: ContributionAnalysis): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(analysis))
      .digest('hex');
  }

  private hashScore(score: ContributionScore): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(score))
      .digest('hex');
  }

  private signCredential(contributor: string, score: number): string {
    // Simplified signing - in production would use actual cryptographic signing
    return crypto
      .createHmac('sha256', 'secret-key')
      .update(`${contributor}:${score}`)
      .digest('hex');
  }
}
