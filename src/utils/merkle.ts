/**
 * Merkle Tree Module
 * Implements Merkle tree for verifiable credential proofs
 */

import * as crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  data?: string;
  index?: number;
}

export interface MerkleProof {
  leaf: string;
  leafIndex: number;
  siblings: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  root: string;
}

export interface MerkleTreeData {
  root: string;
  leaves: string[];
  depth: number;
  size: number;
}

/**
 * Merkle Tree implementation for verifiable proofs
 */
export class MerkleTree {
  private root: MerkleNode | null = null;
  private leaves: MerkleNode[] = [];
  private hashFn: (data: string) => string;

  constructor(
    data: string[] = [],
    options: {
      hashAlgorithm?: 'sha256' | 'sha3-256' | 'keccak256';
    } = {}
  ) {
    this.hashFn = this.createHashFunction(options.hashAlgorithm ?? 'sha256');
    
    if (data.length > 0) {
      this.build(data);
    }
  }

  private createHashFunction(algorithm: string): (data: string) => string {
    return (data: string): string => {
      if (algorithm === 'keccak256') {
        // Use sha3-256 as a close approximation (for true keccak256, use keccak package)
        return crypto.createHash('sha3-256').update(data).digest('hex');
      }
      return crypto.createHash(algorithm === 'sha3-256' ? 'sha3-256' : 'sha256').update(data).digest('hex');
    };
  }

  /**
   * Build the Merkle tree from data
   */
  build(data: string[]): void {
    if (data.length === 0) {
      this.root = null;
      this.leaves = [];
      return;
    }

    // Create leaf nodes
    this.leaves = data.map((item, index) => ({
      hash: this.hashFn(item),
      data: item,
      index,
    }));

    // Build tree bottom-up
    this.root = this.buildLevel(this.leaves);
  }

  private buildLevel(nodes: MerkleNode[]): MerkleNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] ?? left; // Duplicate last node if odd number

      const parentHash = this.hashPair(left.hash, right.hash);
      nextLevel.push({
        hash: parentHash,
        left,
        right: nodes[i + 1] ? right : undefined,
      });
    }

    return this.buildLevel(nextLevel);
  }

  private hashPair(left: string, right: string): string {
    // Sort hashes to ensure consistent ordering
    const sorted = [left, right].sort();
    return this.hashFn(sorted[0] + sorted[1]);
  }

  /**
   * Get the root hash
   */
  getRoot(): string | null {
    return this.root?.hash ?? null;
  }

  /**
   * Get proof for a leaf at given index
   */
  getProof(leafIndex: number): MerkleProof | null {
    if (leafIndex < 0 || leafIndex >= this.leaves.length || !this.root) {
      return null;
    }

    const siblings: MerkleProof['siblings'] = [];
    const leaf = this.leaves[leafIndex];
    
    // Walk up the tree collecting sibling hashes
    let currentHash = leaf.hash;
    let currentIndex = leafIndex;
    let levelNodes = this.leaves;

    while (levelNodes.length > 1) {
      const pairIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const siblingNode = levelNodes[pairIndex] ?? levelNodes[currentIndex]; // Handle odd case

      if (pairIndex < levelNodes.length && pairIndex !== currentIndex) {
        siblings.push({
          hash: siblingNode.hash,
          position: currentIndex % 2 === 0 ? 'right' : 'left',
        });
      }

      // Move to parent level
      const nextLevel: MerkleNode[] = [];
      for (let i = 0; i < levelNodes.length; i += 2) {
        const left = levelNodes[i];
        const right = levelNodes[i + 1] ?? left;
        nextLevel.push({
          hash: this.hashPair(left.hash, right.hash),
        });
      }

      currentHash = nextLevel[Math.floor(currentIndex / 2)].hash;
      currentIndex = Math.floor(currentIndex / 2);
      levelNodes = nextLevel;
    }

    return {
      leaf: leaf.hash,
      leafIndex,
      siblings,
      root: this.root.hash,
    };
  }

  /**
   * Verify a proof
   */
  verify(proof: MerkleProof): boolean {
    let currentHash = proof.leaf;

    for (const sibling of proof.siblings) {
      if (sibling.position === 'left') {
        currentHash = this.hashPair(sibling.hash, currentHash);
      } else {
        currentHash = this.hashPair(currentHash, sibling.hash);
      }
    }

    return currentHash === proof.root;
  }

  /**
   * Verify a leaf is in the tree
   */
  verifyLeaf(data: string, proof: MerkleProof): boolean {
    const leafHash = this.hashFn(data);
    if (leafHash !== proof.leaf) {
      return false;
    }
    return this.verify(proof);
  }

  /**
   * Get tree depth
   */
  getDepth(): number {
    if (!this.root) return 0;
    return Math.ceil(Math.log2(this.leaves.length));
  }

  /**
   * Get all leaf hashes
   */
  getLeaves(): string[] {
    return this.leaves.map(leaf => leaf.hash);
  }

  /**
   * Get leaf data
   */
  getLeafData(): string[] {
    return this.leaves.map(leaf => leaf.data ?? '');
  }

  /**
   * Export tree data for serialization
   */
  toJSON(): MerkleTreeData {
    return {
      root: this.root?.hash ?? '',
      leaves: this.getLeaves(),
      depth: this.getDepth(),
      size: this.leaves.length,
    };
  }

  /**
   * Create tree from serialized data
   */
  static fromLeaves(leaves: string[], options?: { hashAlgorithm?: 'sha256' | 'sha3-256' | 'keccak256' }): MerkleTree {
    const tree = new MerkleTree([], options);
    tree.build(leaves);
    return tree;
  }

  /**
   * Add a leaf to the tree (rebuilds entire tree)
   */
  addLeaf(data: string): void {
    const allData = [...this.getLeafData(), data];
    this.build(allData);
  }

  /**
   * Get the index of a leaf by data
   */
  getLeafIndex(data: string): number {
    const hash = this.hashFn(data);
    return this.leaves.findIndex(leaf => leaf.hash === hash);
  }
}

