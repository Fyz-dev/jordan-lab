import './style.css';
import {
  AdvancedSimplexMjvSolver,
  type SimplexParams,
  type SimplexLogData,
} from '@/core/maths/advanced-simplex-mjv-solver';
import type { LogEntry } from '@/core/logger';

type SimplexType = 'max' | 'min';

type TableSnapshot = {
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
};

const simplexType =
  document.querySelector<HTMLSelectElement>('#mixedSimplexType')!;
const simplexVarsCount = document.querySelector<HTMLInputElement>(
  '#mixedSimplexVarsCount'
)!;
const simplexObjective = document.querySelector<HTMLInputElement>(
  '#mixedSimplexObjective'
)!;
const simplexConstraints = document.querySelector<HTMLTextAreaElement>(
  '#mixedSimplexConstraints'
)!;
const simplexSolveBtn = document.querySelector<HTMLButtonElement>(
  '#mixedSimplexSolveBtn'
)!;
const simplexClearBtn = document.querySelector<HTMLButtonElement>(
  '#mixedSimplexClearBtn'
)!;
const simplexResult = document.querySelector<HTMLTextAreaElement>(
  '#mixedSimplexResult'
)!;

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

function formatSignedNumber(value: number, precision: number = 2): string {
  const formatted = formatNumber(value, precision);
  return value < 0 ? `(${formatted})` : formatted;
}

function parseExpression(expr: string, varsCount: number): number[] {
  const coeffs = Array(varsCount).fill(0);
  let normalized = expr.replace(/\s+/g, '').replace(/-/g, '+-');
  if (normalized.startsWith('+')) normalized = normalized.substring(1);

  const parts = normalized.split('+').filter(Boolean);

  for (const part of parts) {
    const match = part.match(/(-?\d*\.?\d*)x(\d+)/);
    if (!match) continue;

    const coefStr = match[1];
    const idx = parseInt(match[2], 10) - 1;
    let coef = 1;

    if (coefStr === '-') coef = -1;
    else if (coefStr !== '' && coefStr !== '+') coef = parseFloat(coefStr);

    if (idx >= 0 && idx < varsCount) {
      coeffs[idx] += coef;
    }
  }

  return coeffs;
}

function normalizeObjective(objective: string): string {
  return objective.replace(/\s+/g, '');
}

function normalizeConstraintLine(line: string): string {
  const operator = line.includes('<=')
    ? '<='
    : line.includes('>=')
      ? '>='
      : '=';
  const [leftRaw = '', rightRaw = ''] = line.split(operator);
  const left = leftRaw.replace(/\s+/g, '');
  const right = rightRaw.trim().replace(/\s+/g, '');

  if (operator === '=') {
    return `${left}=${right}`;
  }

  return `${left} ${operator} ${right}`;
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
  const rowPrefix = Math.max(6, ...rowLabels.map(label => label.length + 1));

  const header =
    ' '.repeat(rowPrefix) +
    colLabels.map(label => label.padStart(colWidth)).join('');

  const separator = '-'.repeat(header.length);

  const rows = matrix.map((row, idx) => {
    const label = (rowLabels[idx] ?? '').padEnd(rowPrefix);
    const values = row
      .map(value => formatNumber(value).padStart(colWidth))
      .join('');
    return `${label}${values}`;
  });

  return [header, separator, ...rows].join('\n');
}

function formatRewrittenConstraint(line: string, varsCount: number): string {
  const operator = line.includes('<=')
    ? '<='
    : line.includes('>=')
      ? '>='
      : '=';
  const [leftRaw = '', rightRaw = ''] = line.split(operator);
  const coeffs = parseExpression(leftRaw, varsCount);
  const b = parseFloat(rightRaw);

  if (operator === '=') {
    const multiplier = b > 0 ? -1 : 1;
    const printCoeffs = coeffs.map(value => value * multiplier);
    const printB = -b * multiplier;

    const terms = printCoeffs
      .map((value, index) => `${formatSignedNumber(value)} * X[${index + 1}]`)
      .join(' + ');

    return `${terms} + ${formatSignedNumber(printB)} = 0`;
  }

  if (operator === '<=') {
    const invCoeffs = coeffs.map(value => -value);
    const terms = invCoeffs
      .map((value, index) => `${formatSignedNumber(value)} * X[${index + 1}]`)
      .join(' + ');

    return `${terms} + ${formatSignedNumber(b)} >= 0`;
  }

  const terms = coeffs
    .map((value, index) => `${formatSignedNumber(value)} * X[${index + 1}]`)
    .join(' + ');

  return `${terms} + ${formatSignedNumber(-b)} >= 0`;
}

function formatSolutionTuple(solution: number[]): string {
  return `X = (${solution.map(value => formatNumber(value)).join('; ')})`;
}

function getCurrentTableFromLog(
  entry: LogEntry<SimplexLogData> | undefined
): TableSnapshot | null {
  if (!entry?.data?.matrix || !entry.data.rowLabels || !entry.data.colLabels) {
    return null;
  }

  return {
    matrix: entry.data.matrix,
    rowLabels: entry.data.rowLabels,
    colLabels: entry.data.colLabels,
  };
}

