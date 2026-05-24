import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimplexMjvSolver,
  type SimplexParams,
  type SimplexResult,
} from '@/core/maths/simplex-mjv-solver';

const PRECISION = 3;

describe('SimplexMjvSolver Tests', () => {
  let solver: SimplexMjvSolver;

  beforeEach(() => {
    solver = new SimplexMjvSolver();
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

  describe('Linear Programming Problems (MJV Method)', () => {
    it.each([
      {
        name: 'Task 1: Maximization of the objective function with search for initial feasible and optimal solutions',
        params: {
          objective: '1x1 + 2x2 - 1x3 - 1x4',
          type: 'max',
          varsCount: 4,
          constraints: [
            '1x1 + 1x2 - 1x3 - 2x4 <= 6',
            '1x1 + 1x2 + 1x3 - 1x4 >= 5',
            '2x1 - 1x2 + 3x3 + 4x4 <= 10',
          ],
        } as SimplexParams,
        expected: {
          success: true,
          solution: [0, 22, 0, 8],
          objectiveValue: 36,
        },
      },
      {
        name: 'Task 2: Minimization of the objective function (transition to max) with immediate convergence to optimum',
        params: {
          objective: '-2x1 + 3x2 - 3x4',
          type: 'min',
          varsCount: 4,
          constraints: [
            '1x1 + 1x2 - 1x3 - 2x4 <= 6',
            '1x1 + 1x2 + 1x3 - 1x4 >= 5',
            '2x1 - 1x2 + 3x3 + 4x4 <= 10',
          ],
        } as SimplexParams,
        expected: {
          success: true,
          solution: [5, 0, 0, 0],
          objectiveValue: -10,
        },
      },
    ])('$name', ({ params, expected }) => {
      const result = solver.solve(params);
      validateSimplexResult(result, expected);
    });
  });
});
