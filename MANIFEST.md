# Project 14: Open Source Contributor Attribution Engine

## Partners
- **Slice** - Payment splitter platform
- **Venice AI** - Private AI for contribution analysis (no data leakage)
- **Talent Protocol** - Verifiable contributor credentials

## Goal
Build a tool that:
1. Analyzes git repository history
2. Uses Venice AI (private) to compute contribution weights
3. Encodes results into Slice payment splitter configuration
4. Attests contribution breakdown to Talent Protocol as verifiable credentials
5. Enables automatic future revenue splits

## Core Components

### 1. Git Analyzer
- Extract commit history, lines of code, file changes
- Track contributor activity over time
- Calculate metrics: commits, additions, deletions, file ownership, review activity

### 2. Venice AI Integration
- Private AI API for contextual contribution scoring
- No data leakage - local processing where possible
- AI-powered assessment of contribution impact and quality

### 3. Contribution Engine
- Multi-factor scoring algorithm
- Weight computation (code, docs, reviews, issues, community)
- Time-decay factors for recent contributions
- Configurable weight parameters

### 4. Slice Payment Splitter Adapter
- Encode contribution weights into Slice format
- Generate deployment-ready splitter configuration
- Support for future revenue distribution

### 5. Talent Protocol Attester
- Create verifiable contributor credentials (VCs)
- Attest contribution breakdown on-chain/off-chain
- Generate proof of contribution for reputation systems

### 6. CLI Tool
- Easy-to-use command-line interface
- Repository analysis with single command
- Output formats: JSON, Slice config, Talent attestation

## Technical Stack
- **Language**: TypeScript/Node.js (or Python? Check partner SDKs)
- **Testing**: Jest/pytest with comprehensive coverage
- **API Clients**: Venice AI SDK, Slice SDK, Talent Protocol API
- **Storage**: Local git processing, JSON outputs
- **Deployment**: Docker, npm package, GitHub Action

## API Research Needed
1. Venice AI API - authentication, endpoints, rate limits, data privacy guarantees
2. Slice SDK - payment splitter configuration format, deployment process
3. Talent Protocol API - credential issuance format, attestation mechanisms

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Set up project structure with TypeScript
- [ ] Implement git history analyzer (pure local)
- [ ] Create data models for commits, contributors, metrics
- [ ] Write unit tests for git parsing

### Phase 2: Venice AI Integration (Days 3-4)
- [ ] Research and document Venice AI API
- [ ] Implement secure client for Venice API
- [ ] Design contribution scoring prompts
- [ ] Implement local fallback scoring
- [ ] Test with sample repositories

### Phase 3: Contribution Engine (Day 5)
- [ ] Design multi-factor algorithm
- [ ] Implement weight calculation with configurable parameters
- [ ] Add time-decay and normalization
- [ ] Create output schemas for downstream components

### Phase 4: Slice Adapter (Day 6)
- [ ] Research Slice payment splitter format
- [ ] Implement encoder to Slice configuration
- [ ] Generate deployment-ready artifacts
- [ ] Validate with Slice sandbox/testnet

### Phase 5: Talent Attester (Day 7)
- [ ] Research Talent Protocol credential format
- [ ] Implement VC issuance logic
- [ ] Create attestation payloads
- [ ] Test credential generation

### Phase 6: Integration & CLI (Day 8)
- [ ] Build unified CLI interface
- [ ] Wire together all components
- [ ] Add configuration files (.env, config.yaml)
- [ ] Create comprehensive documentation

### Phase 7: Tests & Quality (Day 9)
- [ ] Integration tests with mock APIs
- [ ] End-to-end test with sample repo
- [ ] Add type checking, linting
- [ ] Performance testing with large repos

### Phase 8: Deployment & Polish (Day 10)
- [ ] Docker containerization
- [ ] npm package publishing
- [ ] GitHub Action for CI/CD
- [ ] README, examples, troubleshooting
- [ ] Final verification

## Success Criteria
- ✅ Complete git analysis with accurate metrics
- ✅ Venice AI integration with privacy guarantees
- ✅ Configurable contribution weights that make sense
- ✅ Valid Slice payment splitter configuration generated
- ✅ Verifiable credentials issued via Talent Protocol
- ✅ All tests passing (90%+ coverage)
- ✅ Deployed as Docker image and npm package
- ✅ Documentation complete with examples

## Deliverables
1. Source code repository with clean structure
2. CLI tool: `contrib-attrib` or similar
3. npm package: `@project14/contrib-attrib`
4. Docker image: `project14/contrib-attrib:latest`
5. Documentation: README, API docs, examples
6. Test suite with >90% coverage
7. Deployment guide for each partner integration

## Notes
- Enterprise-grade: error handling, logging, security best practices
- No data leakage: Venice AI must be private; document guarantees
- Extensible: allow plugins for different analysis methods
- Performant: handle large repositories efficiently