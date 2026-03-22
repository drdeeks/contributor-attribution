# Architecture Documentation
**Contributor Attribution Engine**

## Overview
An automated pipeline that analyzes git repositories, computes fair contribution weights using AI, and generates payment splitter configurations with verifiable credentials.

## System Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        Input: Git Repository                        │
└────────────────┬───────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  Git Analyzer (src/services/git-analyzer.ts)                        │
│  • Validates repository path (security)                             │
│  • Parses commit history with simple-git                           │
│  • Extracts: commits, authors, additions/deletions, files changed  │
│  • Aggregates metrics per contributor                              │
│  • LRU caching (30min TTL) for performance                          │
│  Output: RepositoryAnalysis                                         │
└────────────────┬───────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  Contribution Engine (src/services/contribution-engine.ts)          │
│  • Computes multi-factor scores:                                   │
│    - Code (40%): commits, lines, files                             │
│    - Documentation (15%): README, docs, comments                   │
│    - Reviews (15%): code review participation (estimated)          │
│    - Issues (10%): bug reports, features (estimated)               │
│    - Community (10%): active days, engagement                      │
│    - Impact (10%): significance of changes                         │
│  • Time decay: exponential (1-year half-life)                      │
│  • Score normalization (0-100 scale)                               │
│  • Optional Venice AI assessment (future)                          │
│  Output: ContributionScore[]                                        │
└────────────────┬──────────────────────��────────────────────────────┘
                 │
                 ├─────────────────┬─────────────────┬────────────────┤
                 │                 │                 │                │
                 ▼                 ▼                 ▼                ▼
    ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ JSON Report      │  │ Markdown     │  │ Slice Config │  │ Talent       │
    │ Generator        │  │ Report       │  │ Generator    │  │ Credentials  │
    │                  │  │ Generator    │  │              │  │ Generator    │
    │ • Full analysis  │  │ • Tables     │  │ • Payment    │  │ • VCs        │
    │ • Scores         │  │ • Top 10     │  │   splitter   │  │ • Proofs     │
    │ • Metadata       │  │ • Summary    │  │ • Shares %   │  │ • Merkle     │
    └──────────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

## Core Components

### 1. Git Analyzer (`src/services/git-analyzer.ts`)
**Purpose**: Extract and parse git repository data

**Key Features**:
- Path validation & security (prevents path traversal)
- Repository verification (checks .git directory)
- Commit history parsing with pagination
- Author aggregation and metrics calculation
- LRU cache with TTL (30 minutes default)
- Retry mechanism with exponential backoff
- Graceful error handling via ErrorBoundary

**Dependencies**:
- `simple-git`: Git operations
- `src/utils/cache.ts`: Caching layer
- `src/errors/index.ts`: Structured error handling
- `src/validation/index.ts`: Input validation

**Main Methods**:
```typescript
analyze(): Promise<RepositoryAnalysis>
getAllCommits(): Promise<GitCommit[]>
getContributors(): Promise<ContributorMetrics[]>
getCommitStats(hash): Promise<{files, additions, deletions}>
```

**Security Measures**:
- Path traversal prevention
- Input sanitization
- Author filtering (ignore bots, etc.)
- Max commits limit (10,000 default)

### 2. Contribution Engine (`src/services/contribution-engine.ts`)
**Purpose**: Compute fair contribution scores using multi-factor algorithm

**Scoring Algorithm**:
```typescript
BaseScore = (
  commits_weight * 0.4 +
  additions_weight * 0.4 +
  deletions_weight * 0.4 +
  files_weight * 0.4
) * factor_weights

TimeDecay = 0.5^(days_since_last_commit / 365)

FinalScore = BaseScore * TimeDecay * normalization
```

**Weight Factors** (configurable):
- **Code** (40%): Commits, lines added/deleted, files changed
- **Documentation** (15%): Heuristic based on file patterns
- **Reviews** (15%): Estimated from commit frequency
- **Issues** (10%): Estimated from commit frequency
- **Community** (10%): Active days over time
- **Impact** (10%): Files changed + lines modified

**Time Decay**:
- Half-life: 1 year (configurable)
- Min weight: 0.1 (10%)
- Max weight: 1.0 (100%)

**Normalization**:
- Scales scores to 0-100 range
- Handles edge cases: single contributor, equal scores

**Output Generators**:
- **JSON/YAML**: Full analysis with metadata
- **Markdown**: Formatted tables with summary
- **Slice Config**: Payment splitter configuration (addresses, shares)
- **Talent Credentials**: Verifiable credentials with proofs

**Main Methods**:
```typescript
computeScores(contributors, totals): Promise<ContributionScore[]>
generateContributionReport(analysis, format): Promise<string>
generateSliceConfig(analysis, totalValue): Promise<SlicePaymentConfig>
generateTalentCredentials(analysis, sliceConfig): Promise<TalentProtocolCredential[]>
```

