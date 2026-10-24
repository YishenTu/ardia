import { FadeLabel, restoreKeyResponder, saveKeyResponder, Surface, Symbol } from "@ardia/shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { hex, useTheme } from "../../lib/theme";
import { ago } from "../../lib/timeAgo";
import { webviews } from "../../lib/webviews";
import { useBrowser, type BrowserState } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { focusHeroBar } from "../omnibox/barState";
import { clickTab, tabTitle } from "./actions";
import { cardHoverProps, dismissHover, holdHover } from "./hover";
import { hoverCardOrigin } from "./hoverMotion";
import { useSidebarUi, type Anchor } from "./state";
import { rankByQuery } from "./tabSearch";
import { TabIcon } from "./TabIcon";

const WIDTH = 240;
const SEARCH_ROW = 47;
const DIVIDER = 1;
const ROW = 44;
const ROW_GAP = 1;
const PITCH = ROW + ROW_GAP;
const LIST_PAD = 4;
const LIST_MAX = 270;
const EMPTY_ROW = 40;

type Row = { id: string; title: string; url: string; favicon: string | null; icon: string | null; profileId: string; lastActiveAt: number };

function recentRows(s: BrowserState, groupId: string): Row[] {
  const rows: Row[] = [];
  for (const id of s.groups[groupId]?.tabIds ?? []) {
    const tab = s.tabs[id];
    if (tab) rows.push({ id, title: tabTitle(tab), url: tab.url, favicon: tab.favicon, icon: tab.customIcon, profileId: tab.profileId, lastActiveAt: tab.lastActiveAt });
  }
  return rows.sort((a, z) => z.lastActiveAt - a.lastActiveAt);
}

let focusOrigin: Promise<number> | null = null;

function returnFocusToPage(windowId: string) {
  const s = useBrowser.getState();
  const active = activeTabId(s, windowId);
  if (!active) return;
  if (s.tabs[active]?.url) void webviews.get(active)?.focus();
  else focusHeroBar(windowId, active);
}

