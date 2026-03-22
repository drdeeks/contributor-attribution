import { ContributionEngine } from '../src/services/contribution-engine';
import { ContributorMetrics } from '../src/types';

describe('ContributionEngine', () => {
  let engine: ContributionEngine;

  beforeEach(() => {
    engine = new ContributionEngine();
  });

  describe('computeScores', () => {
    it('should compute contribution scores for contributors', async () => {
      const contributors: ContributorMetrics[] = [
        {
          name: 'Alice',
          email: 'alice@example.com',
          totalCommits: 100,
          additions: 5000,
          deletions: 1000,
          activeDays: 365,
          filesChanged: 50,
          firstCommitDate: new Date('2023-01-01'),
          lastCommitDate: new Date('2024-01-01')
        },
        {
          name: 'Bob',
          email: 'bob@example.com',
          totalCommits: 50,
          additions: 2500,
          deletions: 500,
          activeDays: 180,
          filesChanged: 25,
          firstCommitDate: new Date('2023-06-01'),
          lastCommitDate: new Date('2024-01-01')
        }
      ];

      const analysis = {
        totalCommits: 150,
        totalAdditions: 7500,
        totalDeletions: 1500,
        totalFilesChanged: 75,
        timespanDays: 365
      };

      const scores = await engine.computeScores(contributors, analysis);

      expect(scores).toHaveLength(2);
      expect(scores[0]).toHaveProperty('contributor');
      expect(scores[0]).toHaveProperty('score');
      expect(scores[0]).toHaveProperty('factors');
      expect(scores[0]).toHaveProperty('breakdown');
    });

    it('should normalize scores between 0 and 100', async () => {
      const contributors: ContributorMetrics[] = [
        {
          name: 'Alice',
          email: 'alice@example.com',
          totalCommits: 100,
          additions: 5000,
          deletions: 1000,
          activeDays: 365,
          filesChanged: 50,
          firstCommitDate: new Date('2023-01-01'),
          lastCommitDate: new Date('2024-01-01')
        }
      ];

      const analysis = {
        totalCommits: 100,
        totalAdditions: 5000,
        totalDeletions: 1000,
        totalFilesChanged: 50,
        timespanDays: 365
      };

      const scores = await engine.computeScores(contributors, analysis);

      scores.forEach(score => {
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('generateSliceConfig', () => {
    it('should generate valid slice payment configuration', async () => {
      const mockAnalysis = {
        id: 'test-analysis',
        repository: '/test/repo',
        analysisDate: new Date(),
        totalContributors: 2,
        totalCommits: 100,
        totalAdditions: 5000,
        totalDeletions: 1000,
        contributionScores: [
          {
            contributor: 'alice@example.com',
            score: 60,
            factors: { code: 50, documentation: 10, reviews: 5, issues: 5, community: 5, impact: 10, recency: 0.8 },
            breakdown: { commits: 60, linesAdded: 3000, linesDeleted: 600, filesChanged: 30, issuesResolved: 0, reviewsCompleted: 0 },
            timestamp: new Date()
          },
          {
            contributor: 'bob@example.com',
            score: 40,
            factors: { code: 30, documentation: 5, reviews: 3, issues: 2, community: 3, impact: 5, recency: 0.6 },
            breakdown: { commits: 40, linesAdded: 2000, linesDeleted: 400, filesChanged: 20, issuesResolved: 0, reviewsCompleted: 0 },
            timestamp: new Date()
          }
        ],
        normalizedScores: [],
        weightedScores: [],
        sliceConfig: {} as any,
        talentCredentials: [],
        aiAssessment: { enabled: false, model: 'test', confidence: 1, notes: '' },
        metadata: { config: {} as any, version: '1.0.0', analysisVersion: '1.0.0', timestamp: new Date().toISOString() }
      };

      const sliceConfig = await engine.generateSliceConfig(mockAnalysis, 1000);

      expect(sliceConfig).toHaveProperty('version');
      expect(sliceConfig).toHaveProperty('totalValue', 1000);
      expect(sliceConfig).toHaveProperty('contributors');
      expect(sliceConfig.contributors).toHaveLength(2);
      
      // Check that shares add up to approximately 100%
      const totalShare = sliceConfig.contributors.reduce((sum, c) => sum + c.share, 0);
      expect(totalShare).toBeCloseTo(100, 0);
    });
  });

  describe('generateTalentCredentials', () => {
    it('should generate valid verifiable credentials', async () => {
      const mockAnalysis = {
        id: 'test-analysis',
        repository: '/test/repo',
        analysisDate: new Date(),
        totalContributors: 1,
        totalCommits: 50,
        totalAdditions: 2500,
        totalDeletions: 500,
        contributionScores: [
          {
            contributor: 'alice@example.com',
            score: 100,
            factors: { code: 80, documentation: 10, reviews: 5, issues: 5, community: 5, impact: 15, recency: 1 },
            breakdown: { commits: 50, linesAdded: 2500, linesDeleted: 500, filesChanged: 25, issuesResolved: 0, reviewsCompleted: 0 },
            timestamp: new Date()
          }
        ],
        normalizedScores: [],
        weightedScores: [],
        sliceConfig: {} as any,
        talentCredentials: [],
        aiAssessment: { enabled: false, model: 'test', confidence: 1, notes: '' },
        metadata: { config: {} as any, version: '1.0.0', analysisVersion: '1.0.0', timestamp: new Date().toISOString() }
      };

      const sliceConfig = await engine.generateSliceConfig(mockAnalysis);
      const credentials = await engine.generateTalentCredentials(mockAnalysis, sliceConfig);

      expect(credentials).toHaveLength(1);
      expect(credentials[0]).toHaveProperty('id');
      expect(credentials[0]).toHaveProperty('type', 'ContributionCredential');
      expect(credentials[0]).toHaveProperty('issuer');
      expect(credentials[0]).toHaveProperty('claim');
      expect(credentials[0]).toHaveProperty('proof');
      expect(credentials[0].proof).toHaveProperty('signatureValue');
    });
  });

  describe('generateContributionReport', () => {
    it('should generate JSON report', async () => {
      const mockAnalysis = {
        id: 'test-analysis',
        repository: '/test/repo',
        analysisDate: new Date(),
        totalContributors: 1,
        totalCommits: 50,
        totalAdditions: 2500,
        totalDeletions: 500,
        contributionScores: [
          {
            contributor: 'alice@example.com',
            score: 100,
            factors: { code: 80, documentation: 10, reviews: 5, issues: 5, community: 5, impact: 15, recency: 1 },
            breakdown: { commits: 50, linesAdded: 2500, linesDeleted: 500, filesChanged: 25, issuesResolved: 0, reviewsCompleted: 0 },
            timestamp: new Date()
          }
        ],
        normalizedScores: [],
        weightedScores: [],
        sliceConfig: {} as any,
        talentCredentials: [],
        aiAssessment: { enabled: false, model: 'test', confidence: 1, notes: '' },
        metadata: { config: {} as any, version: '1.0.0', analysisVersion: '1.0.0', timestamp: new Date().toISOString() }
      };

      const report = await engine.generateContributionReport(mockAnalysis, 'json');
      
      expect(() => JSON.parse(report)).not.toThrow();
      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('id', 'test-analysis');
    });

    it('should generate Markdown report', async () => {
      const mockAnalysis = {
        id: 'test-analysis',
        repository: '/test/repo',
        analysisDate: new Date(),
        totalContributors: 1,
        totalCommits: 50,
        totalAdditions: 2500,
        totalDeletions: 500,
        contributionScores: [
          {
            contributor: 'alice@example.com',
            score: 100,
            factors: { code: 80, documentation: 10, reviews: 5, issues: 5, community: 5, impact: 15, recency: 1 },
            breakdown: { commits: 50, linesAdded: 2500, linesDeleted: 500, filesChanged: 25, issuesResolved: 0, reviewsCompleted: 0 },
            timestamp: new Date()
          }
        ],
        normalizedScores: [],
        weightedScores: [],
        sliceConfig: {} as any,
        talentCredentials: [],
        aiAssessment: { enabled: false, model: 'test', confidence: 1, notes: '' },
        metadata: { config: {} as any, version: '1.0.0', analysisVersion: '1.0.0', timestamp: new Date().toISOString() }
      };

      const report = await engine.generateContributionReport(mockAnalysis, 'markdown');
      
      expect(report).toContain('# Contribution Analysis Report');
      expect(report).toContain('/test/repo');
      expect(report).toContain('alice@example.com');
    });
  });
});
