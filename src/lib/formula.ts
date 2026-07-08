export type CellMap = Record<string, { raw: string }>;

// Helper to convert column letter (A, B, ...) to index (0, 1, ...)
export function colToIndex(col: string): number {
  let idx = 0;
  const cleaned = col.toUpperCase();
  for (let i = 0; i < cleaned.length; i++) {
    idx = idx * 26 + (cleaned.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// Helper to convert index (0, 1, ...) to column letter (A, B, ...)
export function indexToCol(idx: number): string {
  let col = "";
  let temp = idx;
  while (temp >= 0) {
    col = String.fromCharCode((temp % 26) + 65) + col;
    temp = Math.floor(temp / 26) - 1;
  }
  return col;
}

// Main evaluation function
export function evaluate(
  cellId: string,
  cells: CellMap,
  stack: Set<string> = new Set()
): number | string {
  const cell = cells[cellId.toUpperCase()];
  const raw = cell?.raw ?? "";

  if (raw === "") return "";

  // If not a formula, return parsed number or raw string
  if (!raw.startsWith("=")) {
    const num = Number(raw);
    return isNaN(num) || raw.trim() === "" ? raw : num;
  }

  // Circular reference detection
  if (stack.has(cellId.toUpperCase())) {
    return "#CIRC!";
  }

  stack.add(cellId.toUpperCase());
  try {
    const expr = raw.slice(1); // Remove '='
    const result = computeExpr(expr, cells, stack);
    return result;
  } catch {
    return "#ERR!";
  } finally {
    stack.delete(cellId.toUpperCase());
  }
}

// Parse coordinates range (e.g. A1:B3 -> cell list) and compute sum
function sumRange(
  start: string,
  end: string,
  cells: CellMap,
  stack: Set<string>
): number | string {
  const startMatch = start.match(/^([A-Z]+)(\d+)$/i);
  const endMatch = end.match(/^([A-Z]+)(\d+)$/i);
  if (!startMatch || !endMatch) return "#ERR!";

  const startCol = colToIndex(startMatch[1]);
  const startRow = parseInt(startMatch[2], 10);
  const endCol = colToIndex(endMatch[1]);
  const endRow = parseInt(endMatch[2], 10);

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  let sum = 0;
  for (let c = minCol; c <= maxCol; c++) {
    const colStr = indexToCol(c);
    for (let r = minRow; r <= maxRow; r++) {
      const ref = `${colStr}${r}`;
      const val = evaluate(ref, cells, stack);

      if (val === "#CIRC!") return "#CIRC!";
      if (val === "#ERR!") return "#ERR!";

      if (typeof val === "number") {
        sum += val;
      } else if (typeof val === "string" && !isNaN(Number(val)) && val !== "") {
        sum += Number(val);
      }
    }
  }
  return sum;
}

// Computes a formula expression after expanding ranges and replacing cell references
function computeExpr(
  expr: string,
  cells: CellMap,
  stack: Set<string>
): number | string {
  const trimmed = expr.trim();

  // If it's exactly a single cell reference, return its literal evaluated value
  if (trimmed.match(/^[A-Z]+\d+$/i)) {
    return evaluate(trimmed.toUpperCase(), cells, stack);
  }

  let circDetected = false;
  let errDetected = false;

  // 1. Expand SUM(A1:B3) -> sum result
  let parsedExpr = trimmed.replace(
    /SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/gi,
    (_, start, end) => {
      const sumResult = sumRange(start, end, cells, stack);
      if (sumResult === "#CIRC!") {
        circDetected = true;
        return "0";
      }
      if (sumResult === "#ERR!") {
        errDetected = true;
        return "0";
      }
      return String(sumResult);
    }
  );

  if (circDetected) return "#CIRC!";
  if (errDetected) return "#ERR!";

  // 2. Replace bare cell references (e.g. A1) with evaluated numeric values
  parsedExpr = parsedExpr.replace(/[A-Z]+\d+/gi, (ref) => {
    const val = evaluate(ref.toUpperCase(), cells, stack);
    if (val === "#CIRC!") {
      circDetected = true;
      return "0";
    }
    if (val === "#ERR!") {
      errDetected = true;
      return "0";
    }
    if (typeof val === "number") {
      return String(val);
    }
    if (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "") {
      return String(Number(val));
    }
    // Text values evaluate to 0 in arithmetic operations
    return "0";
  });

  if (circDetected) return "#CIRC!";
  if (errDetected) return "#ERR!";

  // 3. Safe arithmetic parsing (no eval!)
  try {
    return parseArithmetic(parsedExpr);
  } catch {
    return "#ERR!";
  }
}

// Custom Recursive-Descent Parser for basic arithmetic (+ - * / parentheses)
function parseArithmetic(expr: string): number {
  const tokens: string[] = [];
  let i = 0;
  const sanitized = expr.replace(/\s+/g, "");

  while (i < sanitized.length) {
    const char = sanitized[i];
    if (/[0-9.]/.test(char)) {
      let numStr = "";
      while (i < sanitized.length && /[0-9.]/.test(sanitized[i])) {
        numStr += sanitized[i];
        i++;
      }
      tokens.push(numStr);
    } else if (["+", "-", "*", "/", "(", ")"].includes(char)) {
      tokens.push(char);
      i++;
    } else {
      throw new Error(`Unexpected character in formula: ${char}`);
    }
  }

  let tokenIndex = 0;

  function peek(): string | undefined {
    return tokens[tokenIndex];
  }

  function consume(expected?: string): string {
    const t = tokens[tokenIndex];
    if (expected !== undefined && t !== expected) {
      throw new Error(`Expected ${expected} but got ${t}`);
    }
    tokenIndex++;
    return t;
  }

  function parseExpr(): number {
    let val = parseTerm();
    while (true) {
      const next = peek();
      if (next === "+") {
        consume("+");
        val += parseTerm();
      } else if (next === "-") {
        consume("-");
        val -= parseTerm();
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (true) {
      const next = peek();
      if (next === "*") {
        consume("*");
        val *= parseFactor();
      } else if (next === "/") {
        consume("/");
        const divisor = parseFactor();
        if (divisor === 0) {
          throw new Error("Division by zero");
        }
        val /= divisor;
      } else {
        break;
      }
    }
    return val;
  }

  function parseFactor(): number {
    const next = peek();
    if (next === undefined) {
      throw new Error("Unexpected end of formula");
    }
    if (next === "(") {
      consume("(");
      const val = parseExpr();
      consume(")");
      return val;
    }
    if (next === "-") {
      consume("-");
      return -parseFactor();
    }
    if (next === "+") {
      consume("+");
      return parseFactor();
    }
    if (!isNaN(Number(next))) {
      consume();
      return Number(next);
    }
    throw new Error(`Invalid term: ${next}`);
  }

  const result = parseExpr();
  if (tokenIndex < tokens.length) {
    throw new Error("Malformed formula expression");
  }
  return result;
}
