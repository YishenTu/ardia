import { fuzzyMatchScore, hostOf } from "@ardia/core";

const weighted = (score: number | null, weight: number) => (score === null ? null : score * weight);

export function rankByQuery<T extends { title: string; url: string }>(query: string, rows: T[]): T[] {
  return rows
    .map((row) => ({
      row,
      scores: [weighted(fuzzyMatchScore(query, row.title), 1), weighted(fuzzyMatchScore(query, hostOf(row.url)), 0.9), weighted(fuzzyMatchScore(query, row.url), 0.6)].filter(
        (score): score is number => score !== null,
      ),
    }))
    .filter((x) => x.scores.length > 0)
    .map((x) => ({ row: x.row, score: Math.max(...x.scores) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);
}