/**
 * Create a Merkle root from contribution scores
 */
export function createContributionMerkleRoot(
  contributions: Array<{
    contributor: string;
    score: number;
    timestamp: Date;
  }>
): {
  tree: MerkleTree;
  root: string;
  proofs: Map<string, MerkleProof>;
} {
  // Create deterministic leaf data from contributions
  const leafData = contributions.map(c => 
    JSON.stringify({
      contributor: c.contributor,
      score: c.score,
      timestamp: c.timestamp.toISOString(),
    })
  );

  const tree = new MerkleTree(leafData);
  const proofs = new Map<string, MerkleProof>();

  // Generate proofs for each contributor
  contributions.forEach((c, index) => {
    const proof = tree.getProof(index);
    if (proof) {
      proofs.set(c.contributor, proof);
    }
  });

  return {
    tree,
    root: tree.getRoot() ?? '',
    proofs,
  };
}

/**
 * Verify a contribution proof
 */
export function verifyContributionProof(
  contribution: {
    contributor: string;
    score: number;
    timestamp: Date;
  },
  proof: MerkleProof,
  expectedRoot: string
): boolean {
  const tree = new MerkleTree();
  
  const leafData = JSON.stringify({
    contributor: contribution.contributor,
    score: contribution.score,
    timestamp: contribution.timestamp.toISOString(),
  });

  if (proof.root !== expectedRoot) {
    return false;
  }

  return tree.verifyLeaf(leafData, proof);
}

/**
 * Create a proof-of-attribution for a credential
 */
export function createAttributionProof(
  analysisId: string,
  contributor: string,
  score: number,
  timestamp: Date,
  additionalData?: Record<string, unknown>
): {
  proofHash: string;
  proofData: string;
  signature: string;
} {
  const proofData = JSON.stringify({
    type: 'ContributionAttribution',
    analysisId,
    contributor,
    score,
    timestamp: timestamp.toISOString(),
    ...additionalData,
  });

  const proofHash = crypto.createHash('sha256').update(proofData).digest('hex');
  
  // In production, this would use actual cryptographic signing
  const signature = crypto
    .createHmac('sha256', 'attribution-key')
    .update(proofHash)
    .digest('hex');

  return {
    proofHash,
    proofData,
    signature,
  };
}
