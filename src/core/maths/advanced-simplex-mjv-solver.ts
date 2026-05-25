import type { SimplexResult } from '@/core/maths/simplex-mjv-solver';

export interface AdvancedSimplexParams {
  objective: string;
  type: 'max' | 'min';
  varsCount: number;
  constraints: string[];
  freeVars?: (number | string)[];
}

export class AdvancedSimplexMjvSolver {
  public solveAdvanced(params: AdvancedSimplexParams): SimplexResult {
    const originalVarsCount = params.varsCount;
    const { objective, type, constraints, freeVars = [] } = params;

    const freeIndices = new Set<number>();
    for (const fv of freeVars) {
      if (typeof fv === 'number') {
        freeIndices.add(fv);
      } else if (typeof fv === 'string') {
        const match = fv.trim().match(/^x(\d+)$/i);
        if (match) {
          freeIndices.add(parseInt(match[1], 10) - 1);
        }
      }
    }

    const varMapping: { originalIdx: number; sign: 1 | -1; newIdx: number }[] =
      [];
    let nextNewIdx = 0;

    for (let i = 0; i < originalVarsCount; i++) {
      if (freeIndices.has(i)) {
        varMapping.push({ originalIdx: i, sign: 1, newIdx: nextNewIdx++ });
        varMapping.push({ originalIdx: i, sign: -1, newIdx: nextNewIdx++ });
      } else {
        varMapping.push({ originalIdx: i, sign: 1, newIdx: nextNewIdx++ });
      }
    }

    const extendedVarsCount = nextNewIdx;

    let A: number[][] = [];
    let b: number[] = [];

    try {
      for (const c of constraints) {
        if (!c.trim()) continue;

        const isEq = c.includes('=') && !c.includes('<=') && !c.includes('>=');
        const isLte = c.includes('<=');
        const isGte = c.includes('>=');

        if (!isEq && !isLte && !isGte) {
          throw new Error(`Неподдерживаемый тип ограничения: ${c}`);
        }

        const [leftStr, rightStr] = c.split(/<=|>=|=/);

        const { coeffs: origCoeffs, extraConstant } =
          this.parseExpressionWithConstant(leftStr, originalVarsCount);
        const baseRightConstant = parseFloat(rightStr.trim()) || 0;

        let freeTerm = baseRightConstant - extraConstant;

        const extendedCoeffs = new Array(extendedVarsCount).fill(0);
        for (const mapItem of varMapping) {
          extendedCoeffs[mapItem.newIdx] +=
            origCoeffs[mapItem.originalIdx] * mapItem.sign;
        }

        if (isEq) {
          A.push([...extendedCoeffs]);
          b.push(freeTerm);
          A.push(extendedCoeffs.map(x => -x));
          b.push(-freeTerm);
        } else if (isLte) {
          A.push([...extendedCoeffs]);
          b.push(freeTerm);
        } else if (isGte) {
          A.push(extendedCoeffs.map(x => -x));
          b.push(-freeTerm);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Невідома помилка.';
      return {
        success: false,
        solution: null,
        objectiveValue: null,
        error: message,
      };
    }

    const { coeffs: origObjCoeff } = this.parseExpressionWithConstant(
      objective,
      originalVarsCount
    );
    let objCoeff = new Array(extendedVarsCount).fill(0);
    for (const mapItem of varMapping) {
      objCoeff[mapItem.newIdx] +=
        origObjCoeff[mapItem.originalIdx] * mapItem.sign;
    }

    if (type === 'min') {
      objCoeff = objCoeff.map(x => -x);
    }

    const rowsCount = A.length + 1;
    const colsCount = extendedVarsCount + 1;
    let matrix: number[][] = Array.from({ length: rowsCount }, () =>
      Array(colsCount).fill(0)
    );

    let rowLabels: string[] = [];
    let colLabels: string[] = [];

    for (let j = 0; j < extendedVarsCount; j++) colLabels.push(`-x${j + 1}`);
    colLabels.push('1');

    for (let i = 0; i < A.length; i++) {
      rowLabels.push(`y${i + 1}`);
      for (let j = 0; j < extendedVarsCount; j++) {
        matrix[i][j] = A[i][j];
      }
      matrix[i][extendedVarsCount] = b[i];
    }

    rowLabels.push('Z');
    for (let j = 0; j < extendedVarsCount; j++) {
      matrix[A.length][j] = -objCoeff[j];
    }
    matrix[A.length][extendedVarsCount] = 0;

    let phase1Iters = 0;
    while (true) {
      let r = -1;
      let minB = -1e-6;

      for (let i = 0; i < rowsCount - 1; i++) {
        if (matrix[i][colsCount - 1] < minB) {
          minB = matrix[i][colsCount - 1];
          r = i;
        }
      }

      if (r === -1) break;

      let c = -1;
      for (let j = 0; j < colsCount - 1; j++) {
        if (matrix[r][j] < -1e-6) {
          c = j;
          break;
        }
      }

      if (c === -1) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Система обмежень несумісна.',
        };
      }

      const nextData = this.stepMjvPivot(matrix, r, c, rowLabels, colLabels);
      matrix = nextData.matrix;
      rowLabels = nextData.rowLabels;
      colLabels = nextData.colLabels;

      if (++phase1Iters > 50) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на Етапі 1.',
        };
      }
    }

    let phase2Iters = 0;
    while (true) {
      let c = -1;
      for (let j = 0; j < colsCount - 1; j++) {
        if (matrix[rowsCount - 1][j] < -1e-6) {
          c = j;
          break;
        }
      }

      if (c === -1) break;

      let r = -1;
      let minRatio = Infinity;

      for (let i = 0; i < rowsCount - 1; i++) {
        if (matrix[i][c] > 1e-6) {
          const ratio = matrix[i][colsCount - 1] / matrix[i][c];
          if (ratio < minRatio) {
            minRatio = ratio;
            r = i;
          }
        }
      }

      if (r === -1) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Цільова функція не обмежена.',
        };
      }

      const nextData = this.stepMjvPivot(matrix, r, c, rowLabels, colLabels);
      matrix = nextData.matrix;
      rowLabels = nextData.rowLabels;
      colLabels = nextData.colLabels;

      if (++phase2Iters > 50) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на Етапі 2.',
        };
      }
    }

    const extendedSolution: number[] = Array(extendedVarsCount).fill(0);
    for (let j = 0; j < extendedVarsCount; j++) {
      const varName = `x${j + 1}`;
      const rowIdx = rowLabels.indexOf(varName);
      if (rowIdx !== -1) {
        extendedSolution[j] = matrix[rowIdx][colsCount - 1];
      }
    }

    const finalSolution: number[] = Array(originalVarsCount).fill(0);
    for (const mapItem of varMapping) {
      finalSolution[mapItem.originalIdx] +=
        extendedSolution[mapItem.newIdx] * mapItem.sign;
    }

    let zValue = matrix[rowsCount - 1][colsCount - 1];
    if (type === 'min') zValue = -zValue;

    const roundedSolution: number[] = finalSolution.map(
      val => Math.round(val * 10000) / 10000
    );
    const roundedZ = Math.round(zValue * 10000) / 10000;

    return {
      success: true,
      solution: roundedSolution,
      objectiveValue: roundedZ,
    };
  }

  private stepMjvPivot(
    matrix: number[][],
    r: number,
    c: number,
    rowLabels: string[],
    colLabels: string[]
  ): { matrix: number[][]; rowLabels: string[]; colLabels: string[] } {
    const rowsCount = matrix.length;
    const colsCount = matrix[0].length;
    const p = matrix[r][c];

    const nextMatrix = Array.from({ length: rowsCount }, () =>
      Array(colsCount).fill(0)
    );
    const nextRowLabels = [...rowLabels];
    const nextColLabels = [...colLabels];

    for (let i = 0; i < rowsCount; i++) {
      for (let j = 0; j < colsCount; j++) {
        if (i === r && j === c) {
          nextMatrix[i][j] = 1 / p;
        } else if (i === r) {
          nextMatrix[i][j] = matrix[r][j] / p;
        } else if (j === c) {
          nextMatrix[i][j] = -matrix[i][c] / p;
        } else {
          nextMatrix[i][j] = matrix[i][j] - (matrix[i][c] * matrix[r][j]) / p;
        }
      }
    }

    const tempStr = nextRowLabels[r];
    nextRowLabels[r] = nextColLabels[c].replace('-', '');
    nextColLabels[c] = '-' + tempStr.replace('-', '');

    return {
      matrix: nextMatrix,
      rowLabels: nextRowLabels,
      colLabels: nextColLabels,
    };
  }

  private parseExpressionWithConstant(
    expr: string,
    varsCount: number
  ): { coeffs: number[]; extraConstant: number } {
    const coeffs = Array(varsCount).fill(0);
    let extraConstant = 0;

    let normalized = expr.replace(/\s+/g, '').replace(/-/g, '+-');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);

    const parts = normalized.split('+').filter(Boolean);

    for (const p of parts) {
      const varMatch = p.match(/(-?\d*\.?\d*)x(\d+)/);
      if (varMatch) {
        const coefStr = varMatch[1];
        const idx = parseInt(varMatch[2], 10) - 1;

        let coef = 1;
        if (coefStr === '-') coef = -1;
        else if (coefStr !== '') coef = parseFloat(coefStr);

        if (idx >= 0 && idx < varsCount) {
          coeffs[idx] += coef;
        }
      } else {
        const num = parseFloat(p);
        if (!isNaN(num)) {
          extraConstant += num;
        }
      }
    }

    return { coeffs, extraConstant };
  }
}