export function GroupPanel({ groupId, windowId, anchor, windowHeight }: { groupId: string; windowId: string; anchor: Anchor; windowHeight: number }) {
  const theme = useTheme();
  const tabs = useBrowser(useShallow((s) => (s.groups[groupId]?.tabIds ?? []).map((id) => s.tabs[id])));
  const all = useMemo(() => recentRows(useBrowser.getState(), groupId), [tabs, groupId]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [now] = useState(Date.now);
  const field = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const focused = useRef(false);
  const clicked = useRef(false);
  const typed = useRef(false);
  const live = useSidebarUi((u) => u.hover?.kind === "group" && u.hover.id === groupId && u.hover.windowId === windowId);
  const q = query.trim();
  const rows = useMemo(() => (q ? rankByQuery(q, all) : all), [q, all]);
  const current = Math.max(0, Math.min(selected, rows.length - 1));
  const listHeight = Math.min(LIST_MAX, rows.length ? LIST_PAD * 2 + rows.length * PITCH - ROW_GAP : EMPTY_ROW);
  const panelHeight = SEARCH_ROW + DIVIDER + listHeight;
  const origin = hoverCardOrigin(anchor);
  const top = Math.max(8, Math.min(origin.top, windowHeight - panelHeight - 8));

  const holdWhileUsed = () => holdHover(focused.current && (typed.current || clicked.current));
  const takeFocus = () => {
    if (focused.current) return;
    focused.current = true;
    if (!focusOrigin) focusOrigin = saveKeyResponder(windowId);
    void focusOrigin.then(() => {
      if (focused.current) field.current?.focus();
    });
  };
  const handBack = (to: "origin" | "page") => {
    if (!focused.current) return;
    focused.current = false;
    holdHover(false);
    const next = useSidebarUi.getState().hover;
    if (to === "origin" && next?.kind === "group" && next.windowId === windowId && next.id !== groupId) return;
    const from = focusOrigin;
    focusOrigin = null;
    if (to === "page" || !from) return returnFocusToPage(windowId);
    void from.then(restoreKeyResponder).then((restored) => {
      if (!restored) returnFocusToPage(windowId);
    });
  };
  const latestHandBack = useRef(handBack);
  latestHandBack.current = handBack;

  useEffect(() => {
    if (live) takeFocus();
    else handBack("origin");
  }, [live]);
  useEffect(
    () => () => latestHandBack.current("origin"),
    [],
  );

  const reveal = (index: number) => {
    const rowTop = LIST_PAD + index * PITCH;
    if (rowTop - LIST_PAD < offset.current) scroll.current?.scrollTo({ y: rowTop - LIST_PAD, animated: false });
    else if (rowTop + ROW + LIST_PAD > offset.current + listHeight) scroll.current?.scrollTo({ y: rowTop + ROW + LIST_PAD - listHeight, animated: false });
  };
  const move = (delta: number) => {
    if (!rows.length) return;
    const next = Math.max(0, Math.min(rows.length - 1, current + delta));
    setSelected(next);
    reveal(next);
  };
  const close = () => {
    dismissHover();
    handBack("origin");
  };
  const choose = (row: Row | undefined) => {
    if (!row) return;
    dismissHover();
    clickTab(windowId, row.id);
    handBack("page");
  };

  return (
    <Surface
      {...cardHoverProps}
      onMouseEnter={() => {
        cardHoverProps.onMouseEnter();
        if (live) takeFocus();
      }}
      fill={hex(theme.panel)}
      cornerRadius={10}
      borderColor={hex(theme.panelBorder)}
      borderWidth={0.5}
      shadowColor="#000000"
      shadowOpacity={theme.panelShadowOpacity * 0.8}
      shadowRadius={16}
      shadowOffset={[0, 6]}
      style={{ position: "absolute", left: origin.left, top, width: WIDTH }}
    >
      <View
        onTouchStart={() => {
          clicked.current = true;
          if (focused.current) holdWhileUsed();
          else takeFocus();
        }}
        style={{ height: SEARCH_ROW, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 12 }}
      >
        <Symbol name="magnifyingglass" size={13} weight="semibold" color={theme.textSecondary} style={{ width: 14, height: 14 }} />
        <TextInput
          ref={field}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            typed.current = text.length > 0;
            if (!typed.current) clicked.current = false;
            holdWhileUsed();
            setSelected(0);
            offset.current = 0;
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
          placeholder="Search Tabs…"
          placeholderTextColor={theme.placeholder}
          selectionColor={theme.selection}
          enableFocusRing={false}
          onFocus={holdWhileUsed}
          onBlur={() => {
            if (focused.current) focusOrigin = null;
            focused.current = false;
            holdHover(false);
          }}
          keyDownEvents={[{ key: "Enter" }, { key: "Escape" }, { key: "ArrowUp" }, { key: "ArrowDown" }]}
          onKeyDown={(e) => {
            const key = e.nativeEvent.key;
            if (key === "Enter") choose(rows[current]);
            if (key === "Escape") close();
            if (key === "ArrowDown") move(1);
            if (key === "ArrowUp") move(-1);
          }}
          style={{ flex: 1, marginLeft: 8, fontSize: 13.5, color: theme.textPrimary, paddingVertical: 0 }}
        />
      </View>
      <View style={{ height: DIVIDER, backgroundColor: theme.divider }} />
      <ScrollView
        ref={scroll}
        style={{ height: listHeight }}
        contentContainerStyle={{ padding: LIST_PAD }}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {rows.length === 0 ? (
          <Text numberOfLines={1} style={{ paddingHorizontal: 10, lineHeight: EMPTY_ROW - LIST_PAD * 2, fontSize: 12.5, color: theme.textTertiary }}>
            No tabs match “{q}”
          </Text>
        ) : null}
        {rows.map((row, i) => (
          <PanelRow key={row.id} row={row} now={now} selected={i === current} last={i === rows.length - 1} onHover={() => setSelected(i)} onPress={() => choose(row)} />
        ))}
      </ScrollView>
    </Surface>
  );
}

function PanelRow({ row, now, selected, last, onHover, onPress }: { row: Row; now: number; selected: boolean; last: boolean; onHover(): void; onPress(): void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={row.title}>
      <View
        onMouseEnter={onHover}
        style={{
          height: ROW,
          marginBottom: last ? 0 : ROW_GAP,
          borderRadius: 5,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 8,
          paddingRight: 10,
          backgroundColor: selected ? theme.rowHover : undefined,
        }}
      >
        <TabIcon tabId={row.id} url={row.url} favicon={row.favicon} icon={row.icon} profileId={row.profileId} />
        <View style={{ flex: 1, marginLeft: 8, marginTop: -3, minWidth: 0 }}>
          <FadeLabel text={row.title} fontSize={13.5} color={theme.textTab} style={{ height: 18, marginLeft: -1 }} />
          <Text numberOfLines={1} style={{ fontSize: 11.5, lineHeight: 14, color: theme.textSecondary }}>
            {ago(row.lastActiveAt, now)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