function buildAuxLabelMap(table: TableSnapshot): Map<number, number> {
  const map = new Map<number, number>();
  let nextIndex = 1;

  for (const label of table.rowLabels) {
    const match = label.match(/^y(\d+)\s*=\s*$/);
    if (!match) continue;

    const sourceIndex = parseInt(match[1], 10);
    if (!map.has(sourceIndex)) {
      map.set(sourceIndex, nextIndex++);
    }
  }

  return map;
}

function remapLabel(label: string, auxMap: Map<number, number>): string {
  const rowMatch = label.match(/^(-?)y(\d+)(\s*=\s*)?$/);
  if (rowMatch) {
    const mappedIndex = auxMap.get(parseInt(rowMatch[2], 10));
    if (mappedIndex) {
      return `${rowMatch[1]}y${mappedIndex}${rowMatch[3] ?? ''}`;
    }
  }

  const colMatch = label.match(/^(-?)y(\d+)$/);
  if (colMatch) {
    const mappedIndex = auxMap.get(parseInt(colMatch[2], 10));
    if (mappedIndex) {
      return `${colMatch[1]}y${mappedIndex}`;
    }
  }

  return label;
}

function remapTableSnapshot(
  table: TableSnapshot,
  auxMap: Map<number, number>
): TableSnapshot {
  return {
    matrix: table.matrix,
    rowLabels: table.rowLabels.map(label => remapLabel(label, auxMap)),
    colLabels: table.colLabels.map(label => remapLabel(label, auxMap)),
  };
}

function getDisplayedRowRank(label: string): [number, number] {
  const xMatch = label.match(/^x(\d+)\s*=\s*$/);
  if (xMatch) {
    const index = parseInt(xMatch[1], 10);
    return [index === 1 ? 0 : 2, index];
  }

  const yMatch = label.match(/^y(\d+)\s*=\s*$/);
  if (yMatch) {
    return [1, parseInt(yMatch[1], 10)];
  }

  if (label === 'Z =') {
    return [3, 0];
  }

  return [4, Number.MAX_SAFE_INTEGER];
}

function sortDisplayedTableRows(table: TableSnapshot): TableSnapshot {
  const entries = table.rowLabels.map((label, index) => ({
    label,
    index,
    row: table.matrix[index],
  }));

  entries.sort((left, right) => {
    const [leftRank, leftIndex] = getDisplayedRowRank(left.label);
    const [rightRank, rightIndex] = getDisplayedRowRank(right.label);

    if (leftRank !== rightRank) return leftRank - rightRank;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.index - right.index;
  });

  return {
    matrix: entries.map(entry => entry.row),
    rowLabels: entries.map(entry => entry.label),
    colLabels: [...table.colLabels],
  };
}

function remapDescription(
  description: string,
  auxMap: Map<number, number>
): string {
  return description.replace(/-?y\d+/g, label => remapLabel(label, auxMap));
}

function findFirstPivotOnZeroRow(table: TableSnapshot): {
  rowLabel: string;
  colLabel: string;
} | null {
  const zeroRowIndex = table.rowLabels.findIndex(label => label === '0 =');
  if (zeroRowIndex === -1) return null;

  const row = table.matrix[zeroRowIndex];
  let pivotColIndex = row.findIndex(value => value > 1e-6);
  if (pivotColIndex === -1) {
    pivotColIndex = row.findIndex(value => Math.abs(value) > 1e-6);
  }
  if (pivotColIndex === -1) return null;

  return {
    rowLabel: table.rowLabels[zeroRowIndex].replace('=', '').trim(),
    colLabel: table.colLabels[pivotColIndex],
  };
}

