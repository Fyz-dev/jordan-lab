import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvancedSimplexMjvSolver,
  type AdvancedSimplexParams,
} from '@/core/maths/advanced-simplex-mjv-solver'; // Скорегуйте шлях за потреби
import type { SimplexResult } from '@/core/maths/simplex-mjv-solver';

const PRECISION = 3;

describe('AdvancedSimplexMjvSolver Tests', () => {
  let solver: AdvancedSimplexMjvSolver;

  beforeEach(() => {
    solver = new AdvancedSimplexMjvSolver();
  });

  const validateSimplexResult = (
    actual: SimplexResult,
    expected: { success: boolean; solution: number[]; objectiveValue: number }
  ) => {
    expect(actual.success).toBe(expected.success);
    expect(actual.error).toBeUndefined();
    expect(
      actual.solution,
      'Resulting solution should not be null'
    ).not.toBeNull();
    expect(
      actual.objectiveValue,
      'Objective value should not be null'
    ).not.toBeNull();
    expect(actual.solution?.length).toBe(expected.solution.length);

    actual.solution!.forEach((val, i) => {
      expect(val).toBeCloseTo(expected.solution[i], PRECISION);
    });

    expect(actual.objectiveValue!).toBeCloseTo(
      expected.objectiveValue,
      PRECISION
    );
  };

  describe('Advanced Linear Programming Problems (Zero-rows & Free Variables)', () => {
    it.each([
      {
        name: 'Task 1: Maximization with equation-to-inequality conversion and zero-rows removal',
        params: {
          objective: '10x1 - x2 - 42x3 - 52x4',
          type: 'max',
          varsCount: 4,

          constraints: [
            '-2x1+x2+x3+3x4=2',
            '-3x1+2x2-3x3=7',
            '-3x1+x2+4x3+x4<=1',
            '-3x1+2x2-2x3+2x4>=9',
          ],
          freeVars: [],
        } as AdvancedSimplexParams,
        expected: {
          success: true,
          solution: [9, 17, 0, 1],
          objectiveValue: 21,
        },
      },
      {
        name: 'Task 2: Maximization with Free Variables (x1, x2 are free)',
        params: {
          objective: '-3x1+6x2',
          type: 'max',
          varsCount: 2,
          constraints: [
            'x1+2x2+1>=0',
            '2x1+x2-4>=0',
            'x1-x2+1>=0',
            'x1-4x2+13>=0',
            '-4x1+x2+23>=0',
          ],
          freeVars: ['x1', 'x2'],
        } as AdvancedSimplexParams,
        expected: {
          success: true,
          solution: [3, 4],
          objectiveValue: 15,
        },
      },
    ])('$name', ({ params, expected }) => {
      const result = solver.solveAdvanced(params);
      validateSimplexResult(result, expected);
    });
  });
});
