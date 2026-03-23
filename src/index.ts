export { GitAnalyzer } from './services/git-analyzer';
export { ContributionEngine } from './services/contribution-engine';
export { 
  isVeniceAvailable, 
  scoreCommitsWithVenice, 
  scoreCommitsHeuristically,
  batchScoreContributors 
} from './services/veniceService';
export { app, startServer } from './server';
export * from './types';
export * from './utils/merkle';
export { logger } from './utils/logger';
