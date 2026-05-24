export type Matrix = number[][];

export interface MatrixLogEntry {
  matrix?: Matrix;
  vector?: number[];
}

export interface SimplexLogEntry {
  matrix?: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  vector?: number[];
  solution?: number[];
}
