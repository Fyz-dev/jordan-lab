import './style.css';
import {
  SimplexMjvSolver,
  type SimplexParams,
} from '@/core/maths/simplex-mjv-solver';
import type { LogEntry } from '@/core/logger';
import type { SimplexLogEntry } from '@/core/maths/types';

type SimplexType = 'max' | 'min';

const simplexType = document.querySelector<HTMLSelectElement>('#simplexType')!;
const simplexVarsCount =
  document.querySelector<HTMLInputElement>('#simplexVarsCount')!;
const simplexObjective =
  document.querySelector<HTMLInputElement>('#simplexObjective')!;
const simplexConstraints = document.querySelector<HTMLTextAreaElement>(
  '#simplexConstraints'
)!;
const simplexSolveBtn =
  document.querySelector<HTMLButtonElement>('#simplexSolveBtn')!;
const simplexClearBtn =
  document.querySelector<HTMLButtonElement>('#simplexClearBtn')!;
const simplexResult =
  document.querySelector<HTMLTextAreaElement>('#simplexResult')!;

const MIN_VARS = 1;
const MAX_VARS = 10;

function clampVarsCount(raw: number): number {
  if (Number.isNaN(raw)) return MIN_VARS;
  return Math.min(MAX_VARS, Math.max(MIN_VARS, raw));
}

function syncVarsInput() {
  simplexVarsCount.value = String(
    clampVarsCount(parseInt(simplexVarsCount.value, 10))
  );
}

function normalizeZero(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function formatNumber(value: number, precision: number = 2): string {
  return normalizeZero(value).toFixed(precision).replace('.', ',');
}

function buildInputParams(): SimplexParams {
  syncVarsInput();

  const constraints = simplexConstraints.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!simplexObjective.value.trim()) {
    throw new Error('Цільова функція не заповнена.');
  }

  if (constraints.length === 0) {
    throw new Error('Потрібно вказати хоча б одне обмеження.');
  }

  return {
    objective: simplexObjective.value.trim(),
    type: simplexType.value as SimplexType,
    varsCount: parseInt(simplexVarsCount.value, 10),
    constraints,
  };
}

function toRowAndColumnLines(description: string): string[] {
  const match = description.match(/рядок:\s*([^,]+),\s*стовпець:\s*(.+)$/i);
  if (!match) return [description];

  return [
    `Розв'язувальний рядок:   ${match[1].trim()}`,
    `Розв'язувальний стовпець: ${match[2].trim()}`,
  ];
}

