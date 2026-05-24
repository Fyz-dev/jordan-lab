import type { Matrix } from './types';

export function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map(row => [...row]);
}

export function roundData(matrix: Matrix, precision?: number): Matrix;
export function roundData(array: number[], precision?: number): number[];
export function roundData(data: any, precision: number = 3): any {
  const factor = Math.pow(10, precision);
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return (data as Matrix).map(row =>
      row.map(val => Math.round(val * factor) / factor)
    );
  }
  return (data as number[]).map(val => Math.round(val * factor) / factor);
}
