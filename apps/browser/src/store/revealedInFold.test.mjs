import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("./browser.ts");
const { keptEntries, showsRevealed } = await import("../components/sidebar/geometry.ts");
const { groupEntries } = await import("../components/sidebar/entries.ts");

const S = () => useBrowser.getState();

function setup() {
  S().hydrate({});
  const w = S().createWindow({ url: "https://out.com/" });
  const out = S().windows[w].tabIds[0];
  const [a, b, c] = ["a", "b", "c"].map((h) => S().newTab(w, { url: `https://${h}.com/`, background: true }));
  const g = S().groupTabs([a, b, c], { pinned: false, name: "G" });
  const profileId = S().windows[w].profileId;
  const kept = () => keptEntries(S(), w, profileId, g, groupEntries(S(), g)).map((e) => e.slice(2));
  const pressHeader = () => {
    if (S().groups[g].collapsed && showsRevealed(S(), w, profileId, g)) S().hideRevealed(g);
    else S().updateGroup(g, { collapsed: !S().groups[g].collapsed });
  };
  return { w, out, a, b, c, g, kept, pressHeader };
}

test("tabs opened while a group is collapsed stay under its header; collapsing shows only the focused one", () => {
  const { out, a, b, g, kept } = setup();
  S().activate(a);
  S().activate(b);
  S().updateGroup(g, { collapsed: true });
  assert.deepEqual(kept(), [b]);
  S().activate(out);
  assert.deepEqual(kept(), []);
  S().activate(a);
  S().activate(b);
  S().activate(out);
  assert.deepEqual(kept(), [a, b]);
});

test("a header click hides the revealed tabs but the focused one, the next click expands", () => {
  const { a, b, c, g, kept, pressHeader } = setup();
  S().updateGroup(g, { collapsed: true });
  S().activate(a);
  S().activate(b);
  S().activate(c);
  S().activate(a);
  assert.deepEqual(kept(), [a, b, c]);
  pressHeader();
  assert.equal(S().groups[g].collapsed, true);
  assert.deepEqual(kept(), [a]);
  pressHeader();
  assert.equal(S().groups[g].collapsed, false);
});

test("closing a revealed tab takes it off", () => {
  const { out, a, b, g, kept } = setup();
  S().updateGroup(g, { collapsed: true });
  S().activate(a);
  S().activate(b);
  S().activate(out);
  S().closeTabs([a]);
  assert.deepEqual(kept(), [b]);
});

test("expanding a group by any path, Chrome's included, forgets what it revealed", () => {
  const { out, a, b, g, kept } = setup();
  S().updateGroup(g, { collapsed: true });
  S().activate(a);
  S().activate(b);
  const setCollapsed = (collapsed) => useBrowser.setState((s) => ({ groups: { ...s.groups, [g]: { ...s.groups[g], collapsed } } }));
  setCollapsed(false);
  setCollapsed(true);
  assert.deepEqual(kept(), [b]);
  S().activate(out);
  assert.deepEqual(kept(), []);
});

test("closed tabs and deleted groups leave nothing behind", () => {
  const { out, a, b, g } = setup();
  S().updateGroup(g, { collapsed: true });
  S().activate(a);
  S().activate(b);
  S().activate(out);
  S().closeTabs([a]);
  assert.deepEqual(S().revealedInFold[g], [b]);
  S().deleteGroup(g);
  assert.equal(S().revealedInFold[g], undefined);
});

test("unloading a revealed tab of a pinned group forgets it, so unpinning the group doesn't bring it back", () => {
  S().hydrate({});
  const w = S().createWindow({ url: "https://out.com/" });
  const out = S().windows[w].tabIds[0];
  const [a, b] = ["a", "b"].map((h) => S().newTab(w, { url: `https://${h}.com/`, background: true }));
  const g = S().groupTabs([a, b], { pinned: true, name: "P" });
  S().updateGroup(g, { collapsed: true });
  S().activate(a);
  S().activate(b);
  S().activate(out);
  S().closeTabs([a]);
  assert.ok(S().tabs[a]);
  assert.deepEqual(S().revealedInFold[g], [b]);
  S().updateGroup(g, { pinned: false });
  const profileId = S().windows[w].profileId;
  assert.deepEqual(keptEntries(S(), w, profileId, g, groupEntries(S(), g)).map((e) => e.slice(2)), [b]);
});
