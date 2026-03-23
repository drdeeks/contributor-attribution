import { 
  MerkleTree, 
  createContributionMerkleRoot, 
  verifyContributionProof,
  createAttributionProof 
} from '../src/utils/merkle';

describe('Merkle', () => {
  describe('MerkleTree', () => {
    it('should build a tree from data', () => {
      const data = ['item1', 'item2', 'item3', 'item4'];
      const tree = new MerkleTree(data);

      expect(tree.getRoot()).toBeTruthy();
      expect(tree.getLeaves()).toHaveLength(4);
      expect(tree.getDepth()).toBe(2);
    });

    it('should generate valid proofs', () => {
      const data = ['alice', 'bob', 'charlie'];
      const tree = new MerkleTree(data);

      const proof = tree.getProof(1);
      expect(proof).not.toBeNull();
      expect(proof!.leafIndex).toBe(1);
      expect(proof!.root).toBe(tree.getRoot());
    });

    it('should verify valid proofs', () => {
      const data = ['item1', 'item2', 'item3'];
      const tree = new MerkleTree(data);

      for (let i = 0; i < data.length; i++) {
        const proof = tree.getProof(i);
        expect(proof).not.toBeNull();
        expect(tree.verify(proof!)).toBe(true);
      }
    });

    it('should verify leaf data', () => {
      const data = ['hello', 'world', 'test'];
      const tree = new MerkleTree(data);

      const proof = tree.getProof(0);
      expect(proof).not.toBeNull();
      expect(tree.verifyLeaf('hello', proof!)).toBe(true);
      expect(tree.verifyLeaf('wrong', proof!)).toBe(false);
    });

    it('should handle single element', () => {
      const tree = new MerkleTree(['single']);
      
      expect(tree.getRoot()).toBeTruthy();
      expect(tree.getLeaves()).toHaveLength(1);
      expect(tree.getDepth()).toBe(0);
    });

    it('should handle empty data', () => {
      const tree = new MerkleTree([]);
      
      expect(tree.getRoot()).toBeNull();
      expect(tree.getLeaves()).toHaveLength(0);
    });

    it('should export to JSON', () => {
      const data = ['a', 'b', 'c'];
      const tree = new MerkleTree(data);

      const json = tree.toJSON();
      expect(json).toHaveProperty('root');
      expect(json).toHaveProperty('leaves');
      expect(json).toHaveProperty('depth');
      expect(json).toHaveProperty('size');
      expect(json.size).toBe(3);
    });

    it('should add leaves', () => {
      const tree = new MerkleTree(['a', 'b']);
      const originalRoot = tree.getRoot();

      tree.addLeaf('c');
      
      expect(tree.getLeaves()).toHaveLength(3);
      expect(tree.getRoot()).not.toBe(originalRoot);
    });

    it('should find leaf index', () => {
      const data = ['alice', 'bob', 'charlie'];
      const tree = new MerkleTree(data);

      expect(tree.getLeafIndex('alice')).toBe(0);
      expect(tree.getLeafIndex('bob')).toBe(1);
      expect(tree.getLeafIndex('charlie')).toBe(2);
      expect(tree.getLeafIndex('unknown')).toBe(-1);
    });
  });

  describe('createContributionMerkleRoot', () => {
    it('should create merkle root from contributions', () => {
      const contributions = [
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
        { contributor: 'bob@example.com', score: 50, timestamp: new Date('2024-01-02') },
        { contributor: 'charlie@example.com', score: 25, timestamp: new Date('2024-01-03') },
      ];

      const { tree, root, proofs } = createContributionMerkleRoot(contributions);

      expect(root).toBeTruthy();
      expect(root.length).toBe(64); // SHA256 hex
      expect(proofs.size).toBe(3);
      expect(proofs.has('alice@example.com')).toBe(true);
      expect(proofs.has('bob@example.com')).toBe(true);
      expect(proofs.has('charlie@example.com')).toBe(true);
    });

    it('should generate verifiable proofs', () => {
      const contributions = [
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
        { contributor: 'bob@example.com', score: 50, timestamp: new Date('2024-01-02') },
      ];

      const { tree, root, proofs } = createContributionMerkleRoot(contributions);

      // Each proof should be verifiable
      proofs.forEach((proof, _contributor) => {
        expect(tree.verify(proof)).toBe(true);
        expect(proof.root).toBe(root);
      });
    });
  });

  describe('verifyContributionProof', () => {
    it('should verify valid contribution proof', () => {
      const contributions = [
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
        { contributor: 'bob@example.com', score: 50, timestamp: new Date('2024-01-02') },
      ];

      const { root, proofs } = createContributionMerkleRoot(contributions);
      const aliceProof = proofs.get('alice@example.com')!;

      const isValid = verifyContributionProof(
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
        aliceProof,
        root
      );

      expect(isValid).toBe(true);
    });

    it('should reject tampered contribution', () => {
      const contributions = [
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
      ];

      const { root, proofs } = createContributionMerkleRoot(contributions);
      const aliceProof = proofs.get('alice@example.com')!;

      // Try to verify with tampered score
      const isValid = verifyContributionProof(
        { contributor: 'alice@example.com', score: 100, timestamp: new Date('2024-01-01') },
        aliceProof,
        root
      );

      expect(isValid).toBe(false);
    });

    it('should reject wrong root', () => {
      const contributions = [
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
      ];

      const { proofs } = createContributionMerkleRoot(contributions);
      const aliceProof = proofs.get('alice@example.com')!;

      const isValid = verifyContributionProof(
        { contributor: 'alice@example.com', score: 75, timestamp: new Date('2024-01-01') },
        aliceProof,
        'wrong-root-hash'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('createAttributionProof', () => {
    it('should create attribution proof', () => {
      const proof = createAttributionProof(
        'analysis-123',
        'alice@example.com',
        75,
        new Date('2024-01-01'),
        { repository: 'test/repo' }
      );

      expect(proof).toHaveProperty('proofHash');
      expect(proof).toHaveProperty('proofData');
      expect(proof).toHaveProperty('signature');
      expect(proof.proofHash.length).toBe(64);
      expect(proof.signature.length).toBe(64);
    });

    it('should create deterministic proof for same inputs', () => {
      const timestamp = new Date('2024-01-01');
      
      const proof1 = createAttributionProof('analysis-123', 'alice@example.com', 75, timestamp);
      const proof2 = createAttributionProof('analysis-123', 'alice@example.com', 75, timestamp);

      expect(proof1.proofHash).toBe(proof2.proofHash);
      expect(proof1.signature).toBe(proof2.signature);
    });

    it('should include additional data in proof', () => {
      const proof = createAttributionProof(
        'analysis-123',
        'alice@example.com',
        75,
        new Date('2024-01-01'),
        { repository: 'test/repo', version: '1.0.0' }
      );

      const proofData = JSON.parse(proof.proofData);
      expect(proofData.repository).toBe('test/repo');
      expect(proofData.version).toBe('1.0.0');
    });
  });
});
