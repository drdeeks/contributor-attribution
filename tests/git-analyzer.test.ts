import { GitAnalyzer } from '../src/services/git-analyzer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

describe('GitAnalyzer', () => {
  let testRepoPath: string;

  beforeAll(() => {
    // Create a temporary git repository for testing
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    
    // Create some test files and commits
    fs.writeFileSync(path.join(testRepoPath, 'file1.txt'), 'Hello World');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
    
    fs.writeFileSync(path.join(testRepoPath, 'file2.txt'), 'Another file');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "Add second file"', { cwd: testRepoPath });
  });

  afterAll(() => {
    // Clean up test repository
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('analyze', () => {
    it('should analyze a git repository', async () => {
      const analyzer = new GitAnalyzer(testRepoPath);
      const analysis = await analyzer.analyze();

      expect(analysis).toHaveProperty('repository', testRepoPath);
      expect(analysis).toHaveProperty('totalCommits');
      expect(analysis.totalCommits).toBeGreaterThanOrEqual(2);
      expect(analysis).toHaveProperty('branches');
      expect(analysis).toHaveProperty('contributors');
      expect(analysis).toHaveProperty('commits');
      expect(analysis).toHaveProperty('timespan');
    });

    it('should detect contributors', async () => {
      const analyzer = new GitAnalyzer(testRepoPath);
      const analysis = await analyzer.analyze();

      expect(analysis.contributors).toHaveLength(1);
      expect(analysis.contributors[0]).toHaveProperty('email', 'test@example.com');
      expect(analysis.contributors[0]).toHaveProperty('name', 'Test User');
      expect(analysis.contributors[0]).toHaveProperty('totalCommits');
      expect(analysis.contributors[0].totalCommits).toBeGreaterThanOrEqual(2);
    });

    it('should parse commit data', async () => {
      const analyzer = new GitAnalyzer(testRepoPath);
      const analysis = await analyzer.analyze();

      expect(analysis.commits.length).toBeGreaterThanOrEqual(2);
      
      const commit = analysis.commits[0];
      expect(commit).toHaveProperty('hash');
      expect(commit).toHaveProperty('author');
      expect(commit.author).toHaveProperty('name');
      expect(commit.author).toHaveProperty('email');
      expect(commit).toHaveProperty('date');
      expect(commit).toHaveProperty('message');
    });

    it('should compute contributor metrics', async () => {
      const analyzer = new GitAnalyzer(testRepoPath);
      const analysis = await analyzer.analyze();

      const contributor = analysis.contributors[0];
      expect(contributor).toHaveProperty('additions');
      expect(contributor).toHaveProperty('deletions');
      expect(contributor).toHaveProperty('activeDays');
      expect(contributor).toHaveProperty('filesChanged');
    });
  });
});
