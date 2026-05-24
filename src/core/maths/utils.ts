import type { Matrix } from './types';

export function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map(row => [...row]);
}

export function roundData(matrix: Matrix, precision?: number): Matrix;
export function roundData(array: number[], precision?: number): number[];
export function roundData(
  data: number[] | Matrix,
  precision: number = 3
): number[] | Matrix {
  const factor = Math.pow(10, precision);
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    return (data as Matrix).map(row =>
      row.map(val => Math.round(val * factor) / factor)
    );
  }

  return (data as number[]).map(val => Math.round(val * factor) / factor);
}
