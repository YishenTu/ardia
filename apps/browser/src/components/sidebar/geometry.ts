import { layout } from "../../lib/theme";
import type { BrowserState } from "../../store/browser";
import { hasLivePage, rootOf } from "../../store/groups";
import { activeTabId } from "../../store/model";
import { groupEntries, sidebarEntries } from "./entries";

export const GROUP_PAD = 2;
export const GROUP_INDENT = 16;
export const GROUP_BORDER = 0.5;
export const GROUP_RADIUS = 12;
export const GROUP_HEADER_RADIUS = GROUP_RADIUS - GROUP_BORDER;
const ROW = layout.rowHeight;
const GAP = layout.rowGap;

export type Section = "pinnedGroups" | "list";

export const headGap = (first: string | null | undefined): number => (first?.startsWith("g:") ? GAP : 0);

export function keptEntries(s: BrowserState, windowId: string, profileId: string, foldId: string, entries: string[]): string[] {
  const active = activeTabId(s, windowId, profileId);
  const revealed = revealedTabs(s, foldId);
  return entries.filter((e) => (active && holdsTab(s, e, active)) || revealed.some((id) => holdsTab(s, e, id)));
}

export function keptRows(s: BrowserState, windowId: string, profileId: string, groupId: string, foldId = groupId): string[] {
  return keptEntries(s, windowId, profileId, foldId, groupEntries(s, groupId)).flatMap((e) => (e.startsWith("g:") ? keptRows(s, windowId, profileId, e.slice(2), foldId) : [e]));
}

export function showsRevealed(s: BrowserState, windowId: string, profileId: string, groupId: string): boolean {
  const active = activeTabId(s, windowId, profileId);
  return keptRows(s, windowId, profileId, groupId).some((e) => !active || !holdsTab(s, e, active));
}

export function pressGroupHeader(s: BrowserState, windowId: string, profileId: string, groupId: string) {
  const g = s.groups[groupId];
  if (!g) return;
  if (g.collapsed && showsRevealed(s, windowId, profileId, groupId)) s.hideRevealed(groupId);
  else s.updateGroup(groupId, { collapsed: !g.collapsed });
}

function revealedTabs(s: BrowserState, groupId: string): string[] {
  const ids = s.revealedInFold[groupId];
  if (!ids?.length) return [];
  const pinned = !!rootOf(s.groups, groupId)?.pinned;
  return ids.filter((id) => (pinned ? hasLivePage(s.tabs[id]) : !!s.tabs[id]));
}

export function holdsTab(s: BrowserState, entry: string, tabId: string): boolean {
  const id = entry.slice(2);
  if (entry.startsWith("g:")) return !!s.groups[id]?.tabIds.includes(tabId);
  if (entry.startsWith("s:")) return !!s.splits[id]?.tabIds.includes(tabId);
  return id === tabId;
}

function membersHeight(s: BrowserState, windowId: string, profileId: string, groupId: string, foldId?: string): number {
  const entries = groupEntries(s, groupId);
  if (foldId) return entriesHeight(s, windowId, profileId, keptEntries(s, windowId, profileId, foldId, entries), foldId);
  if (!s.groups[groupId]?.collapsed) return entries.length ? headGap(entries[0]) + entriesHeight(s, windowId, profileId, entries) + GROUP_PAD : GROUP_PAD;
  const kept = keptEntries(s, windowId, profileId, groupId, entries);
  return kept.length ? entriesHeight(s, windowId, profileId, kept, groupId) + GROUP_PAD : 0;
}

export function entryHeight(s: BrowserState, windowId: string, profileId: string, entry: string, foldId?: string): number {
  if (!entry.startsWith("g:")) return ROW;
  if (foldId) return membersHeight(s, windowId, profileId, entry.slice(2), foldId);
  return GROUP_BORDER * 2 + ROW + membersHeight(s, windowId, profileId, entry.slice(2));
}

export function entriesHeight(s: BrowserState, windowId: string, profileId: string, entries: string[], foldId?: string): number {
  return entries.reduce((sum, e) => sum + entryHeight(s, windowId, profileId, e, foldId) + GAP, 0) - (entries.length ? GAP : 0);
}

export function entriesWithin(s: BrowserState, windowId: string, profileId: string, entries: string[], height: number): number {
  let top = 0;
  let n = 0;
  while (n < entries.length && top < height) top += entryHeight(s, windowId, profileId, entries[n++]!) + GAP;
  return n;
}

const EAGER_FIRST_PAINT_ENTRIES = 64;
export const FIRST_PAINT_HEIGHT = 2400;

export function firstPaintEntries(s: BrowserState, windowId: string, profileId: string, entries: string[], lazy: boolean): number {
  if (!lazy) return EAGER_FIRST_PAINT_ENTRIES;
  return Math.max(1, entriesWithin(s, windowId, profileId, entries, s.windows[windowId]?.frame?.[3] ?? FIRST_PAINT_HEIGHT));
}

export const startsOffScreen = (lazy: boolean, current: boolean) => lazy && !current;

export function rowSpan(
  s: BrowserState,
  windowId: string,
  profileId: string,
  tabId: string,
  newTabAtTop: boolean,
): { section: Section; top: number; height: number } | null {
  const { pinned, list } = sidebarEntries(s, windowId, profileId);
  const sections: [Section, string[], number][] = [
    ["pinnedGroups", pinned, 0],
    ["list", list, newTabAtTop ? ROW + GAP : 0],
  ];
  const within = (entries: string[], top: number, foldId?: string, header?: number): number | null => {
    for (const entry of entries) {
      if (holdsTab(s, entry, tabId)) {
        if (!entry.startsWith("g:")) return top;
        const id = entry.slice(2);
        const members = groupEntries(s, id);
        if (foldId) return within(keptEntries(s, windowId, profileId, foldId, members), top, foldId, header) ?? header ?? null;
        const own = top + GROUP_BORDER;
        if (!s.groups[id]!.collapsed) return within(members, own + ROW + headGap(members[0]));
        return within(keptEntries(s, windowId, profileId, id, members), own + ROW, id, own) ?? own;
      }
      top += entryHeight(s, windowId, profileId, entry, foldId) + GAP;
    }
    return null;
  };
  for (const [section, entries, start] of sections) {
    const top = within(entries, start);
    if (top !== null) return { section, top, height: ROW };
  }
  return null;
}
