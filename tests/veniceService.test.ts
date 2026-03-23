import { 
  scoreCommitsHeuristically, 
  isVeniceAvailable,
  ContributorCommits 
} from '../src/services/veniceService';

describe('VeniceService', () => {
  describe('isVeniceAvailable', () => {
    const originalEnv = process.env.VENICE_API_KEY;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.VENICE_API_KEY = originalEnv;
      } else {
        delete process.env.VENICE_API_KEY;
      }
    });

    it('should return false when VENICE_API_KEY is not set', () => {
      delete process.env.VENICE_API_KEY;
      expect(isVeniceAvailable()).toBe(false);
    });

    it('should return true when VENICE_API_KEY is set', () => {
      process.env.VENICE_API_KEY = 'test-key';
      expect(isVeniceAvailable()).toBe(true);
    });
  });

  describe('scoreCommitsHeuristically', () => {
    it('should score commits based on keywords', () => {
      const contributorCommits: ContributorCommits = {
        contributor: 'test@example.com',
        commits: [
          { hash: '1', message: 'fix: resolve crash on startup' },
          { hash: '2', message: 'feat: add new login feature' },
          { hash: '3', message: 'docs: update README' },
          { hash: '4', message: 'refactor: restructure auth module' },
          { hash: '5', message: 'style: fix formatting' },
        ]
      };

      const result = scoreCommitsHeuristically(contributorCommits);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.confidence).toBe(0.6);
      expect(result.breakdown).toHaveProperty('architectural');
      expect(result.breakdown).toHaveProperty('bugfix');
      expect(result.breakdown).toHaveProperty('feature');
      expect(result.breakdown).toHaveProperty('docs');
      expect(result.breakdown).toHaveProperty('formatting');
    });

    it('should handle empty commits array', () => {
      const contributorCommits: ContributorCommits = {
        contributor: 'test@example.com',
        commits: []
      };

      const result = scoreCommitsHeuristically(contributorCommits);

      expect(result.score).toBe(50);
      expect(result.confidence).toBe(0.3);
    });

    it('should give higher scores for architectural commits', () => {
      const architecturalCommits: ContributorCommits = {
        contributor: 'architect@example.com',
        commits: [
          { hash: '1', message: 'refactor: complete system redesign' },
          { hash: '2', message: 'architect: new module structure' },
          { hash: '3', message: 'migrate: upgrade to new framework' },
        ]
      };

      const formattingCommits: ContributorCommits = {
        contributor: 'formatter@example.com',
        commits: [
          { hash: '1', message: 'style: fix indentation' },
          { hash: '2', message: 'format: prettier run' },
          { hash: '3', message: 'lint: fix eslint errors' },
        ]
      };

      const archResult = scoreCommitsHeuristically(architecturalCommits);
      const formatResult = scoreCommitsHeuristically(formattingCommits);

      // Architectural commits should score higher
      expect(archResult.score).toBeGreaterThan(formatResult.score);
    });

    it('should categorize unknown commits as features', () => {
      const unknownCommits: ContributorCommits = {
        contributor: 'dev@example.com',
        commits: [
          { hash: '1', message: 'update something' },
          { hash: '2', message: 'change things' },
        ]
      };

      const result = scoreCommitsHeuristically(unknownCommits);
      
      // Should default to feature category
      expect(result.breakdown.feature).toBeGreaterThan(0);
    });
  });
});