function buildProtocol(
  params: SimplexParams,
  executionLog: LogEntry<SimplexLogData>[],
  objectiveValue: number | null
): string {
  const blocks: string[] = [];
  let currentTable: TableSnapshot | null = null;
  let phaseDisplayMap: Map<number, number> | null = null;
  let zeroRowStepIndex = 0;

  blocks.push('Постановка задачі:', '');
  blocks.push(`Z = ${normalizeObjective(params.objective)} -> ${params.type}`);
  blocks.push('', 'при обмеженнях:');

  for (const line of params.constraints) {
    blocks.push(normalizeConstraintLine(line));
  }

  blocks.push(
    '',
    `x[j]>=0, j=1,${params.varsCount}`,
    '',
    'Перепишемо систему обмежень:',
    ''
  );

  for (const line of params.constraints) {
    blocks.push(formatRewrittenConstraint(line, params.varsCount));
  }

  blocks.push('');

  const inputTable = executionLog.find(
    entry => entry.action === 'Вхідна симплекс-таблиця'
  );

  if (
    inputTable?.data?.matrix &&
    inputTable.data.rowLabels &&
    inputTable.data.colLabels
  ) {
    blocks.push('Вхідна симплекс-таблиця:', '');
    blocks.push(
      formatMatrixTable(
        inputTable.data.matrix,
        inputTable.data.rowLabels,
        inputTable.data.colLabels
      ),
      ''
    );
    currentTable = getCurrentTableFromLog(inputTable);
  }

  for (const entry of executionLog) {
    if (entry.action === 'Вхідна симплекс-таблиця') {
      continue;
    }

    if (entry.action === 'Видалення нуль-рядків' && entry.data?.matrix) {
      blocks.push('Видалення нуль-рядків:', '');

      const zeroPivot = currentTable
        ? findFirstPivotOnZeroRow(currentTable)
        : null;
      if (zeroPivot) {
        zeroRowStepIndex += 1;
        blocks.push(
          `Розв'язувальний рядок:   y${zeroRowStepIndex}`,
          `Розв'язувальний стовпець: ${zeroPivot.colLabel}`,
          ''
        );
      }

      blocks.push(
        formatMatrixTable(
          entry.data.matrix,
          entry.data.rowLabels ?? [],
          entry.data.colLabels ?? []
        ),
        ''
      );

      currentTable = getCurrentTableFromLog(entry);
      continue;
    }

    if (entry.action === 'Всі нуль-рядки видалено') {
      blocks.push('Всі нуль-рядки видалено.', '');
      phaseDisplayMap = currentTable ? buildAuxLabelMap(currentTable) : null;
      continue;
    }

    if (entry.action === 'Пошук опорного розв’язку' && entry.data?.matrix) {
      blocks.push("Пошук опорного розв'язку:", '');

      if (entry.description) {
        const mappedDescription = phaseDisplayMap
          ? remapDescription(entry.description, phaseDisplayMap)
          : entry.description;
        blocks.push(...toRowAndColumnLines(mappedDescription), '');
      }

      const displayTable = phaseDisplayMap
        ? remapTableSnapshot(
            {
              matrix: entry.data.matrix,
              rowLabels: entry.data.rowLabels ?? [],
              colLabels: entry.data.colLabels ?? [],
            },
            phaseDisplayMap
          )
        : {
            matrix: entry.data.matrix,
            rowLabels: entry.data.rowLabels ?? [],
            colLabels: entry.data.colLabels ?? [],
          };
      const sortedDisplayTable = phaseDisplayMap
        ? sortDisplayedTableRows(displayTable)
        : displayTable;

      blocks.push(
        formatMatrixTable(
          sortedDisplayTable.matrix,
          sortedDisplayTable.rowLabels,
          sortedDisplayTable.colLabels
        ),
        ''
      );

      currentTable = getCurrentTableFromLog(entry);
      continue;
    }

    if (entry.action === 'Знайдено опорний розв’язок') {
      blocks.push("Знайдено опорний розв'язок:", '');
      if (entry.data?.solution) {
        blocks.push(formatSolutionTuple(entry.data.solution), '');
      }
      continue;
    }

    if (entry.action === 'Пошук оптимального розв’язку' && entry.data?.matrix) {
      blocks.push("Пошук оптимального розв'язку:", '');

      if (entry.description) {
        const mappedDescription = phaseDisplayMap
          ? remapDescription(entry.description, phaseDisplayMap)
          : entry.description;
        blocks.push(...toRowAndColumnLines(mappedDescription), '');
      }

      const displayTable = phaseDisplayMap
        ? remapTableSnapshot(
            {
              matrix: entry.data.matrix,
              rowLabels: entry.data.rowLabels ?? [],
              colLabels: entry.data.colLabels ?? [],
            },
            phaseDisplayMap
          )
        : {
            matrix: entry.data.matrix,
            rowLabels: entry.data.rowLabels ?? [],
            colLabels: entry.data.colLabels ?? [],
          };
      const sortedDisplayTable = phaseDisplayMap
        ? sortDisplayedTableRows(displayTable)
        : displayTable;

      blocks.push(
        formatMatrixTable(
          sortedDisplayTable.matrix,
          sortedDisplayTable.rowLabels,
          sortedDisplayTable.colLabels
        ),
        ''
      );

      currentTable = getCurrentTableFromLog(entry);
      continue;
    }

    if (entry.action === 'Знайдено оптимальний розв’язок') {
      blocks.push("Знайдено оптимальний розв'язок:", '');

      if (entry.data?.solution) {
        blocks.push(formatSolutionTuple(entry.data.solution), '');
      }

      if (objectiveValue !== null) {
        const targetLabel = params.type === 'max' ? 'Max' : 'Min';
        blocks.push(`${targetLabel} (Z) = ${formatNumber(objectiveValue)}`);
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
    const solver = new AdvancedSimplexMjvSolver();
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
  simplexVarsCount.value = '4';
  simplexObjective.value = '10x1 - x2 - 42x3 - 52x4';
  simplexConstraints.value = `-2x1 + x2 + x3 + 3x4 = 2
-3x1 + 2x2 - 3x3 = 7
-3x1 + x2 + 4x3 + x4 <= 1
3x1 - 2x2 + 2x3 - 2x4 <= -9`;
  simplexResult.value = '';
  autosizeResult();
}

simplexSolveBtn.addEventListener('click', solveSimplex);
simplexClearBtn.addEventListener('click', clearSimplexForm);
simplexVarsCount.addEventListener('input', syncVarsInput);

autosizeResult();