### 3. Error Handling (`src/errors/index.ts`)
**Purpose**: Enterprise-grade structured error handling

**Error Hierarchy**:
```
AppError (base)
├── ValidationError
├── GitError
├── AIError
├── SliceError
├── CredentialError
├── SystemError
└── NetworkError
```

**Features**:
- Structured error codes (e.g., GIT_001, VAL_003)
- Error categories & severity levels
- Retryability flags
- User-friendly action suggestions
- Context preservation
- Error boundaries for graceful degradation
- Retry handler with exponential backoff

**Error Codes** (partial list):
- `GIT_001`: Repository not found
- `GIT_002`: Not a git repository
- `GIT_003`: Git command failed
- `AI_001`: API key missing
- `AI_002`: API request failed
- `VAL_001`: Invalid repository path
- `SLC_001`: Invalid slice configuration

### 4. Validation & Sanitization (`src/validation/index.ts`)
**Purpose**: Input validation and security

**Key Functions**:
- `validateRepositoryPath()`: Path validation & security
- `sanitizeString()`: Remove control characters
- `sanitizeEmail()`: Email normalization
- `maskSensitiveData()`: Redact API keys
- `validateSchema()`: Generic schema validation
- `validateContributionScore()`: Range validation (0-100)

**Security Measures**:
- Path traversal prevention
- Null byte filtering
- Input length limits
- Control character removal
- Email format validation

### 5. Caching Layer (`src/utils/cache.ts`)
**Purpose**: Performance optimization via in-memory caching

**Implementation**:
- LRU (Least Recently Used) eviction
- TTL (Time To Live) support
- Memory size limits
- Automatic cleanup (periodic)
- Hit/miss statistics

**Global Caches**:
- `gitLogCache`: 100 entries, 200MB, 30min TTL
- `analysisCache`: 50 entries, 100MB, 10min TTL
- `contributorCache`: 500 entries, 50MB, 1hour TTL

### 6. Logging (`src/utils/logger.ts`)
**Purpose**: Observability and debugging

**Loggers**:
- `logger`: General application logging (info, warn, error)
- `auditLogger`: Audit trail (operations, users)
- `errorLogger`: Error-only logging to file

**Features**:
- Winston-based
- Structured JSON logs
- Console + file transports
- Colorized output (development)
- Log rotation (10MB max, 5 files)

### 7. CLI Interface (`src/cli.ts`)
**Purpose**: Command-line interface for users

**Commands**:
```bash
contrib-attrib analyze <path> [-o file] [-f format] [--ai]
contrib-attrib slice <analysis-file> [-v value] [-o file]
contrib-attrib credentials <analysis-file> [-o file]
```

**Options**:
- `-o, --output`: Output file path
- `-f, --format`: Output format (json|yaml|markdown)
- `--ai`: Enable Venice AI assessment
- `-v, --value`: Total value for payment split

## Data Flow Example

```
Input: /home/user/my-project (git repo)
       ↓
GitAnalyzer.analyze()
       ↓
RepositoryAnalysis {
  totalCommits: 150,
  contributors: [
    { name: "Alice", email: "alice@...", totalCommits: 100, additions: 5000, ... },
    { name: "Bob", email: "bob@...", totalCommits: 50, additions: 2000, ... }
  ]
}
       ↓
ContributionEngine.computeScores()
       ↓
ContributionScore[] [
  { contributor: "alice@...", score: 75.3, factors: {...}, breakdown: {...} },
  { contributor: "bob@...", score: 45.8, factors: {...}, breakdown: {...} }
]
       ↓
       ├─→ generateContributionReport() → JSON/YAML/Markdown
       ├─→ generateSliceConfig() → Slice payment splitter
       └─→ generateTalentCredentials() → Verifiable credentials
```

## External Integrations

### 1. Venice AI (Future)
**Status**: Placeholder implemented, not active by default
**Purpose**: AI-powered impact assessment
**Endpoint**: `https://api.venice.ai/chat/completions`
**Authentication**: API key via `VENICE_API_KEY` env var
**Model**: `llama-3.3-70b` (configurable)

**Usage**:
```bash
VENICE_API_KEY=xxx contrib-attrib analyze /repo --ai
```

**Fallback**: If Venice AI unavailable, uses heuristic-based scoring

### 2. Slice Protocol
**Status**: Output format implemented, deployment not integrated
**Purpose**: On-chain payment splitter configuration
**Output**:
```json
{
  "version": "1.0.0",
  "totalValue": 10000,
  "contributors": [
    { "address": "0x...", "name": "alice@...", "weight": 75.3, "share": 62.1%, ... }
  ]
}
```

### 3. Talent Protocol
**Status**: Credential format implemented, issuance not integrated
**Purpose**: Verifiable contributor credentials
**Output**: VerifiableCredentials with proofs