function formatMatrixTable(
  matrix: number[][],
  rowLabels: string[],
  colLabels: string[]
): string {
  const colWidth = 10;
  const rowPrefix = 5;

  const header =
    ' '.repeat(rowPrefix) +
    colLabels.map(label => label.padStart(colWidth)).join('');

  const separator = '-'.repeat(header.length);

  const rows = matrix.map((row, idx) => {
    const label = `${rowLabels[idx]} =`.padEnd(rowPrefix);
    const values = row
      .map(value => formatNumber(value).padStart(colWidth))
      .join('');
    return `${label}${values}`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatRewrittenConstraints(
  matrix: number[][],
  colLabels: string[]
): string {
  const varsColumns = colLabels.length - 1;
  const lines: string[] = [];

  for (let i = 0; i < matrix.length - 1; i++) {
    const terms: string[] = [];

    for (let j = 0; j < varsColumns; j++) {
      const coeff = -matrix[i][j];
      terms.push(`(${formatNumber(coeff)}) * X[${j + 1}]`);
    }

    terms.push(`(${formatNumber(matrix[i][varsColumns])})`);
    lines.push(`${terms.join(' + ')} >= 0`);
  }

  return lines.join('\n');
}

function formatSolutionTuple(solution: number[]): string {
  return `X = (${solution.map(value => formatNumber(value)).join('; ')})`;
}

function buildProtocol(
  params: SimplexParams,
  executionLog: LogEntry<SimplexLogEntry>[],
  objectiveValue: number | null
): string {
  const blocks: string[] = [];
  let inPhase1 = false;
  let inPhase2 = false;
  let pendingPivotTable = false;

  const inputTable = executionLog.find(
    entry => entry.action === 'Вхідна симплекс-таблиця'
  );

  blocks.push('Постановка задачі:', '');
  blocks.push(`Z = ${params.objective} -> ${params.type}`);
  blocks.push('', 'при обмеженнях:', '');
  blocks.push(params.constraints.join('\n'));
  blocks.push('', `x[j]>=0, j=1,${params.varsCount}`, '');

  if (
    inputTable?.data?.matrix &&
    inputTable.data.colLabels &&
    inputTable.data.colLabels.length
  ) {
    blocks.push('Перепишемо систему обмежень:', '');
    blocks.push(
      formatRewrittenConstraints(
        inputTable.data.matrix,
        inputTable.data.colLabels
      )
    );
    blocks.push('');
  }

  for (const entry of executionLog) {
    if (entry.action === 'Вхідна симплекс-таблиця' && entry.data?.matrix) {
      blocks.push('Вхідна симплекс-таблиця:', '');
      blocks.push(
        formatMatrixTable(
          entry.data.matrix,
          entry.data.rowLabels ?? [],
          entry.data.colLabels ?? []
        )
      );
      blocks.push('');
      continue;
    }

    if (entry.action.startsWith('Етап 1:')) {
      if (!inPhase1) {
        blocks.push("Пошук опорного розв'язку:", '');
        inPhase1 = true;
      }

      if (entry.description) {
        blocks.push(...toRowAndColumnLines(entry.description), '');
      }

      pendingPivotTable = true;
      continue;
    }

    if (entry.action === "Знайдено опорний розв'язок") {
      blocks.push("Знайдено опорний розв'язок:", '');
      if (entry.data?.solution) {
        blocks.push(formatSolutionTuple(entry.data.solution), '');
      }
      continue;
    }

    if (entry.action.startsWith('Етап 2:')) {
      if (!inPhase2) {
        blocks.push("Пошук оптимального розв'язку:", '');
        inPhase2 = true;
      }

      if (entry.description) {
        blocks.push(...toRowAndColumnLines(entry.description), '');
      }

      pendingPivotTable = true;
      continue;
    }

    if (entry.action === 'Виконано крок МЖВ' && entry.data?.matrix) {
      if (pendingPivotTable) {
        blocks.push(
          formatMatrixTable(
            entry.data.matrix,
            entry.data.rowLabels ?? [],
            entry.data.colLabels ?? []
          )
        );
        blocks.push('');
      }

      pendingPivotTable = false;
      continue;
    }

    if (entry.action === 'Результат обчислень') {
      blocks.push("Знайдено оптимальний розв'язок:");

      if (entry.data?.solution) {
        blocks.push('', formatSolutionTuple(entry.data.solution));
      }

      if (objectiveValue !== null) {
        const targetLabel = params.type === 'max' ? 'Max' : 'Min';
        blocks.push('', `${targetLabel} (Z) = ${formatNumber(objectiveValue)}`);
      }
    }
  }

  return blocks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function autosizeResult() {
  simplexResult.style.height = 'auto';
  simplexResult.style.height = `${simplexResult.scrollHeight}px`;
}

function solveSimplex() {
  try {
    const params = buildInputParams();
    const solver = new SimplexMjvSolver();
    const result = solver.solve(params);

    if (!result.success) {
      alert(`Помилка: ${result.error ?? 'Невідома помилка.'}`);
      return;
    }

    simplexResult.value = buildProtocol(
      params,
      solver.executionLog,
      result.objectiveValue
    );

    autosizeResult();
  } catch (error) {
    alert(
      `Помилка: ${error instanceof Error ? error.message : 'Невідома помилка.'}`
    );
  }
}

function clearSimplexForm() {
  simplexType.value = 'max';
  simplexVarsCount.value = '2';
  simplexObjective.value = '3x1 + 5x2';
  simplexConstraints.value = '2x1 + 3x2 <= 8\nx1 + x2 <= 4';
  simplexResult.value = '';
  autosizeResult();
}

simplexSolveBtn.addEventListener('click', solveSimplex);
simplexClearBtn.addEventListener('click', clearSimplexForm);
simplexVarsCount.addEventListener('input', syncVarsInput);

autosizeResult();
