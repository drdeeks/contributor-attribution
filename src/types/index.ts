export interface GitCommit {
  hash: string;
  author: {
    name: string;
    email: string;
  };
  date: Date;
  message: string;
  body: string;
  files: string[];
}

export interface ContributorMetrics {
  name: string;
  email: string;
  totalCommits: number;
  additions: number;
  deletions: number;
  firstCommitDate?: Date;
  lastCommitDate?: Date;
  activeDays: number;
  filesChanged: number;
}

export interface RepositoryAnalysis {
  repository: string;
  totalCommits: number;
  branches: string[];
  contributors: ContributorMetrics[];
  commits: GitCommit[];
  timespan: {
    firstCommit?: Date;
    lastCommit?: Date;
  };
  // Additional metadata
  lastAnalyzed?: Date;
  analysisVersion: string;
}

export interface VeniceAIRequest {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string | object;
  }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  enable_e2ee?: boolean;
  enable_web_search?: 'auto' | 'on' | 'off';
  enable_web_scraping?: boolean;
  enable_web_citations?: boolean;
  include_venice_system_prompt?: boolean;
  character_slug?: string;
  strip_thinking_response?: boolean;
  disable_thinking?: boolean;
}

export interface VeniceAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
      reasoning_content?: string;
      tool_calls?: any[];
    };
    finish_reason: 'stop' | 'length';
    logprobs?: any;
  }[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  venice_parameters: {
    enable_e2ee: boolean;
    enable_web_search: string;
    enable_web_scraping: boolean;
    enable_web_citations: boolean;
    include_venice_system_prompt: boolean;
    strip_thinking_response: boolean;
    disable_thinking: boolean;
  };
}

export interface ContributionScore {
  contributor: string;
  score: number;
  factors: {
    code: number;
    documentation: number;
    reviews: number;
    issues: number;
    community: number;
    impact: number;
    recency: number;
  };
  breakdown: {
    commits: number;
    linesAdded: number;
    linesDeleted: number;
    filesChanged: number;
    issuesResolved: number;
    reviewsCompleted: number;
  };
  aiAssessment?: {
    impactAssessment: string;
    qualityScore: number;
    complexityScore: number;
    contextAwareness: number;
  };
  timestamp: Date;
}

export interface SlicePaymentConfig {
  version: string;
  totalValue: number;
  contributors: {
    address: string;
    name: string;
    weight: number;
    share: number;
    role: string;
    contributionScore: number;
  }[];
  metadata: {
    analysisId: string;
    timestamp: string;
    repository: string;
    version: string;
    config: ContributionConfig;
  };
}

export interface ContributionConfig {
  weightFactors: {
    code: number;
    documentation: number;
    reviews: number;
    issues: number;
    community: number;
    impact: number;
  };
  timeDecay: {
    halfLife: number; // days
    maxWeight: number;
    minWeight: number;
  };
  normalization: {
    minScore: number;
    maxScore: number;
    defaultWeight: number;
  };
  aiAssessment: {
    enabled: boolean;
    model: string;
    confidenceThreshold: number;
  };
}

export interface TalentProtocolCredential {
  id: string;
  type: 'VerifiableCredential' | 'ContributionCredential';
  issuer: string;
  issued: string;
  expires?: string;
  claim: {
    contributor: {
      name: string;
      address: string;
      email: string;
    };
    contribution: {
      repository: string;
      analysisId: string;
      totalScore: number;
      breakdown: ContributionScore['factors'];
      timestamp: string;
      sliceConfig: SlicePaymentConfig;
    };
    verification: {
      analysisHash: string;
      contributionHash: string;
      signedBy: string[];
    };
  };
  proof: {
    type: 'JsonWebSignature2020' | 'MerkleProof2021';
    created: string;
    proofPurpose: 'assertionMethod';
    verificationMethod: string;
    signatureValue: string;
  };
  metadata: {
    version: string;
    source: 'contrib-attrib';
    analysisVersion: string;
    sliceVersion: string;
    talentVersion: string;
  };
}

export interface ContributionAnalysis {
  id: string;
  repository: string;
  analysisDate: Date;
  totalContributors: number;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  contributionScores: ContributionScore[];
  normalizedScores: ContributionScore[];
  weightedScores: ContributionScore[];
  sliceConfig: SlicePaymentConfig;
  talentCredentials: TalentProtocolCredential[];
  aiAssessment: {
    enabled: boolean;
    model: string;
    confidence: number;
    notes: string;
  };
  metadata: {
    config: ContributionConfig;
    version: string;
    analysisVersion: string;
    timestamp: string;
  };
}

