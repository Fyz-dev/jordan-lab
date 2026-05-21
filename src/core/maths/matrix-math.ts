import { ComputationLogger } from '../logger';
import type { MatrixLogEntry } from './types';

export type Matrix = number[][];

export class MatrixMath {
  private logger = new ComputationLogger<MatrixLogEntry>();

  get executionLog() {
    return this.logger.history;
  }

  public invertMatrix(A: Matrix, shouldClear: boolean = true): Matrix | null {
    if (shouldClear) this.logger.clear();

    // must be a non-empty square matrix
    if (!A || A.length === 0) {
      throw new Error('Обернення матриці неможливе: порожня матриця');
    }

    const n = A.length;
    for (let r = 0; r < n; r++) {
      if (!Array.isArray(A[r]) || A[r].length !== n) {
        throw new Error(
          'Обернення матриці неможливе: матриця повинна бути квадратною'
        );
      }
    }
    let res = A.map(row => [...row]);

    for (let k = 0; k < n; k++) {
      const pivot = res[k][k];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error(
          `Матриця вироджена: опорний елемент A[${k + 1}, ${k + 1}] = ${pivot.toFixed(6)}`
        );
      }

      res = this.stepJordanElimination(res, k, k);
    }

    this.logger.log('\nОбернена матриця:', { data: { matrix: res } });

    return this.roundData(res);
  }

  public solveLinearSystem(A: Matrix, B: number[]): number[] | null {
    this.logger.clear();

    const invA = this.invertMatrix(A, false);

    if (!invA) return null;

    this.logger.log('Вхідна матриця B:', {
      data: { vector: B },
    });

    const n = invA.length;
    const X: number[] = new Array(n).fill(0);
    const paths: string[] = [];

    for (let i = 0; i < n; i++) {
      let path = `X[${i + 1}] = `;

      for (let j = 0; j < n; j++) {
        const coeff = invA[i][j];
        X[i] += coeff * B[j];

        const formattedCoeff =
          coeff >= 0
            ? coeff.toFixed(2).replace('.', ',')
            : `(${coeff.toFixed(2).replace('.', ',')})`;

        path += `${B[j].toFixed(2).replace('.', ',')} * ${formattedCoeff}`;

        if (j < n - 1) path += ' + ';
      }

      path += ` = ${X[i].toFixed(2).replace('.', ',')}`;
      paths.push(path);
    }

    this.logger.log("Обчислення розв'язків:", {
      description: paths.join('\n'),
    });

    return this.roundData(X, 1);
  }

  public calculateRank(matrix: Matrix): number {
    this.logger.clear();
    this.logger.log('Вхідна матриця:', { data: { matrix } });

    let temp = matrix.map(row => [...row]);
    const rows = temp.length;
    const cols = temp[0].length;
    let rank = 0;
    let pivotRow = 0;

    for (let j = 0; j < cols && pivotRow < rows; j++) {
      let maxRow = pivotRow;
      for (let i = pivotRow + 1; i < rows; i++) {
        if (Math.abs(temp[i][j]) > Math.abs(temp[maxRow][j])) maxRow = i;
      }

      if (Math.abs(temp[maxRow][j]) > 1e-10) {
        if (maxRow !== pivotRow) {
          [temp[pivotRow], temp[maxRow]] = [temp[maxRow], temp[pivotRow]];
          this.logger.log(
            `Перестановка рядків ${pivotRow + 1} ↔ ${maxRow + 1}`
          );
        }

        temp = this.stepJordanElimination(temp, pivotRow, j);

        rank++;
        pivotRow++;
      }
    }

    this.logger.log(`\nРанг матриці: ${rank}`);
    return rank;
  }

  private stepJordanElimination(
    matrix: Matrix,
    row: number,
    col: number
  ): Matrix {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const pivot = matrix[row][col];
    const nextMatrix: Matrix = Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    );

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (i === row && j === col) nextMatrix[i][j] = 1 / pivot;
        else if (i === row) nextMatrix[i][j] = -matrix[row][j] / pivot;
        else if (j === col) nextMatrix[i][j] = matrix[i][col] / pivot;
        else
          nextMatrix[i][j] =
            matrix[i][j] - (matrix[i][col] * matrix[row][j]) / pivot;
      }
    }

    this.logger.log(
      `Розв'язувальний елемент: A[${row + 1}, ${col + 1}] = ${pivot.toFixed(2).replace('.', ',')}`,
      {
        description: 'Матриця після виконання ЗЖВ:',
        data: {
          matrix: nextMatrix,
        },
      }
    );

    return nextMatrix;
  }

  private roundData<T extends Matrix | number[]>(
    data: T,
    precision: number = 3
  ): T {
    const factor = Math.pow(10, precision);
    if (Array.isArray(data[0])) {
      return (data as Matrix).map(row =>
        row.map(val => Math.round(val * factor) / factor)
      ) as T;
    }
    return (data as number[]).map(
      val => Math.round(val * factor) / factor
    ) as T;
  }
}
