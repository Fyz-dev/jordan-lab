import { ComputationLogger } from '../logger';
import type { LogEntry } from '../logger';
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

export interface SimplexLogData {
  matrix?: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  solution?: number[];
}

export class AdvancedSimplexMjvSolver {
  private logger = new ComputationLogger<SimplexLogData>();

  public get executionLog(): LogEntry<SimplexLogData>[] {
    return this.logger.history;
  }

  public solve(params: SimplexParams): SimplexResult {
    this.logger.clear();

    const { objective, type, varsCount, constraints } = params;

    let taskDescription = `Постановка задачі:\n\nZ = ${objective} -> ${type}\n\nпри обмеженнях:\n`;
    constraints.forEach(c => {
      if (c.trim()) taskDescription += `${c.trim()}\n`;
    });
    taskDescription += `x[j]>=0, j=1,${varsCount}\n\n`;
    taskDescription += `Перепишемо систему обмежень:\n\n`;

    let matrix: number[][] = [];
    let rowLabels: string[] = [];
    let colLabels: string[] = [];

    for (let i = 1; i <= varsCount; i++) {
      colLabels.push(`-x${i}`);
    }
    colLabels.push('1');

    const fmt = (num: number) =>
      num < 0 ? `(${num.toFixed(2)})` : num.toFixed(2);

    try {
      constraints.forEach((c, idx) => {
        if (!c.trim()) return;

        let symbol = c.includes('<=') ? '<=' : c.includes('>=') ? '>=' : '=';
        const [left, right] = c.split(symbol);
        const coeffs = this.parseExpression(left, varsCount);
        const b = parseFloat(right);

        if (symbol === '=') {
          let multiplier = b > 0 ? -1 : 1;
          let printCoeffs = coeffs.map(v => v * multiplier);
          let printB = -b * multiplier;

          let terms = printCoeffs
            .map((v, i) => `${fmt(v)} * X[${i + 1}]`)
            .join(' + ');
          taskDescription += `${terms} + ${fmt(printB)} = 0\n`;

          matrix.push([...coeffs, b]);
          rowLabels.push('0 =');
        } else if (symbol === '<=') {
          let invCoeffs = coeffs.map(v => -v);
          let termsInv = invCoeffs
            .map((v, i) => `${fmt(v)} * X[${i + 1}]`)
            .join(' + ');
          taskDescription += `${termsInv} + ${fmt(b)} >= 0\n`;

          matrix.push([...coeffs, b]);
          rowLabels.push(`y${idx + 1} =`);
        } else {
          let terms = coeffs
            .map((v, i) => `${fmt(v)} * X[${i + 1}]`)
            .join(' + ');
          taskDescription += `${terms} + ${fmt(-b)} >= 0\n`;

          matrix.push([...coeffs.map(v => -v), -b]);
          rowLabels.push(`y${idx + 1} =`);
        }
      });
    } catch (err: any) {
      return {
        success: false,
        solution: null,
        objectiveValue: null,
        error: err.message,
      };
    }

    const objCoeffs = this.parseExpression(objective, varsCount);
    matrix.push([...objCoeffs.map(x => -x), 0]);
    rowLabels.push('Z =');

    this.logger.log('Вхідна симплекс-таблиця', {
      description: taskDescription,
      data: {
        matrix: cloneMatrix(matrix),
        rowLabels: [...rowLabels],
        colLabels: [...colLabels],
      },
    });

    // 1. ВИДАЛЕННЯ НУЛЬ-РЯДКІВ
    while (true) {
      let r = -1;
      for (let i = 0; i < matrix.length - 1; i++) {
        if (rowLabels[i] === '0 =') {
          r = i;
          break;
        }
      }
      if (r === -1) break;

      let c = -1;
      for (let j = 0; j < matrix[0].length - 1; j++) {
        if (Math.abs(matrix[r][j]) > 1e-6) {
          c = j;
          break;
        }
      }

      if (c !== -1) {
        const stepInfo = this.mjvPivotStep(matrix, r, c, rowLabels, colLabels);
        matrix = stepInfo.matrix;
        rowLabels = stepInfo.rowLabels;
        colLabels = stepInfo.colLabels;

        let colIdx = c;
        matrix.forEach(row => row.splice(colIdx, 1));
        colLabels.splice(colIdx, 1);

        this.logger.log('Видалення нуль-рядків', {
          description: `Виконано перетворення для нуль-рядка та видалено залежний стовпець.`,
          data: {
            matrix: cloneMatrix(matrix),
            rowLabels: [...rowLabels],
            colLabels: [...colLabels],
          },
        });
      } else {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Система обмежень несумісна (неможливо прибрати нуль-рядок).',
        };
      }
    }

    this.logger.log('Всі нуль-рядки видалено', {
      description: 'Всі нуль-рядки успішно вилучено з робочої матриці.',
    });

    // 2. ПОШУК ОПОРНОГО РОЗВ'ЯЗКУ
    let phase1Iters = 0;
    while (true) {
      let r = -1;
      let minB = -1e-6;
      const lastColIdx = matrix[0].length - 1;

      for (let i = 0; i < matrix.length - 1; i++) {
        if (matrix[i][lastColIdx] < minB) {
          minB = matrix[i][lastColIdx];
          r = i;
        }
      }
      if (r === -1) break;

      let c = -1;
      for (let j = 0; j < matrix[0].length - 1; j++) {
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
          error: 'Система обмежень несумісна. Опорний розвʼязок відсутній.',
        };
      }

