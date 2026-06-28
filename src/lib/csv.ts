// 부록 A27 엑셀(CSV) 가져오기/내보내기
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns || Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, csv: string): void {
  // UTF-8 BOM 으로 엑셀 한글 깨짐 방지
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): Record<string, string>[] {
  // 전체 텍스트를 문자 단위 상태 머신으로 파싱 → 따옴표로 감싼 줄바꿈(toCSV 가 생성)도 한 셀로 유지.
  // (줄 단위로 먼저 split 하면 따옴표 안 줄바꿈에서 레코드가 깨져 라운드트립이 손상됨)
  const src = text.replace(/\r\n/g, "\n").replace(/^﻿/, "");
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inq = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inq) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inq = false;
      else cur += ch;
    } else {
      if (ch === '"') inq = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); cur = ""; row = []; }
      else cur += ch;
    }
  }
  // 마지막 셀/행 마무리(파일 끝에 개행이 없을 수 있음)
  row.push(cur);
  rows.push(row);
  // 완전히 빈 행(빈 줄) 제거
  const data = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h.trim()] = (cells[i] || "").trim()));
    return obj;
  });
}
