function csvCell(value: string) {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((row) => row.map((cell) => csvCell(cell ?? "")).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

function detectDelimiter(text: string) {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  if (source.startsWith("PK")) {
    throw new Error("الملف بصيغة Excel المضغوطة. احفظه من Excel كـ CSV ثم أعد الاستيراد.");
  }

  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
