import './style.css';
import { MatrixMath } from '@/core/maths/matrix-math';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="container">
    <header>
      <h1>Метод Жорданових Виключень</h1>
      <p>Розв'язання систем лінійних рівнянь</p>
    </header>

    <main>
      <section class="input-section">
        <div class="controls">
          <div class="mode-selector">
            <label for="mode">Операція:</label>
            <select id="mode" class="mode-select">
              <option value="solve">Розв'язання СЛАР (метод 1)</option>
            </select>
          </div>

          <div class="matrix-size">
            <div class="size-input">
              <label for="rows">Рядків (n):</label>
              <input type="number" id="rows" min="1" max="10" value="3" class="size-input-field">
            </div>
            <div class="size-input">
              <label for="cols">Стовпців (m):</label>
              <input type="number" id="cols" min="1" max="10" value="3" class="size-input-field">
            </div>
            <button id="generateBtn" class="btn btn-primary">Сгенерувати матрицю</button>
          </div>
        </div>

        <div class="matrix-input">
          <label>Матриця A:</label>
          <div id="matrixContainer" class="matrix-inputs"></div>
        </div>

        <div id="vectorSection" class="vector-input" style="display: none;">
          <label>Вектор B:</label>
          <div id="vectorContainer" class="vector-inputs"></div>
        </div>

        <div class="button-group">
          <button id="calculateBtn" class="btn btn-success">Обчислити</button>
          <button id="clearBtn" class="btn btn-secondary">Очистити</button>
        </div>
      </section>

      <section class="output-section">
        <label for="logOutput">Лог обчислень:</label>
        <textarea 
          id="logOutput" 
          class="log-output" 
          readonly
          placeholder="Результати будуть виведені сюди..."
        ></textarea>
      </section>
    </main>
  </div>
`;

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

function updateMatrixSize() {
  const rows = parseInt(rowsInput.value);
  const cols = parseInt(colsInput.value);

  // Всегда квадратная матрица для СЛАР
  colsInput.value = String(rows);
  colsInput.disabled = true;

  renderMatrixInputs(rows, rows);
  renderVectorInputs(rows);
}

function createRandomMatrix(rows: number, cols: number): number[][] {
  const boundMatrix: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );

  return boundMatrix.map((row: number[]) =>
    row.map(() => Math.floor(Math.random() * 19) - 9)
  );
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

  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

function renderVectorInputs(size: number) {
  const container = document.querySelector<HTMLDivElement>('#vectorContainer')!;
  container.innerHTML = '';

  for (let i = 0; i < size; i++) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'vector-input-field';
    input.value = String(Math.floor(Math.random() * 9) + 1);
    input.dataset.index = String(i);
    container.appendChild(input);
  }
}

function updateVectorVisibility() {
  // Вектор завжди видимий для СЛАР
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
    .map(row => '│ ' + row.map(v => v.toFixed(3).padStart(10)).join(' ') + ' │')
    .join('\n');
}

function formatVectorForLog(vector: number[]): string {
  return vector.map(v => '│ ' + v.toFixed(3).padStart(10) + ' │').join('\n');
}

function calculate() {
  try {
    const rows = parseInt(rowsInput.value);
    const cols = parseInt(colsInput.value);

    const matrix = getMatrixFromInputs();
    if (!matrix) return;

    const vector = getVectorFromInputs();
    if (!vector) return;

    matrixMath = new MatrixMath();

    const result = `=== РОЗВ'ЯЗАННЯ СЛАР (МЕТОД 1 - ОБЕРНЕНА МАТРИЦЯ) ===\n\nСистема рівнянь: Ax = B\n\nМатриця A:\n${formatMatrixForLog(matrix)}\n\nВектор B:\n${formatVectorForLog(vector)}\n`;

    const solution = matrixMath.solveLinearSystem(matrix, vector);
    let output = result;
    if (!solution) {
      output += "\n❌ Система не має розв'язку (матриця A не оборотна)";
    } else {
      output += `\nРозв'язок x:\n${formatVectorForLog(solution)}\n`;
    }

    output += `\n${'='.repeat(50)}\n📋 ЛОГ ОПЕРАЦІЙ:\n${'='.repeat(50)}\n`;
    output += matrixMath.executionLog
      .map(entry => {
        let log = `\n▶ ${entry.description}\n`;
        if (entry.data?.matrix) {
          log += 'Матриця:\n' + formatMatrixForLog(entry.data.matrix) + '\n';
        }
        if (entry.data?.vector) {
          log += 'Вектор:\n' + formatVectorForLog(entry.data.vector) + '\n';
        }
        return log;
      })
      .join('');

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
  const isSolve =
    modeSelect.value === 'solve' || modeSelect.value === 'gaussian';
  if (isSolve && parseInt(rowsInput.value) !== parseInt(colsInput.value)) {
    rowsInput.value = colsInput.value;
  }
  updateMatrixSize();
});

rowsInput.addEventListener('change', updateMatrixSize);
colsInput.addEventListener('change', updateMatrixSize);
generateBtn.addEventListener('click', updateMatrixSize);
calculateBtn.addEventListener('click', calculate);
clearBtn.addEventListener('click', clear);

// Ініціальна генерація
updateMatrixSize();
