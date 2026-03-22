# Contributor Attribution Engine

**Automated, fair, and transparent contribution attribution for open source projects.**

Analyzes git history, computes contribution weights using AI (Venice AI for private inference), encodes results into a Slice payment splitter for fair revenue distribution, and creates verifiable credential attestations via Talent Protocol.

## 🎯 Problem Statement

Open source maintainers have no automated way to fairly attribute and compensate contributors. Manual tracking is:
- **Error-prone** - humans miss contributions, especially non-code work
- **Subjective** - different maintainers value contributions differently
- **Discouraging** - lack of recognition/compensation reduces participation

This tool automates the entire pipeline: analyze commits → weight contributions with AI → create on-chain payment splits.

## ✨ Features

- **Git Analysis** - Parse repository history, extract commit data, contributor metrics
- **AI-Powered Weighting** - Use Venice AI (private inference) for intelligent contribution assessment
- **Multi-Factor Scoring** - Weight by code, documentation, reviews, issues, community, impact, and recency
- **Slice Integration** - Generate payment splitter configurations for fair revenue distribution
- **Verifiable Credentials** - Create Talent Protocol credentials for contributor reputation
- **Time Decay** - Recent contributions weighted higher than older ones
- **CLI Interface** - Simple command-line tool for easy integration

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/drdeeks/contributor-attribution.git
cd contributor-attribution

# Install dependencies
npm install

# Build
npm run build

# (Optional) Link globally
npm link
```

## 📖 Usage

### Analyze a Repository

```bash
# Basic analysis
npx contrib-attrib analyze /path/to/repo

# Save to file
npx contrib-attrib analyze /path/to/repo -o report.json

# Markdown report
npx contrib-attrib analyze /path/to/repo -f markdown -o CONTRIBUTORS.md

# With AI assessment (requires VENICE_API_KEY)
VENICE_API_KEY=your_key npx contrib-attrib analyze /path/to/repo --ai
```

### Generate Slice Payment Config

```bash
# Generate payment split from analysis
npx contrib-attrib slice analysis.json -v 10000 -o slice-config.json
```

### Generate Talent Credentials

```bash
# Generate verifiable credentials
npx contrib-attrib credentials analysis.json -o credentials.json
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Contributor Attribution Engine                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │ Git Analyzer │───▶│ Contribution     │───▶│ Output        │ │
│  │              │    │ Engine           │    │ Generators    │ │
│  │ • Commits    │    │                  │    │               │ │
│  │ • Authors    │    │ • Multi-factor   │    │ • JSON/YAML   │ │
│  │ • Metrics    │    │   scoring        │    │ • Markdown    │ │
│  │ • Branches   │    │ • Time decay     │    │ • Slice       │ │
│  └──────────────┘    │ • Normalization  │    │ • Talent VC   │ │
│                      │ • AI assessment  │    └───────────────┘ │
│                      └──────────────────┘                       │
│                              │                                  │
│                              ▼                                  │
│                      ┌──────────────────┐                       │
│                      │ Venice AI        │                       │
│                      │ (Private LLM)    │                       │
│                      │                  │                       │
│                      │ • Impact assess  │                       │
│                      │ • Quality score  │                       │
│                      │ • Complexity     │                       │
│                      └──────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **Git Analyzer** (`src/services/git-analyzer.ts`)
   - Uses `simple-git` to parse repository history
   - Extracts commit data, author information, and metrics
   - Calculates per-contributor statistics (additions, deletions, files changed)

2. **Contribution Engine** (`src/services/contribution-engine.ts`)
   - Multi-factor scoring algorithm
   - Time decay weighting (recent contributions worth more)
   - Score normalization (0-100 scale)
   - Optional AI-powered assessment via Venice AI

3. **Output Generators**
   - JSON/YAML/Markdown reports
   - Slice payment splitter configuration
   - Talent Protocol verifiable credentials

## 📊 Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Code | 40% | Commits, lines added/deleted, files changed |
| Documentation | 15% | README, docs, comments |
| Reviews | 15% | Code review participation |
| Issues | 10% | Bug reports, feature requests |
| Community | 10% | Active days, engagement |
| Impact | 10% | Significance of changes |

### Time Decay

Contributions decay exponentially with a 1-year half-life:
- Commit today: 100% weight
- Commit 1 year ago: 50% weight
- Commit 2 years ago: 25% weight

## 🔐 Privacy & Security

- **Venice AI**: Private inference - your code analysis never leaves the secure environment
- **Local Analysis**: Git parsing happens locally, no data sent externally
- **Verifiable Credentials**: Cryptographically signed, tamper-proof attestations

## 📄 Output Examples

### Slice Payment Config

```json
{
  "version": "1.0.0",
  "totalValue": 10000,
  "contributors": [
    {
      "address": "0x1234...",
      "name": "alice@example.com",
      "weight": 60,
      "share": 60,
      "role": "contributor",
      "contributionScore": 60
    },
    {
      "address": "0x5678...",
      "name": "bob@example.com",
      "weight": 40,
      "share": 40,
      "role": "contributor",
      "contributionScore": 40
    }
  ]
}
```

### Talent Protocol Credential

```json
{
  "id": "cred-1234567890",
  "type": "ContributionCredential",
  "issuer": "https://talent.app",
  "issued": "2024-01-01T00:00:00.000Z",
  "claim": {
    "contributor": {
      "name": "alice@example.com",
      "address": "0x1234..."
    },
    "contribution": {
      "repository": "/path/to/repo",
      "totalScore": 60,
      "breakdown": { "code": 50, "documentation": 10, ... }
    }
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "signatureValue": "..."
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type check
npx tsc --noEmit
```

## 🛣️ Roadmap

- [ ] GitHub/GitLab API integration for issue/PR data
- [ ] Smart contract deployment for on-chain splits
- [ ] Web UI dashboard
- [ ] CI/CD integration (GitHub Actions)
- [ ] Multi-repository analysis
- [ ] Historical tracking and trends

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built for the [Synthesis Hackathon](https://synthesis.devfolio.co/) by Titan agent on OpenClaw.

Technologies used:
- [Venice AI](https://docs.venice.ai) - Private LLM inference
- [Slice Protocol](https://slice.so) - Payment splitter contracts
- [Talent Protocol](https://talent.protocol) - Verifiable credentials
- [simple-git](https://github.com/steveukx/git-js) - Git integration
- [ethers.js](https://ethers.org) - Ethereum utilities

---

**Made with 🤖 by [OpenClaw](https://openclaw.dev)**
