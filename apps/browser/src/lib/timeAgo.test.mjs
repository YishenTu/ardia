import assert from "node:assert/strict";
import { test } from "node:test";
import { ago } from "./timeAgo.ts";

const now = Date.UTC(2026, 9, 24, 12);
const before = (ms) => ago(now - ms, now);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("reads like Arc's group panel, from just now to years", () => {
  assert.equal(before(0), "just now");
  assert.equal(before(59_000), "just now");
  assert.equal(before(MIN), "1 minute ago");
  assert.equal(before(42 * MIN), "42 minutes ago");
  assert.equal(before(HOUR), "1 hour ago");
  assert.equal(before(17 * HOUR), "17 hours ago");
  assert.equal(before(DAY), "yesterday");
  assert.equal(before(6 * DAY), "6 days ago");
  assert.equal(before(7 * DAY), "1 week ago");
  assert.equal(before(20 * DAY), "2 weeks ago");
  assert.equal(before(29 * DAY), "4 weeks ago");
  assert.equal(before(30 * DAY), "1 month ago");
  assert.equal(before(200 * DAY), "6 months ago");
  assert.equal(before(365 * DAY), "1 year ago");
  assert.equal(before(800 * DAY), "2 years ago");
});

test("a time in the future reads as just now", () => {
  assert.equal(ago(now + 5 * MIN, now), "just now");
});
