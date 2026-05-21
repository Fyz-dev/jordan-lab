import './style.css';
import { MatrixMath } from '@/core/maths/matrix-math';

type MathLogEntry = {
  step: number;
  action: string;
  description?: string;
  data?: {
    matrix?: number[][];
    vector?: number[];
  };
};

// Ініціалізація
const modeSelect = document.querySelector<HTMLSelectElement>('#mode')!;
const rowsInput = document.querySelector<HTMLInputElement>('#rows')!;
const colsInput = document.querySelector<HTMLInputElement>('#cols')!;
const generateBtn = document.querySelector<HTMLButtonElement>('#generateBtn')!;
const calculateBtn =
  document.querySelector<HTMLButtonElement>('#calculateBtn')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const logOutput = document.querySelector<HTMLTextAreaElement>('#logOutput')!;
const vectorSection = document.querySelector<HTMLDivElement>('#vectorSection')!;

let matrixMath: MatrixMath;

const MIN_SIZE = 1;
const MAX_SIZE = 9;

function formatNumberForLog(value: number, precision: number = 2): string {
  return value.toFixed(precision).replace('.', ',');
}

function clampSize(value: number): number {
  if (Number.isNaN(value)) return MIN_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));
}

function syncSizeInput(input: HTMLInputElement) {
  input.value = String(clampSize(parseInt(input.value)));
}

function updateMatrixSize() {
  syncSizeInput(rowsInput);
  syncSizeInput(colsInput);

  const rows = parseInt(rowsInput.value);
  const cols = parseInt(colsInput.value);
  const mode = modeSelect.value;

  const isSquareOperation = mode === 'inverse' || mode === 'solve';

  if (isSquareOperation) {
    colsInput.value = String(rows);
    colsInput.disabled = true;
    renderMatrixInputs(rows, rows);
  } else {
    colsInput.disabled = false;
    renderMatrixInputs(rows, cols);
  }

  const isSolve = mode === 'solve';
  vectorSection.style.display = isSolve ? 'flex' : 'none';

  if (isSolve) {
    renderVectorInputs(rows);
  } else {
    const container =
      document.querySelector<HTMLDivElement>('#vectorContainer')!;
    container.innerHTML = '';
  }
}

function createRandomMatrix(rows: number, cols: number): number[][] {
  const boundMatrix: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );

  return boundMatrix.map((row: number[]) =>
    row.map(() => Math.floor(Math.random() * 19) - 9)
  );
}

function createRandomVector(size: number): number[] {
  const boundVector: number[] = Array.from({ length: size }, () => 0);

  return boundVector.map(() => Math.floor(Math.random() * 19) - 9);
}

function renderMatrixInputs(rows: number, cols: number) {
  const container = document.querySelector<HTMLDivElement>('#matrixContainer')!;
  container.innerHTML = '';

  const matrix = createRandomMatrix(rows, cols);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'matrix-input-field';
      input.value = String(matrix[i][j]);
      input.dataset.row = String(i);
      input.dataset.col = String(j);
      input.style.gridColumn = String(j + 1);
      input.style.gridRow = String(i + 1);
      container.appendChild(input);
    }
  }

  container.style.gridTemplateColumns = `repeat(${cols}, max-content)`;
}

function renderVectorInputs(size: number) {
  const container = document.querySelector<HTMLDivElement>('#vectorContainer')!;
  container.innerHTML = '';

  const vector = createRandomVector(size);

  for (let i = 0; i < size; i++) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'vector-input-field';
    input.value = String(vector[i]);
    input.dataset.index = String(i);
    container.appendChild(input);
  }
}

function getMatrixFromInputs(): number[][] | null {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    '.matrix-input-field'
  );
  const rows = parseInt(rowsInput.value);
  const cols = parseInt(colsInput.value);

  if (inputs.length !== rows * cols) {
    alert('Помилка: матриця не заповнена повністю');
    return null;
  }

  const matrix: number[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(0));

  inputs.forEach(input => {
    const row = parseInt(input.dataset.row!);
    const col = parseInt(input.dataset.col!);
    const value = parseFloat(input.value);

    if (isNaN(value)) {
      alert(`Помилка: невалідне значення в позиції [${row + 1}, ${col + 1}]`);
      throw new Error('Invalid matrix value');
    }

    matrix[row][col] = value;
  });

  return matrix;
}

function getVectorFromInputs(): number[] | null {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    '.vector-input-field'
  );
  const vector: number[] = [];

  inputs.forEach(input => {
    const value = parseFloat(input.value);
    if (isNaN(value)) {
      alert('Помилка: невалідне значення у векторі B');
      throw new Error('Invalid vector value');
    }
    vector.push(value);
  });

  return vector;
}

function formatMatrixForLog(matrix: number[][]): string {
  return matrix
    .map(
      row =>
        '│ ' + row.map(v => formatNumberForLog(v).padStart(10)).join(' ') + ' │'
    )
    .join('\n');
}

function formatVectorForLog(vector: number[]): string {
  return vector
    .map(v => '│ ' + formatNumberForLog(v).padStart(10) + ' │')
    .join('\n');
}

