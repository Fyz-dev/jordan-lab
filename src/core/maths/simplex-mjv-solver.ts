import { ComputationLogger } from '../logger';
import type { LogEntry } from '../logger';
import type { SimplexLogEntry } from './types';
import { cloneMatrix, roundData } from './utils';

export interface SimplexParams {
  objective: string;
  type: 'max' | 'min';
  varsCount: number;
  constraints: string[];
}

export interface SimplexResult {
  success: boolean;
  solution: number[] | null;
  objectiveValue: number | null;
  error?: string;
}

export class SimplexMjvSolver {
  private logger = new ComputationLogger<SimplexLogEntry>();

  public get executionLog(): LogEntry<SimplexLogEntry>[] {
    return this.logger.history;
  }

  public solve(params: SimplexParams): SimplexResult {
    this.logger.clear();

    const { objective, type, varsCount, constraints } = params;

    this.logger.log('Постановка задачі', {
      description: `Z = ${objective} → ${type}\nОбмеження:\n${constraints.join('\n')}`,
    });

    let A: number[][] = [];
    let b: number[] = [];

    try {
      for (const c of constraints) {
        if (!c.trim()) continue;
        const isLte = c.includes('<=');
        const isGte = c.includes('>=');

        if (!isLte && !isGte) {
          throw new Error(`Непідтримуваний тип обмеження у рядку: ${c}`);
        }

        const [left, right] = c.split(/<=|>=/);
        let coeffs = this.parseExpression(left, varsCount);
        let freeTerm = parseFloat(right);

        if (isGte) {
          coeffs = coeffs.map(x => -x);
          freeTerm = -freeTerm;
        }

        A.push(coeffs);
        b.push(freeTerm);
      }
    } catch (err: any) {
      return {
        success: false,
        solution: null,
        objectiveValue: null,
        error: err.message,
      };
    }

    let objCoeff = this.parseExpression(objective, varsCount);
    if (type === 'min') {
      objCoeff = objCoeff.map(x => -x);
      this.logger.log('Перехід до задачі максимізації', {
        description: `Z' = ${objCoeff.map((c, i) => `${c}x${i + 1}`).join(' + ')}`,
      });
    }

    const rowsCount = A.length + 1;
    const colsCount = varsCount + 1;
    let matrix: number[][] = Array.from({ length: rowsCount }, () =>
      Array(colsCount).fill(0)
    );

    let rowLabels: string[] = [];
    let colLabels: string[] = [];

    for (let i = 0; i < varsCount; i++) colLabels.push(`-x${i + 1}`);
    colLabels.push('1');

    for (let i = 0; i < A.length; i++) {
      rowLabels.push(`y${i + 1}`);
      for (let j = 0; j < varsCount; j++) {
        matrix[i][j] = A[i][j];
      }
      matrix[i][varsCount] = b[i];
    }

    rowLabels.push('Z');
    for (let j = 0; j < varsCount; j++) {
      matrix[A.length][j] = -objCoeff[j];
    }
    matrix[A.length][varsCount] = 0;

    this.logger.log('Вхідна симплекс-таблиця', {
      data: {
        matrix: cloneMatrix(matrix),
        rowLabels: [...rowLabels],
        colLabels: [...colLabels],
      },
    });

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
        this.logger.log("Помилка: Система не має розв'язків", {
          description: `У рядку ${rowLabels[r]} всі елементи >= 0 при від'ємному вільному члені.`,
        });
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Система обмежень несумісна.',
        };
      }

      this.logger.log(`Етап 1: Крок ${++phase1Iters}`, {
        description: `Розв'язувальний рядок: ${rowLabels[r]}, стовпець: ${colLabels[c]}`,
      });

      const nextData = this.stepMjvPivot(matrix, r, c, rowLabels, colLabels);
      matrix = nextData.matrix;
      rowLabels = nextData.rowLabels;
      colLabels = nextData.colLabels;

      if (phase1Iters > 20) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на Етапі 1.',
        };
      }
    }

    const currentX = this.extractVariables(matrix, rowLabels, varsCount);
    this.logger.log("Знайдено опорний розв'язок", {
      data: { solution: currentX },
    });

    let phase2Iters = 0;
    while (true) {
      let c = -1;
      for (let j = 0; j < colsCount - 1; j++) {
        if (matrix[rowsCount - 1][j] < -1e-6) {
          c = j;
          break;
        }
      }

      if (c === -1) break; // Оптимальность достигнута

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
        this.logger.log('Помилка: Цільова функція не обмежена', {
          description:
            "Цільова функція не обмежена зверху. Оптимального розв'язку не існує.",
        });
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Цільова функція не обмежена.',
        };
      }

      this.logger.log(`Етап 2: Крок ${++phase2Iters}`, {
        description: `Розв'язувальний рядок: ${rowLabels[r]}, стовпець: ${colLabels[c]}`,
      });

      const nextData = this.stepMjvPivot(matrix, r, c, rowLabels, colLabels);
      matrix = nextData.matrix;
      rowLabels = nextData.rowLabels;
      colLabels = nextData.colLabels;

      if (phase2Iters > 20) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на Етапі 2.',
        };
      }
    }

    const finalX = this.extractVariables(matrix, rowLabels, varsCount);
    let zValue = matrix[rowsCount - 1][colsCount - 1];
    if (type === 'min') zValue = -zValue;

    const roundedX = roundData(finalX, 4);
    const roundedZ = Math.round(zValue * 10000) / 10000;

    this.logger.log('Результат обчислень', {
      description: `Знайдено оптимальний розв'язок. Z = ${roundedZ}`,
      data: { solution: roundedX },
    });

    return {
      success: true,
      solution: roundedX,
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

    this.logger.log('Виконано крок МЖВ', {
      data: {
        matrix: cloneMatrix(nextMatrix),
        rowLabels: [...nextRowLabels],
        colLabels: [...nextColLabels],
      },
    });

    return {
      matrix: nextMatrix,
      rowLabels: nextRowLabels,
      colLabels: nextColLabels,
    };
  }

  private extractVariables(
    matrix: number[][],
    rowLabels: string[],
    varsCount: number
  ): number[] {
    const colsCount = matrix[0].length;
    const X = Array(varsCount).fill(0);
    for (let i = 0; i < varsCount; i++) {
      const varName = `x${i + 1}`;
      const rowIdx = rowLabels.indexOf(varName);
      if (rowIdx !== -1) {
        X[i] = matrix[rowIdx][colsCount - 1];
      }
    }
    return X;
  }

  private parseExpression(expr: string, varsCount: number): number[] {
    const coeffs = Array(varsCount).fill(0);
    let normalized = expr.replace(/\s+/g, '').replace(/-/g, '+-');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);

    const parts = normalized.split('+').filter(Boolean);

    for (const p of parts) {
      const match = p.match(/(-?\d*\.?\d*)x(\d+)/);
      if (match) {
        const coefStr = match[1];
        const idx = parseInt(match[2], 10) - 1;

        let coef = 1;
        if (coefStr === '-') coef = -1;
        else if (coefStr !== '') coef = parseFloat(coefStr);

        if (idx >= 0 && idx < varsCount) {
          coeffs[idx] += coef;
        }
      }
    }
    return coeffs;
  }
}
