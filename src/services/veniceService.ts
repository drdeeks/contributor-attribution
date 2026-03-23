/**
 * Venice AI Service
 * Provides AI-powered commit quality scoring using Venice AI's OpenAI-compatible API
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

export interface VeniceScoreBreakdown {
  architectural: number;  // 5x multiplier
  bugfix: number;         // 4x multiplier
  feature: number;        // 3x multiplier
  docs: number;           // 2x multiplier
  formatting: number;     // 1x multiplier
}

export interface VeniceAssessment {
  score: number;
  breakdown: VeniceScoreBreakdown;
  confidence: number;
  reasoning?: string;
}

export interface CommitData {
  hash: string;
  message: string;
  files?: string[];
  additions?: number;
  deletions?: number;
}

export interface ContributorCommits {
  contributor: string;
  commits: CommitData[];
}

const VENICE_API_ENDPOINT = 'https://api.venice.ai/api/v1/chat/completions';
const VENICE_MODEL = 'llama-3.3-70b';

const QUALITY_MULTIPLIERS = {
  architectural: 5,
  bugfix: 4,
  feature: 3,
  docs: 2,
  formatting: 1
};

/**
 * Check if Venice AI is available (API key set)
 */
export function isVeniceAvailable(): boolean {
  return !!process.env.VENICE_API_KEY;
}

/**
 * Score commits using Venice AI
 */
export async function scoreCommitsWithVenice(
  contributorCommits: ContributorCommits
): Promise<VeniceAssessment> {
  const apiKey = process.env.VENICE_API_KEY;
  
  if (!apiKey) {
    logger.warn('VENICE_API_KEY not set, falling back to heuristic scoring');
    return scoreCommitsHeuristically(contributorCommits);
  }

  try {
    const prompt = buildScoringPrompt(contributorCommits);
    
    const response = await axios.post(
      VENICE_API_ENDPOINT,
      {
        model: VENICE_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
      logger.warn('Empty response from Venice AI, falling back to heuristic');
      return scoreCommitsHeuristically(contributorCommits);
    }

    return parseVeniceResponse(content, contributorCommits);
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('Venice AI request failed', {
      status: axiosError.response?.status,
      message: axiosError.message
    });
    
    // Graceful fallback
    return scoreCommitsHeuristically(contributorCommits);
  }
}

/**
 * Build the prompt for Venice AI to score commits
 */
function buildScoringPrompt(contributorCommits: ContributorCommits): string {
  const commitSummary = contributorCommits.commits
    .slice(0, 50) // Limit to prevent token overflow
    .map((c, i) => `${i + 1}. ${c.message}${c.files?.length ? ` [${c.files.length} files]` : ''}`)
    .join('\n');

  return `Analyze these git commits from contributor "${contributorCommits.contributor}" and score their quality across these categories:

CATEGORIES (with impact multipliers):
- architectural: Major design decisions, refactoring, system architecture (5x impact)
- bugfix: Bug fixes, error handling improvements, crash fixes (4x impact)
- feature: New features, functionality additions (3x impact)
- docs: Documentation, comments, README updates (2x impact)
- formatting: Code style, formatting, whitespace changes (1x impact)

COMMITS:
${commitSummary}

TASK: Estimate what percentage (0-100) of these commits fall into each category. The percentages should sum to 100.

Respond in this exact JSON format:
{
  "architectural": <0-100>,
  "bugfix": <0-100>,
  "feature": <0-100>,
  "docs": <0-100>,
  "formatting": <0-100>,
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Only output the JSON, nothing else.`;
}

/**
 * Parse Venice AI response into VeniceAssessment
 */
function parseVeniceResponse(
  content: string,
  contributorCommits: ContributorCommits
): VeniceAssessment {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    const breakdown: VeniceScoreBreakdown = {
      architectural: Math.max(0, Math.min(100, parsed.architectural ?? 0)),
      bugfix: Math.max(0, Math.min(100, parsed.bugfix ?? 0)),
      feature: Math.max(0, Math.min(100, parsed.feature ?? 0)),
      docs: Math.max(0, Math.min(100, parsed.docs ?? 0)),
      formatting: Math.max(0, Math.min(100, parsed.formatting ?? 0))
    };

    // Calculate weighted score
    const score = calculateWeightedScore(breakdown);
    
    return {
      score,
      breakdown,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.8)),
      reasoning: parsed.reasoning
    };
  } catch (parseError) {
    logger.warn('Failed to parse Venice response, using heuristic', { parseError });
    return scoreCommitsHeuristically(contributorCommits);
  }
}

