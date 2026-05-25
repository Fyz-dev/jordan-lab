import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvancedSimplexMjvSolver,
  type SimplexParams,
  type SimplexResult,
} from '@/core/maths/advanced-simplex-mjv-solver'; // Оновіть шлях відповідно до структури проєкту

const PRECISION = 2; // Зменшено до 2, оскільки у протоколах округлення йде до сотих (.toFixed(2))

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

  describe('Linear Programming Problems with Mixed Constraints (Advanced MJV Method)', () => {
    it('Task 1: Mixed constraints with equations (=), inequalities (<=) and zero-rows removal', () => {
      const params: SimplexParams = {
        objective: '10x1-x2-42x3-52x4',
        type: 'max',
        varsCount: 4,
        constraints: [
          '-2x1+x2+x3+3x4=2',
          '-3x1+2x2-3x3=7',
          '-3x1+x2+4x3+x4<=1',
          '3x1-2x2+2x3-2x4<=-9',
        ],
      };

      const expected = {
        success: true,
        solution: [9.0, 17.0, 0.0, 1.0],
        objectiveValue: 21.0,
      };

      const result = solver.solve(params);
      validateSimplexResult(result, expected);

      expect(solver.executionLog.length).toBeGreaterThan(0);
      const zeroRowLogs = solver.executionLog.filter(
        log => log.action === 'Видалення нуль-рядків'
      );
      expect(zeroRowLogs.length).toBeGreaterThan(0);
    });
  });
});