function formatCalculationStep(entry: MathLogEntry): string {
  const blocks: string[] = [`Крок #${entry.step}`];

  if (entry.action) {
    blocks.push('', entry.action.trim());
  }

  if (entry.description) {
    blocks.push('', entry.description.trim());
  }

  if (entry.data?.matrix) {
    blocks.push('', formatMatrixForLog(entry.data.matrix));
  }

  if (entry.data?.vector) {
    blocks.push('', formatVectorForLog(entry.data.vector));
  }

  return blocks.join('\n');
}

function buildProtocolBlock(entries: MathLogEntry[]): string {
  return entries.map(entry => formatCalculationStep(entry)).join('\n\n');
}

function getMatrixSectionTitle(mode: string): string {
  if (mode === 'rank') return 'Знаходження рангу матриці:';
  if (mode === 'inverse') return 'Знаходження оберненої матриці:';
  return "Знаходження розв'язків СЛАР 1-м методом (за допомогою оберненої матриці):";
}

function buildFinalOutput(
  mode: string,
  matrix: number[][],
  vector: number[] | null,
  solution: number[] | null,
  logs: MathLogEntry[]
): string {
  const stepLogs = logs.filter(
    entry =>
      !entry.action.includes('Вхідна матриця:') &&
      !entry.action.includes('Обернена матриця') &&
      !entry.action.includes('Вхідна матриця B') &&
      !entry.action.includes('Обчислення розв') &&
      !entry.action.includes('Ранг матриці')
  );

  const inverseEntry = logs.find(entry =>
    entry.action.includes('Обернена матриця')
  );
  const vectorEntry = logs.find(entry =>
    entry.action.includes('Вхідна матриця B')
  );
  const solutionEntry = logs.find(entry =>
    entry.action.includes('Обчислення розв')
  );
  const rankEntry = logs.find(entry => entry.action.includes('Ранг матриці'));

  let output = `${getMatrixSectionTitle(mode)}\n\nВхідна матриця:\n${formatMatrixForLog(matrix)}\n\nПротокол обчислення:\n\n${buildProtocolBlock(stepLogs)}\n`;

  if (mode === 'inverse') {
    output += `\nОбернена матриця:\n\n${inverseEntry?.data?.matrix ? formatMatrixForLog(inverseEntry.data.matrix) : 'Немає даних'}\n`;
  } else if (mode === 'rank') {
    output += `\nРанг матриці:\n\n${rankEntry?.action?.trim() ?? 'Немає даних'}\n`;
  } else {
    output += `\nОбернена матриця:\n\n${inverseEntry?.data?.matrix ? formatMatrixForLog(inverseEntry.data.matrix) : 'Немає даних'}\n\nВхідна матриця В:\n\n${vectorEntry?.data?.vector ? formatVectorForLog(vectorEntry.data.vector) : vector ? formatVectorForLog(vector) : 'Немає даних'}\n\nОбчислення розв'язків:\n\n${solutionEntry?.description ?? (solution ? solution.map((value, index) => `X[${index + 1}] = ${formatNumberForLog(value)}`).join('\n') : 'Немає даних')}\n`;
  }

  return output.trimEnd();
}

function calculate() {
  try {
    const mode = modeSelect.value;

    const matrix = getMatrixFromInputs();
    if (!matrix) return;

    matrixMath = new MatrixMath();

    let output = '';

    if (mode === 'inverse') {
      matrixMath.invertMatrix(matrix);
      output = buildFinalOutput(
        mode,
        matrix,
        null,
        null,
        matrixMath.executionLog as MathLogEntry[]
      );
    } else if (mode === 'rank') {
      const rank = matrixMath.calculateRank(matrix);
      output = buildFinalOutput(
        mode,
        matrix,
        null,
        [rank],
        matrixMath.executionLog as MathLogEntry[]
      );
    } else {
      const vector = getVectorFromInputs();
      if (!vector) return;

      const solution = matrixMath.solveLinearSystem(matrix, vector);
      output = buildFinalOutput(
        mode,
        matrix,
        vector,
        solution,
        matrixMath.executionLog as MathLogEntry[]
      );
    }

    logOutput.value = output;
  } catch (error) {
    logOutput.value = `❌ Помилка: ${error instanceof Error ? error.message : 'невідома помилка'}`;
  }
}

function clear() {
  logOutput.value = '';
  rowsInput.value = '3';
  colsInput.value = '3';
  updateMatrixSize();
}

// Обробники подій
modeSelect.addEventListener('change', () => {
  const isSquareOperation =
    modeSelect.value === 'inverse' || modeSelect.value === 'solve';

  if (
    isSquareOperation &&
    parseInt(rowsInput.value) !== parseInt(colsInput.value)
  ) {
    rowsInput.value = colsInput.value;
  }
  updateMatrixSize();
});

rowsInput.addEventListener('change', updateMatrixSize);
colsInput.addEventListener('change', updateMatrixSize);
rowsInput.addEventListener('input', () => syncSizeInput(rowsInput));
colsInput.addEventListener('input', () => syncSizeInput(colsInput));
generateBtn.addEventListener('click', updateMatrixSize);
calculateBtn.addEventListener('click', calculate);
clearBtn.addEventListener('click', clear);

// Ініціальна генерація
updateMatrixSize();
