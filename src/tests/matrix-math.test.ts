import { MatrixMath } from '@/core/maths/matrix-math';
import type { Matrix } from '@/core/maths/types';
import { describe, it, expect, beforeEach } from 'vitest';

const PRECISION = 3;

describe('MatrixMath Tests', () => {
  let math: MatrixMath;

  beforeEach(() => {
    math = new MatrixMath();
  });

  const validateMatrix = (actual: Matrix | null, expected: Matrix) => {
    expect(actual, 'Resulting matrix should not be null').not.toBeNull();
    expect(actual?.length).toBe(expected.length);

    actual!.forEach((row, i) => {
      expect(row.length).toBe(expected[i].length);
      row.forEach((val, j) => {
        expect(val).toBeCloseTo(expected[i][j], PRECISION);
      });
    });
  };

  const validateVector = (actual: number[] | null, expected: number[]) => {
    expect(actual, 'Resulting vector should not be null').not.toBeNull();
    expect(actual?.length).toBe(expected.length);

    actual!.forEach((val, i) => {
      expect(val).toBeCloseTo(expected[i], PRECISION);
    });
  };

  describe('Matrix Inversion', () => {
    it.each([
      {
        name: 'should compute the inverse for a standard 3x3 matrix with integer elements',
        A: [
          [5, -3, 7],
          [-1, 4, 3],
          [6, -2, 5],
        ],
        expected: [
          [-0.28, -0.011, 0.398],
          [-0.247, 0.183, 0.237],
          [0.237, 0.086, -0.183],
        ],
      },
      {
        name: 'should compute the inverse for a 3x3 matrix with mixed signs and positive determinant',
        A: [
          [6, 2, 5],
          [-3, 4, -1],
          [1, 4, 3],
        ],
        expected: [
          [0.5, 0.438, -0.688],
          [0.25, 0.406, -0.281],
          [-0.5, -0.688, 0.938],
        ],
      },
      {
        name: 'should handle inversion when the result contains zero and repeating decimals',
        A: [
          [2, -1, 3],
          [-1, 2, 2],
          [1, 1, 1],
        ],
        expected: [
          [0, -0.333, 0.667],
          [-0.25, 0.083, 0.583],
          [0.25, 0.25, -0.25],
        ],
      },
    ])('$name', ({ A, expected }) => {
      validateMatrix(math.invertMatrix(A), expected);
    });
  });

  describe('Matrix Rank', () => {
    it.each([
      {
        A: [
          [1, 2, 3, 4],
          [2, 4, 6, 8],
        ],
        expected: 1,
      },
      {
        A: [
          [1, 2],
          [3, 6],
          [5, 10],
          [4, 8],
        ],
        expected: 1,
      },
      {
        A: [
          [6, 2, 5],
          [-3, 4, -1],
          [1, 4, 3],
        ],
        expected: 3,
      },
      {
        A: [
          [1, 2, 3, 4],
          [-2, 5, -1, 3],
          [2, 4, 6, 8],
          [-1, 9, 2, 7],
        ],
        expected: 3,
      },
      {
        A: [
          [2, 5, 4],
          [-3, 1, -2],
          [-1, 6, 2],
        ],
        expected: 2,
      },
      {
        A: [
          [-1, 5, 4],
          [-2, 7, 5],
          [-3, 4, 1],
        ],
        expected: 2,
      },
      {
        A: [
          [1, 2, 3, 4],
          [-2, 5, -1, 3],
          [2, 4, 6, 8],
          [-1, 7, 2, 7],
        ],
        expected: 2,
      },
      {
        A: [
          [1, 2, 3, 4],
          [-2, 5, -1, 3],
          [2, 4, 7, 8],
          [-1, 9, 2, 7],
        ],
        expected: 4,
      },
    ])('should return rank $expected for given matrix', ({ A, expected }) => {
      expect(math.calculateRank(A)).toBe(expected);
    });
  });

  describe('Linear Algebraic Systems (SLAE)', () => {
    it.each([
      {
        A: [
          [5, -3, 7],
          [-1, 4, 3],
          [6, -2, 5],
        ],
        B: [13, 13, 12],
        expected: [1, 2, 2],
      },
      {
        A: [
          [6, 2, 5],
          [-3, 4, -1],
          [1, 4, 3],
        ],
        B: [1, 6, 6],
        expected: [-1, 1, 1],
      },
      {
        A: [
          [-1, 1, 1],
          [-1, -2, 2],
          [3, -1, 3],
        ],
        B: [4, 3, 2],
        expected: [-1, 1, 2],
      },
    ])(
      'should solve system Ax=B with expected result $expected',
      ({ A, B, expected }) => {
        validateVector(math.solveLinearSystem(A, B), expected);
      }
    );
  });
});
