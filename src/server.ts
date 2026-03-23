/**
 * REST API Server for Contributor Attribution Engine
 * Provides HTTP endpoints for analyzing repositories, generating Slice configs, and Merkle proofs
 */

import express, { Request, Response, NextFunction } from 'express';
import { GitAnalyzer } from './services/git-analyzer';
import { ContributionEngine } from './services/contribution-engine';
import { isVeniceAvailable } from './services/veniceService';
import { createContributionMerkleRoot, MerkleProof } from './utils/merkle';
import { logger } from './utils/logger';
import { ContributionAnalysis } from './types';
import * as path from 'path';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { 
    body: req.method === 'POST' ? Object.keys(req.body || {}) : undefined 
  });
  next();
});

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Request error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    venice: isVeniceAvailable(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * POST /analyze
 * Analyze a git repository
 * Body: { repoPath: string, aiEnabled?: boolean }
 */
app.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoPath, aiEnabled = false } = req.body;

    if (!repoPath || typeof repoPath !== 'string') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'repoPath is required and must be a string',
          timestamp: new Date().toISOString()
        }
      });
    }

    const absolutePath = path.resolve(repoPath);
    logger.info(`Analyzing repository: ${absolutePath}`, { aiEnabled });

    const analyzer = new GitAnalyzer(absolutePath);
    const repoAnalysis = await analyzer.analyze();

    const engine = new ContributionEngine({
      aiAssessment: {
        enabled: aiEnabled && isVeniceAvailable(),
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

    // Pass commits for Venice AI scoring
    const scores = await engine.computeScores(
      repoAnalysis.contributors, 
      totals,
      aiEnabled ? repoAnalysis.commits : undefined
    );

    const analysisId = `analysis-${Date.now()}`;
    const analysis: ContributionAnalysis = {
      id: analysisId,
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
        id: analysisId,
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
          enabled: aiEnabled && isVeniceAvailable(),
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
        enabled: aiEnabled && isVeniceAvailable(),
        model: 'llama-3.3-70b',
        confidence: 0.9,
        notes: aiEnabled && isVeniceAvailable() ? 'Venice AI scoring applied' : 'Heuristic scoring used'
      },
      metadata: {
        config: {} as any,
        version: '1.0.0',
        analysisVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /slice
 * Generate Slice payment configuration
 * Body: { analysis: ContributionAnalysis, totalValue?: number }
 */
app.post('/slice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysis, totalValue = 1000 } = req.body;

    if (!analysis || !analysis.contributionScores) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'analysis object with contributionScores is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const engine = new ContributionEngine();
    const sliceConfig = await engine.generateSliceConfig(analysis, totalValue);

    res.json(sliceConfig);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /merkle
 * Generate Merkle proofs for contributor scores
 * Body: { analysis: ContributionAnalysis }
 */
app.post('/merkle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysis } = req.body;

    if (!analysis || !analysis.contributionScores) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'analysis object with contributionScores is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Convert contribution scores to format for Merkle tree
    const contributions = analysis.contributionScores.map((score: any) => ({
      contributor: score.contributor,
      score: score.score,
      timestamp: new Date(score.timestamp)
    }));

    const { tree, root, proofs } = createContributionMerkleRoot(contributions);

    // Convert Map to object for JSON serialization
    const proofsObject: Record<string, MerkleProof> = {};
    proofs.forEach((proof, contributor) => {
      proofsObject[contributor] = proof;
    });

    res.json({
      root,
      depth: tree.getDepth(),
      leafCount: contributions.length,
      proofs: proofsObject,
      metadata: {
        analysisId: analysis.id,
        timestamp: new Date().toISOString(),
        algorithm: 'sha256'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /verify-merkle
 * Verify a Merkle proof
 * Body: { contribution: { contributor, score, timestamp }, proof: MerkleProof, expectedRoot: string }
 */
app.post('/verify-merkle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contribution, proof, expectedRoot } = req.body;

    if (!contribution || !proof || !expectedRoot) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'contribution, proof, and expectedRoot are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { verifyContributionProof } = require('./utils/merkle');
    
    const isValid = verifyContributionProof(
      {
        contributor: contribution.contributor,
        score: contribution.score,
        timestamp: new Date(contribution.timestamp)
      },
      proof,
      expectedRoot
    );

    res.json({
      valid: isValid,
      contribution: contribution.contributor,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Apply error handler
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || '3002', 10);

export function startServer(port: number = PORT): Promise<ReturnType<typeof app.listen>> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`Contributor Attribution API server running on port ${port}`);
      logger.info(`Venice AI: ${isVeniceAvailable() ? 'available' : 'not configured (VENICE_API_KEY not set)'}`);
      resolve(server);
    });
  });
}

// Start if run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export { app };