/**
 * Calculate weighted score from breakdown
 */
function calculateWeightedScore(breakdown: VeniceScoreBreakdown): number {
  const weightedSum = 
    breakdown.architectural * QUALITY_MULTIPLIERS.architectural +
    breakdown.bugfix * QUALITY_MULTIPLIERS.bugfix +
    breakdown.feature * QUALITY_MULTIPLIERS.feature +
    breakdown.docs * QUALITY_MULTIPLIERS.docs +
    breakdown.formatting * QUALITY_MULTIPLIERS.formatting;
  
  // Normalize to 0-100 scale (max possible = 100 * 5 = 500)
  const maxPossible = 100 * QUALITY_MULTIPLIERS.architectural;
  return Math.min(100, (weightedSum / maxPossible) * 100);
}

/**
 * Fallback heuristic scoring based on commit message keywords
 */
export function scoreCommitsHeuristically(
  contributorCommits: ContributorCommits
): VeniceAssessment {
  const categories = {
    architectural: 0,
    bugfix: 0,
    feature: 0,
    docs: 0,
    formatting: 0
  };

  const patterns = {
    architectural: /\b(refactor|architect|design|restructure|rewrite|overhaul|migrate|upgrade|modular|decouple|abstract)\b/i,
    bugfix: /\b(fix|bug|error|crash|issue|resolve|patch|hotfix|repair|correct|handle|catch)\b/i,
    feature: /\b(feat|feature|add|implement|new|create|introduce|support|enable|allow)\b/i,
    docs: /\b(doc|docs|readme|comment|documentation|explain|describe|update\s+readme|changelog)\b/i,
    formatting: /\b(format|style|lint|whitespace|indent|prettier|eslint|cleanup|clean\s*up|typo)\b/i
  };

  const commits = contributorCommits.commits;
  const total = commits.length;

  if (total === 0) {
    return {
      score: 50,
      breakdown: { architectural: 20, bugfix: 20, feature: 20, docs: 20, formatting: 20 },
      confidence: 0.3
    };
  }

  commits.forEach(commit => {
    const msg = commit.message.toLowerCase();
    let matched = false;

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(msg)) {
        categories[category as keyof typeof categories]++;
        matched = true;
        break; // One category per commit
      }
    }

    // Default to feature if no pattern matched
    if (!matched) {
      categories.feature++;
    }
  });

  // Convert counts to percentages
  const breakdown: VeniceScoreBreakdown = {
    architectural: Math.round((categories.architectural / total) * 100),
    bugfix: Math.round((categories.bugfix / total) * 100),
    feature: Math.round((categories.feature / total) * 100),
    docs: Math.round((categories.docs / total) * 100),
    formatting: Math.round((categories.formatting / total) * 100)
  };

  // Normalize to ensure sum is 100
  const sum = breakdown.architectural + breakdown.bugfix + breakdown.feature + breakdown.docs + breakdown.formatting;
  if (sum !== 100 && sum > 0) {
    const scale = 100 / sum;
    breakdown.architectural = Math.round(breakdown.architectural * scale);
    breakdown.bugfix = Math.round(breakdown.bugfix * scale);
    breakdown.feature = Math.round(breakdown.feature * scale);
    breakdown.docs = Math.round(breakdown.docs * scale);
    breakdown.formatting = Math.round(breakdown.formatting * scale);
  }

  const score = calculateWeightedScore(breakdown);

  return {
    score,
    breakdown,
    confidence: 0.6 // Lower confidence for heuristic
  };
}

/**
 * Batch score multiple contributors
 */
export async function batchScoreContributors(
  contributors: ContributorCommits[]
): Promise<Map<string, VeniceAssessment>> {
  const results = new Map<string, VeniceAssessment>();
  
  // Process sequentially to avoid rate limiting
  for (const contrib of contributors) {
    logger.debug(`Scoring commits for ${contrib.contributor}`);
    const assessment = await scoreCommitsWithVenice(contrib);
    results.set(contrib.contributor, assessment);
    
    // Small delay between API calls
    if (isVeniceAvailable() && contributors.indexOf(contrib) < contributors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
