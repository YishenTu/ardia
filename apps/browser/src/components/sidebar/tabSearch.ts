import { fuzzyScore, hostOf } from "@ardia/core";

export function rankByQuery<T extends { title: string; url: string }>(query: string, rows: T[]): T[] {
  return rows
    .map((row) => ({ row, scores: [fuzzyScore(query, row.title), fuzzyScore(query, hostOf(row.url)) * 0.9, fuzzyScore(query, row.url) * 0.6].filter((score) => score !== 0) }))
    .filter((x) => x.scores.length > 0)
    .map((x) => ({ row: x.row, score: Math.max(...x.scores) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);
}
