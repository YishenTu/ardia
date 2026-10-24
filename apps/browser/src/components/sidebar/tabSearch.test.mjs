import assert from "node:assert/strict";
import { test } from "node:test";
import { rankByQuery } from "./tabSearch.ts";

const row = (title, url) => ({ title, url });

test("a weak match in a long title is kept, ranked below strong ones", () => {
  const long = row("The quick brown fox jumps over the lazy dog again today", "about:blank");
  const strong = row("Python docs", "https://docs.python.org/3/");
  const none = row("Unrelated", "about:blank");
  assert.deepEqual(rankByQuery("py", [long, none, strong]), [strong, long]);
});

test("a match that scores exactly zero is still a match", () => {
  const zero = row("happy cats like to nap under yellow blankets", "about:blank");
  assert.deepEqual(rankByQuery("py", [row("Unrelated", "about:blank"), zero]), [zero]);
});

test("a host match counts when the title doesn't", () => {
  const github = row("Change is constant", "https://www.github.com/");
  assert.deepEqual(rankByQuery("github", [row("Other", "about:blank"), github]), [github]);
});