      const stepInfo = this.mjvPivotStep(matrix, r, c, rowLabels, colLabels);
      matrix = stepInfo.matrix;
      rowLabels = stepInfo.rowLabels;
      colLabels = stepInfo.colLabels;

      this.logger.log('Пошук опорного розв’язку', {
        description: `Розв’язувальний рядок: ${stepInfo.pivotRowName}, стовпець: ${stepInfo.pivotColName}`,
        data: {
          matrix: cloneMatrix(matrix),
          rowLabels: [...rowLabels],
          colLabels: [...colLabels],
        },
      });

      if (++phase1Iters > 30) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на етапі пошуку опорного розвʼязку.',
        };
      }
    }

    const curX = this.extractVariables(varsCount, rowLabels, matrix);
    this.logger.log('Знайдено опорний розв’язок', {
      description: `X = (${curX.map(v => v.toFixed(2)).join('; ')})`,
      data: { solution: [...curX] },
    });

    let phase2Iters = 0;
    while (true) {
      const lastRowIdx = matrix.length - 1;
      let c = -1;
      let minZ = -1e-6;

      for (let j = 0; j < matrix[0].length - 1; j++) {
        if (matrix[lastRowIdx][j] < minZ) {
          minZ = matrix[lastRowIdx][j];
          c = j;
        }
      }
      if (c === -1) break;

      let r = -1;
      let minRatio = Infinity;
      const lastColIdx = matrix[0].length - 1;

      for (let i = 0; i < matrix.length - 1; i++) {
        if (matrix[i][c] > 1e-6) {
          let ratio = matrix[i][lastColIdx] / matrix[i][c];
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
          error:
            'Цільова функція не обмежена. Оптимального розвʼязку не існує.',
        };
      }

      const stepInfo = this.mjvPivotStep(matrix, r, c, rowLabels, colLabels);
      matrix = stepInfo.matrix;
      rowLabels = stepInfo.rowLabels;
      colLabels = stepInfo.colLabels;

      this.logger.log('Пошук оптимального розв’язку', {
        description: `Розв’язувальний рядок: ${stepInfo.pivotRowName}, стовпець: ${stepInfo.pivotColName}`,
        data: {
          matrix: cloneMatrix(matrix),
          rowLabels: [...rowLabels],
          colLabels: [...colLabels],
        },
      });

      if (++phase2Iters > 30) {
        return {
          success: false,
          solution: null,
          objectiveValue: null,
          error: 'Зациклення на етапі оптимізації.',
        };
      }
    }

    const finalX = this.extractVariables(varsCount, rowLabels, matrix);
    let zVal = matrix[matrix.length - 1][matrix[0].length - 1];
    if (type === 'min') zVal = -zVal;

    const roundedX = roundData(finalX, 4);
    const roundedZ = Math.round(zVal * 10000) / 10000;

    this.logger.log('Знайдено оптимальний розв’язок', {
      description: `X = (${roundedX.map(v => v.toFixed(2)).join('; ')})\n${type === 'max' ? 'Max' : 'Min'} (Z) = ${roundedZ.toFixed(2)}`,
      data: {
        solution: roundedX,
        matrix: cloneMatrix(matrix),
        rowLabels: [...rowLabels],
        colLabels: [...colLabels],
      },
    });

    return {
      success: true,
      solution: roundedX,
      objectiveValue: roundedZ,
    };
  }

  private mjvPivotStep(
    matrix: number[][],
    r: number,
    c: number,
    rowLabels: string[],
    colLabels: string[]
  ) {
    const p = matrix[r][c];
    const nextMatrix = Array.from({ length: matrix.length }, () =>
      Array(matrix[0].length).fill(0)
    );

    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[0].length; j++) {
        if (i === r && j === c) nextMatrix[i][j] = 1 / p;
        else if (i === r) nextMatrix[i][j] = matrix[r][j] / p;
        else if (j === c) nextMatrix[i][j] = -matrix[i][c] / p;
        else
          nextMatrix[i][j] = matrix[i][j] - (matrix[i][c] * matrix[r][j]) / p;
      }
    }

    const pivotRowName = rowLabels[r].replace('=', '').trim();
    const pivotColName = colLabels[c];

    const nextRowLabels = [...rowLabels];
    const nextColLabels = [...colLabels];

    let outgoing = pivotRowName;
    let incoming = pivotColName.replace('-', '');

    nextRowLabels[r] = `${incoming} =`;
    nextColLabels[c] = `-${outgoing === '0' ? 'y_null' : outgoing}`;

    return {
      matrix: nextMatrix,
      rowLabels: nextRowLabels,
      colLabels: nextColLabels,
      pivotRowName,
      pivotColName,
    };
  }

  private extractVariables(
    n: number,
    labels: string[],
    matrix: number[][]
  ): number[] {
    const res = Array(n).fill(0);
    const lastColIdx = matrix[0].length - 1;

    labels.forEach((l, i) => {
      if (l.startsWith('x')) {
        const match = l.match(/\d+/);
        if (match) {
          const idx = parseInt(match[0], 10) - 1;
          if (idx < n) {
            res[idx] = matrix[i][lastColIdx];
          }
        }
      }
    });
    return res;
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
        else if (coefStr !== '' && coefStr !== '+') coef = parseFloat(coefStr);

        if (idx >= 0 && idx < varsCount) {
          coeffs[idx] += coef;
        }
      }
    }
    return coeffs;
  }
}