**Credential Structure**:
- Type: `ContributionCredential`
- Claim: contributor info + contribution breakdown
- Proof: `JsonWebSignature2020` or `MerkleProof2021`
- Verification: hash-based integrity

## Security Architecture

### Input Validation
- Path traversal prevention (absolute path resolution)
- Git repository verification (.git directory check)
- Author email sanitization
- Input length limits (prevent DoS)

### API Key Handling
- Never logged (masked with `maskSensitiveData()`)
- Environment variable storage
- Validated before use

### Error Handling
- No stack traces in production (only in dev/test)
- Structured errors with sanitized context
- User-friendly action suggestions

### Caching
- TTL to prevent stale data
- Memory limits to prevent exhaustion
- Automatic cleanup

## Performance Optimizations

1. **Caching**: Aggressive caching of git operations (30min TTL)
2. **LRU Eviction**: Memory-efficient cache management
3. **Pagination**: Max commits limit (10,000) to prevent memory issues
4. **Retry Logic**: Exponential backoff for transient failures
5. **Concurrent Limits**: simple-git maxConcurrentProcesses: 4

## Testing

**Test Coverage**: 10 tests (all passing)

**Test Files**:
- `tests/git-analyzer.test.ts`: Git operations, error handling
- `tests/contribution-engine.test.ts`: Scoring, normalization, output formats

**Test Strategy**:
- Unit tests for core functions
- Mock git repositories
- Edge case coverage (empty repo, single contributor, etc.)

## Configuration

**Environment Variables**:
- `LOG_LEVEL`: Logging level (default: `info`)
- `VENICE_API_KEY`: Venice AI API key (optional)
- `NODE_ENV`: Environment (development|test|production)

**Configurable Weights** (in ContributionEngine):
```typescript
{
  weightFactors: { code: 0.4, documentation: 0.15, ... },
  timeDecay: { halfLife: 365, maxWeight: 1, minWeight: 0.1 },
  normalization: { minScore: 0, maxScore: 100 },
  aiAssessment: { enabled: false, model: 'llama-3.3-70b', confidenceThreshold: 0.7 }
}
```

## Known Limitations

1. **No Venice AI integration**: Placeholder only, not actively used
2. **Heuristic-based**: Documentation/reviews/issues estimated from patterns, not actual data
3. **No GitHub API**: No issue tracker or PR review data
4. **Local-only**: No remote git repository support
5. **Mock addresses**: Ethereum addresses generated via hash, not real
6. **No deployment**: Slice/Talent outputs are formats only, no on-chain interaction

## Future Enhancements

1. **GitHub API Integration**: Pull real issue/PR data
2. **Venice AI**: Active AI assessment of contribution quality
3. **Slice Deployment**: Deploy payment splitters on-chain
4. **Talent Issuance**: Issue credentials via Talent Protocol API
5. **Web UI**: Dashboard for visualization
6. **CI/CD Integration**: GitHub Actions for auto-attribution
7. **Multi-repo**: Aggregate across multiple repositories
8. **Historical Tracking**: Track contribution trends over time

## Dependencies

**Production**:
- `simple-git`: Git operations
- `commander`: CLI framework
- `winston`: Logging
- `axios`: HTTP client (future Venice AI)
- `ethers`/`viem`: Ethereum utilities
- `merkletreejs`: Merkle tree proofs
- `@digitalbazaar/vc`: Verifiable credentials
- `did-resolver`: DID resolution

**Development**:
- `typescript`: Type safety
- `jest`: Testing framework
- `eslint`: Code linting
- `ts-jest`: TypeScript testing

## File Structure

```
src/
├── cli.ts                       # CLI interface (Commander)
├── index.ts                     # Public API exports
├── types/index.ts               # TypeScript type definitions (500+ lines)
├── errors/index.ts              # Error handling framework
├── validation/index.ts          # Input validation & sanitization
├── utils/
│   ├── logger.ts                # Winston logging setup
│   ├── cache.ts                 # LRU cache implementation
│   └── merkle.ts                # Merkle tree utilities
└── services/
    ├── git-analyzer.ts          # Git repository analysis
    └── contribution-engine.ts   # Scoring & output generation
tests/
├── git-analyzer.test.ts         # Git analyzer tests
└── contribution-engine.test.ts  # Engine tests
```

## Exit Codes

- `0`: Success
- `1`: Error (validation, git, AI, etc.)

## Logging Levels

- `debug`: Detailed debugging (cache hits, internal state)
- `info`: General operations (analysis start, completion)
- `warn`: Non-fatal issues (cache misses, fallback usage)
- `error`: Fatal errors (validation failure, git errors)

---

**Version**: 1.0.0  
**Last Updated**: 2026-03-22  
**Author**: Agent Gamma (Titan)  
**Hackathon**: Synthesis 2026
