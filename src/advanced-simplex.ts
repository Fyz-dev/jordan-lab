import './style.css';
import {
  AdvancedSimplexMjvSolver,
  type AdvancedSimplexParams,
} from '@/core/maths/advanced-simplex-mjv-solver';

type SimplexType = 'max' | 'min';

const advancedSimplexType = document.querySelector<HTMLSelectElement>(
  '#advancedSimplexType'
)!;
const advancedSimplexVarsCount = document.querySelector<HTMLInputElement>(
  '#advancedSimplexVarsCount'
)!;
const advancedSimplexFreeVars = document.querySelector<HTMLInputElement>(
  '#advancedSimplexFreeVars'
)!;
const advancedSimplexObjective = document.querySelector<HTMLInputElement>(
  '#advancedSimplexObjective'
)!;
const advancedSimplexConstraints = document.querySelector<HTMLTextAreaElement>(
  '#advancedSimplexConstraints'
)!;
const advancedSimplexSolveBtn = document.querySelector<HTMLButtonElement>(
  '#advancedSimplexSolveBtn'
)!;
const advancedSimplexClearBtn = document.querySelector<HTMLButtonElement>(
  '#advancedSimplexClearBtn'
)!;
const advancedSimplexResult = document.querySelector<HTMLTextAreaElement>(
  '#advancedSimplexResult'
)!;

const MIN_VARS = 1;
const MAX_VARS = 10;

function clampVarsCount(raw: number): number {
  if (Number.isNaN(raw)) return MIN_VARS;
  return Math.min(MAX_VARS, Math.max(MIN_VARS, raw));
}

function syncVarsInput() {
  advancedSimplexVarsCount.value = String(
    clampVarsCount(parseInt(advancedSimplexVarsCount.value, 10))
  );
}

function normalizeZero(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function formatNumber(value: number, precision: number = 4): string {
  return normalizeZero(value).toFixed(precision).replace('.', ',');
}

function parseFreeVars(raw: string, varsCount: number): (number | string)[] {
  const tokens = raw
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean);

  const result: (number | string)[] = [];
  const seen = new Set<number>();

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const index = parseInt(token, 10) - 1;
      if (index >= 0 && index < varsCount && !seen.has(index)) {
        seen.add(index);
        result.push(index);
      }
      continue;
    }

    const match = token.match(/^x(\d+)$/i);
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      if (index >= 0 && index < varsCount && !seen.has(index)) {
        seen.add(index);
        result.push(`x${index + 1}`);
      }
    }
  }

  return result;
}

function buildInputParams(): AdvancedSimplexParams {
  syncVarsInput();

  const constraints = advancedSimplexConstraints.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!advancedSimplexObjective.value.trim()) {
    throw new Error('Цільова функція не заповнена.');
  }

  if (constraints.length === 0) {
    throw new Error('Потрібно вказати хоча б одне обмеження.');
  }

  const varsCount = clampVarsCount(
    parseInt(advancedSimplexVarsCount.value, 10)
  );
  const freeVars = parseFreeVars(advancedSimplexFreeVars.value, varsCount);

  return {
    objective: advancedSimplexObjective.value.trim(),
    type: advancedSimplexType.value as SimplexType,
    varsCount,
    constraints,
    freeVars,
  };
}

function formatSolution(solution: number[]): string {
  return solution
    .map((value, index) => `x${index + 1} = ${formatNumber(value)}`)
    .join('\n');
}

function buildOutput(
  params: AdvancedSimplexParams,
  result: {
    success: boolean;
    solution: number[] | null;
    objectiveValue: number | null;
    error?: string;
  }
): string {
  const lines: string[] = [];
  lines.push('Постановка задачі:', '');
  lines.push(`Z = ${params.objective} -> ${params.type}`);
  lines.push('', 'при обмеженнях:', '');
  lines.push(params.constraints.join('\n'));
  lines.push(
    '',
    `вільні змінні: ${params.freeVars?.length ? params.freeVars.join(', ') : 'немає'}`
  );

  if (!result.success) {
    lines.push('', `Помилка: ${result.error ?? 'Невідома помилка.'}`);
    return lines.join('\n').trim();
  }

  lines.push('', "Знайдено оптимальний розв'язок:", '');

  if (result.solution) {
    lines.push(formatSolution(result.solution), '');
  }

  if (result.objectiveValue !== null) {
    const targetLabel = params.type === 'max' ? 'Max' : 'Min';
    lines.push(`${targetLabel} (Z) = ${formatNumber(result.objectiveValue)}`);
  }

  return lines.join('\n').trim();
}

function autosizeResult() {
  advancedSimplexResult.style.height = 'auto';
  advancedSimplexResult.style.height = `${advancedSimplexResult.scrollHeight}px`;
}

function solveAdvancedSimplex() {
  try {
    const params = buildInputParams();
    const solver = new AdvancedSimplexMjvSolver();
    const result = solver.solveAdvanced(params);

    if (!result.success) {
      alert(`Помилка: ${result.error ?? 'Невідома помилка.'}`);
      advancedSimplexResult.value = buildOutput(params, result);
      autosizeResult();
      return;
    }

    advancedSimplexResult.value = buildOutput(params, result);
    autosizeResult();
  } catch (error) {
    alert(
      `Помилка: ${error instanceof Error ? error.message : 'Невідома помилка.'}`
    );
  }
}

function clearAdvancedSimplexForm() {
  advancedSimplexType.value = 'max';
  advancedSimplexVarsCount.value = '3';
  advancedSimplexFreeVars.value = 'x1, x2';
  advancedSimplexObjective.value = '3x1 - 2x2 + 4x3';
  advancedSimplexConstraints.value = 'x1 + x2 = 4\n2x1 - x3 <= 6\nx2 + x3 >= 1';
  advancedSimplexResult.value = '';
  autosizeResult();
}

advancedSimplexSolveBtn.addEventListener('click', solveAdvancedSimplex);
advancedSimplexClearBtn.addEventListener('click', clearAdvancedSimplexForm);
advancedSimplexVarsCount.addEventListener('input', syncVarsInput);

autosizeResult();
