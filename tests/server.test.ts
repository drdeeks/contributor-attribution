import request from 'supertest';
import { app } from '../src/server';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Server API', () => {
  let testRepoPath: string;

  beforeAll(() => {
    // Create a temporary git repository for testing
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'api-test-'));
    
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    
    fs.writeFileSync(path.join(testRepoPath, 'file1.txt'), 'Hello World');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "feat: initial commit"', { cwd: testRepoPath });
    
    fs.writeFileSync(path.join(testRepoPath, 'file2.txt'), 'Another file');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "fix: add second file"', { cwd: testRepoPath });
  });

  afterAll(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('venice');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('POST /analyze', () => {
    it('should analyze a repository', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('totalContributors');
      expect(response.body).toHaveProperty('totalCommits');
      expect(response.body).toHaveProperty('contributionScores');
      expect(response.body.contributionScores.length).toBeGreaterThan(0);
    });

    it('should return error for missing repoPath', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should support aiEnabled option', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath, aiEnabled: true });
      
      expect(response.status).toBe(200);
      expect(response.body.aiAssessment).toHaveProperty('enabled');
    });
  });

  describe('POST /slice', () => {
    it('should generate slice config from analysis', async () => {
      // First get an analysis
      const analysisResponse = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath });
      
      const response = await request(app)
        .post('/slice')
        .send({ 
          analysis: analysisResponse.body,
          totalValue: 5000 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('totalValue', 5000);
      expect(response.body).toHaveProperty('contributors');
      expect(response.body.contributors.length).toBeGreaterThan(0);
      
      // Check shares add up to ~100%
      const totalShare = response.body.contributors.reduce(
        (sum: number, c: any) => sum + c.share, 
        0
      );
      expect(totalShare).toBeCloseTo(100, 0);
    });

    it('should return error for missing analysis', async () => {
      const response = await request(app)
        .post('/slice')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /merkle', () => {
    it('should generate merkle proofs', async () => {
      // First get an analysis
      const analysisResponse = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath });
      
      const response = await request(app)
        .post('/merkle')
        .send({ analysis: analysisResponse.body });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('root');
      expect(response.body).toHaveProperty('depth');
      expect(response.body).toHaveProperty('leafCount');
      expect(response.body).toHaveProperty('proofs');
      expect(response.body.root.length).toBe(64); // SHA256 hex
    });

    it('should return error for missing analysis', async () => {
      const response = await request(app)
        .post('/merkle')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /verify-merkle', () => {
    it('should verify valid merkle proof', async () => {
      // Get analysis and merkle proofs
      const analysisResponse = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath });
      
      const merkleResponse = await request(app)
        .post('/merkle')
        .send({ analysis: analysisResponse.body });
      
      // Get first contributor's proof
      const contributor = analysisResponse.body.contributionScores[0].contributor;
      const proof = merkleResponse.body.proofs[contributor];
      const score = analysisResponse.body.contributionScores[0];
      
      const response = await request(app)
        .post('/verify-merkle')
        .send({
          contribution: {
            contributor: score.contributor,
            score: score.score,
            timestamp: score.timestamp
          },
          proof,
          expectedRoot: merkleResponse.body.root
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('contribution', contributor);
    });
  });

  describe('PL_Genesis Integrations', () => {
    it('should include litSignature and worldIdVerified when World ID header present', async () => {
      const response = await request(app)
        .post('/analyze')
        .set('x-world-id-token', 'mock-world-id-token')
        .send({ repoPath: testRepoPath });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('litSignature');
      expect(response.body.litSignature).toMatch(/^lit_[a-f0-9]+/);
      expect(response.body).toHaveProperty('worldIdVerified', true);
    });

    it('should set worldIdVerified false when World ID header absent', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({ repoPath: testRepoPath });
      
      expect(response.status).toBe(200);
      if (response.body.worldIdVerified !== undefined) {
        expect(response.body.worldIdVerified).toBe(false);
      }
    });

    it('should sign agent log consistently', async () => {
      const response1 = await request(app)
        .post('/analyze')
        .set('x-world-id-token', 'test-token')
        .send({ repoPath: testRepoPath });
      
      const response2 = await request(app)
        .post('/analyze')
        .set('x-world-id-token', 'test-token')
        .send({ repoPath: testRepoPath });
      
      // Same input should produce same signature (deterministic mock)
      expect(response1.body.litSignature).toBe(response2.body.litSignature);
    });
  });
});
