import './style.css';
import {
  SimplexMjvSolver,
  type SimplexParams,
} from '@/core/maths/simplex-mjv-solver';

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

function formatNumber(value: number, precision: number = 4): string {
  const rounded =
    Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

function formatSolution(solution: number[]): string {
  if (!solution.length) return "Розв'язок відсутній.";
  return solution
    .map((value, index) => `x${index + 1} = ${formatNumber(value)}`)
    .join('\n');
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

function formatExecutionLog(
  executionLog: Array<{
    step: number;
    action: string;
    description?: string;
    data?: unknown;
  }>
): string {
  return executionLog
    .map(entry => {
      const parts: string[] = [`Крок #${entry.step}`, entry.action];

      if (entry.description) {
        parts.push(entry.description);
      }

      if (entry.data) {
        parts.push(JSON.stringify(entry.data, null, 2));
      }

      return parts.join('\n');
    })
    .join('\n\n');
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
      simplexResult.value = `Помилка: ${result.error ?? 'Невідома помилка.'}`;
      autosizeResult();
      return;
    }

    const solutionText = result.solution
      ? formatSolution(result.solution)
      : "Розв'язок не знайдено.";
    const objectiveText =
      result.objectiveValue === null
        ? 'Не обчислено'
        : formatNumber(result.objectiveValue);

    simplexResult.value = [
      `Успіх: ${result.success ? 'так' : 'ні'}`,
      `Оптимальне значення цільової функції: ${objectiveText}`,
      '',
      'Знайдений вектор:',
      solutionText,
      '',
      'Протокол обчислення:',
      formatExecutionLog(solver.executionLog),
    ].join('\n');

    autosizeResult();
  } catch (error) {
    simplexResult.value = `Помилка: ${error instanceof Error ? error.message : 'Невідома помилка.'}`;
    autosizeResult();
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
