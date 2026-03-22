/**
 * Caching Module
 * Implements in-memory LRU cache with TTL support for optimization
 */

import * as crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
  size: number;
}

interface CacheOptions {
  maxSize?: number;           // Maximum number of entries
  maxMemoryMB?: number;       // Maximum memory in MB (approximate)
  defaultTtlMs?: number;      // Default TTL in milliseconds
  cleanupIntervalMs?: number; // Cleanup interval in milliseconds
}

/**
 * LRU Cache with TTL support
 */
export class Cache<T = unknown> {
  private readonly cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly maxMemoryBytes: number;
  private readonly defaultTtlMs: number;
  private currentMemoryBytes: number = 0;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  // Statistics
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.maxMemoryBytes = (options.maxMemoryMB ?? 50) * 1024 * 1024;
    this.defaultTtlMs = options.defaultTtlMs ?? 5 * 60 * 1000; // 5 minutes default

    if (options.cleanupIntervalMs) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        options.cleanupIntervalMs
      );
    }
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const size = this.estimateSize(value);
    const now = Date.now();

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentMemoryBytes -= existing.size;
      this.cache.delete(key);
    }

    // Evict entries if needed
    this.evictIfNeeded(size);

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + ttl,
      accessedAt: now,
      size,
    };

    this.cache.set(key, entry);
    this.currentMemoryBytes += size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryBytes -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    memoryBytes: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      memoryBytes: this.currentMemoryBytes,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get or compute value with caching
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Shutdown cache and cleanup
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.delete(key);
    }
  }

  /**
   * Evict entries if cache is full
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Evict by count
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Evict by memory
    while (this.currentMemoryBytes + newEntrySize > this.maxMemoryBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruAccessTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < lruAccessTime) {
        lruKey = key;
        lruAccessTime = entry.accessedAt;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }

  /**
   * Estimate memory size of a value
   */
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      // Rough estimate: 2 bytes per character (UTF-16) + overhead
      return json.length * 2 + 100;
    } catch {
      // Fallback for non-serializable values
      return 1024;
    }
  }
}

/**
 * Create a cache key from multiple parts
 */
export function createCacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  const keyParts = parts.map(p => String(p ?? 'null'));
  const combined = keyParts.join(':');
  
  // Use hash for very long keys
  if (combined.length > 200) {
    return crypto.createHash('sha256').update(combined).digest('hex');
  }
  
  return combined;
}

/**
 * Memoization decorator for async functions
 */
export function memoize<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    cache?: Cache;
    keyFn?: (...args: Parameters<T>) => string;
    ttlMs?: number;
  } = {}
): T {
  const cache = options.cache ?? new Cache({ maxSize: 100 });
  const keyFn = options.keyFn ?? ((...args) => createCacheKey(...args.map(a => JSON.stringify(a))));

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = keyFn(...args);
    return cache.getOrCompute(key, () => fn(...args), options.ttlMs) as Promise<Awaited<ReturnType<T>>>;
  }) as T;
}

// Global caches for different purposes
export const analysisCache = new Cache<unknown>({
  maxSize: 50,
  maxMemoryMB: 100,
  defaultTtlMs: 10 * 60 * 1000, // 10 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute cleanup
});

export const gitLogCache = new Cache<unknown>({
  maxSize: 100,
  maxMemoryMB: 200,
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minute cleanup
});

export const contributorCache = new Cache<unknown>({
  maxSize: 500,
  maxMemoryMB: 50,
  defaultTtlMs: 60 * 60 * 1000, // 1 hour
  cleanupIntervalMs: 10 * 60 * 1000, // 10 minute cleanup
});

// Cleanup on process exit
process.on('beforeExit', () => {
  analysisCache.shutdown();
  gitLogCache.shutdown();
  contributorCache.shutdown();
});