export interface CLIConfig {
  gitPath: string;
  outputDir: string;
  reportFormat: 'json' | 'yaml' | 'table';
  verbose: boolean;
  dryRun: boolean;
  aiAssessment: {
    enabled: boolean;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  sliceConfig: {
    enabled: boolean;
    deployment: 'sandbox' | 'production';
    privateKey: string;
    contractAddress: string;
  };
  talentConfig: {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    did: string;
  };
}

export interface ErrorReport {
  timestamp: Date;
  errorType: string;
  message: string;
  stack: string;
  context: {
    repository: string;
    operation: string;
    step: string;
    contributor?: string;
  };
  retryable: boolean;
  retryCount: number;
}

export interface ProgressReport {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message: string;
  timestamp: Date;
  details?: any;
}

export interface SystemInfo {
  os: string;
  arch: string;
  nodeVersion: string;
  availableMemory: number;
  cpuCount: number;
  diskSpace: number;
  gitVersion: string;
  networkAvailable: boolean;
}

export interface FeatureFlags {
  aiAssessment: boolean;
  sliceIntegration: boolean;
  talentIntegration: boolean;
  gitAnalysis: boolean;
  contributionWeighting: boolean;
  verifiableCredentials: boolean;
  timeDecay: boolean;
  impactAssessment: boolean;
}

export interface VersionInfo {
  contribAttrib: string;
  gitAnalyzer: string;
  veniceAI: string;
  sliceSDK: string;
  talentProtocol: string;
  node: string;
  os: string;
  build: string;
  timestamp: Date;
}

export interface Configuration {
  contribution: ContributionConfig;
  cli: CLIConfig;
  featureFlags: FeatureFlags;
  ai: {
    models: string[];
    defaultModel: string;
    maxConcurrentRequests: number;
    timeout: number;
  };
  git: {
    maxCommits: number;
    ignoreFiles: string[];
    ignoreAuthors: string[];
    timeWindow: {
      start?: Date;
      end?: Date;
    };
  };
  output: {
    format: 'json' | 'yaml' | 'table' | 'markdown';
    prettyPrint: boolean;
    includeLogs: boolean;
    includeRaw: boolean;
  };
  security: {
    privateKey?: string;
    publicKey?: string;
    encryptionKey?: string;
    signatureKey?: string;
  };
}

export interface ServiceStatus {
  name: string;
  version: string;
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  latency: number;
  errorRate: number;
  lastCheck: Date;
  uptime: number;
  features: {
    [key: string]: boolean;
  };
}

export interface HealthCheck {
  timestamp: Date;
  services: ServiceStatus[];
  system: SystemInfo;
  features: FeatureFlags;
  version: VersionInfo;
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
}

export interface AuditLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  operation: string;
  message: string;
  details: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PerformanceMetrics {
  timestamp: Date;
  service: string;
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  errorCount: number;
  successCount: number;
  queueLength: number;
  concurrentRequests: number;
}

export interface UsageStats {
  timestamp: Date;
  service: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  apiCalls: {
    [key: string]: {
      calls: number;
      tokens: number;
      cost: number;
      errors: number;
    };
  };
  dataProcessed: number;
  storageUsed: number;
  bandwidthUsed: number;
}

export interface RateLimit {
  limit: number;
  window: number; // seconds
  current: number;
  remaining: number;
  resetTime: Date;
  exceeded: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'jitter';
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  strategy: 'lru' | 'fifo' | 'lfu';
  persistence: 'memory' | 'disk' | 'database';
  compression: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'json' | 'text' | 'pretty';
  destination: 'console' | 'file' | 'database' | 'remote';
  retentionDays: number;
  maxFileSize: number;
  maxFiles: number;
  colorize: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  metrics: string[];
  alerts: {
    [key: string]: {
      threshold: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      notification: 'email' | 'slack' | 'webhook' | 'none';
    };
  };
  reporting: {
    enabled: boolean;
    interval: number;
    destination: 'console' | 'file' | 'database' | 'remote';
  };
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
    keySize: number;
    ivSize: number;
  };
  authentication: {
    enabled: boolean;
    method: 'jwt' | 'api-key' | 'oauth2';
    tokenExpiration: number;
    refreshInterval: number;
  };
  authorization: {
    enabled: boolean;
    method: 'rbac' | 'abac' | 'mac';
    roles: string[];
    permissions: {
      [key: string]: string[];
    };
  };
  auditing: {
    enabled: boolean;
    retentionDays: number;
    sensitiveDataMasking: boolean;
    logLevel: 'info' | 'warn' | 'error';
  };
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  destination: 'local' | 's3' | 'gcs' | 'azure';
  retentionDays: number;
  encryption: boolean;
  compression: boolean;
  verify: boolean;
}

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  region: string;
  zone: string;
  replicas: number;
  autoscaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
    targetMemory: number;
  };
  healthChecks: {
    enabled: boolean;
    path: string;
    interval: number;
    timeout: number;
    threshold: number;
  };
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  backup: BackupConfig;
}

export interface ServiceConfig {
  name: string;
  endpoint: string;
  timeout: number;
  retries: RetryPolicy;
  rateLimit: RateLimit;
  cache: CacheConfig;
  version: string;
  features: string[];
  dependencies: string[];
}

export interface SystemConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  services: ServiceConfig[];
  deployment: DeploymentConfig;
  features: FeatureFlags;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  backup: BackupConfig;
  audit: {
    enabled: boolean;
    retentionDays: number;
    sensitiveDataMasking: boolean;
    logLevel: 'info' | 'warn' | 'error';
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  retryAfter?: number;
  requestId?: string;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint: string;
  expected: any;
}

export interface BusinessError {
  code: string;
  message: string;
  context?: any;
  resolution?: string;
}

export interface SystemError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  recoverySteps: string[];
}

export interface UserError {
  code: string;
  message: string;
  field?: string;
  value?: any;
  suggestion: string;
}

export interface TimeoutError {
  operation: string;
  timeout: number;
  context?: any;
  retryable: boolean;
}

export interface NetworkError {
  url: string;
  method: string;
  status: number;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface DatabaseError {
  operation: string;
  table?: string;
  query?: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface AuthenticationError {
  type: 'missing' | 'invalid' | 'expired' | 'insufficient';
  message: string;
  required?: string[];
  provided?: string[];
  resolution: string;
}

export interface AuthorizationError {

}