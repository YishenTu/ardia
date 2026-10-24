import { fuzzyScore } from "@ardia/core";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export function rankByQuery<T extends { title: string; url: string }>(query: string, rows: T[]): T[] {
  return rows
    .map((row) => ({ row, score: Math.max(fuzzyScore(query, row.title), fuzzyScore(query, host(row.url)) * 0.9, fuzzyScore(query, row.url) * 0.6) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);
}
