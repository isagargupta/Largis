import * as WebBrowser from "expo-web-browser";
import type { ReactNode } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { config } from "@/lib/config";
import { INLINE, parseMarkdown, safeHref, type Block } from "@/lib/markdown";
import { makeStyles } from "@/lib/theme";

type Styles = ReturnType<typeof useStyles>;

function openLink(href: string) {
  if (href.startsWith("mailto:")) Linking.openURL(href);
  else if (href.startsWith("/")) WebBrowser.openBrowserAsync(`${config.apiUrl}${href}`);
  else if (/^https?:/i.test(href)) WebBrowser.openBrowserAsync(href);
}

function inline(s: Styles, text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of Array.from(text.matchAll(INLINE))) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const k = `${key}-${n++}`;
    const [, code, linkText, linkUrl, bold, em] = match;
    if (code !== undefined) {
      out.push(
        <Text key={k} style={s.code}>
          {code}
        </Text>,
      );
    } else if (linkText !== undefined) {
      const href = safeHref(linkUrl);
      out.push(
        <Text key={k} style={href ? s.link : undefined} onPress={href ? () => openLink(href) : undefined}>
          {inline(s, linkText, k)}
        </Text>,
      );
    } else if (bold !== undefined) {
      out.push(
        <Text key={k} style={s.bold}>
          {inline(s, bold, k)}
        </Text>,
      );
    } else {
      out.push(
        <Text key={k} style={s.em}>
          {inline(s, em, k)}
        </Text>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const headingSize: Record<number, number> = { 1: 20, 2: 18, 3: 16, 4: 13 };

function renderBlock(s: Styles, block: Block, key: number) {
  switch (block.kind) {
    case "heading":
      return (
        <Text
          key={key}
          accessibilityRole="header"
          style={[s.heading, { fontSize: headingSize[block.level] }, block.level === 4 && s.headingSmall]}
        >
          {inline(s, block.text, `h${key}`)}
        </Text>
      );
    case "paragraph":
      return (
        <Text key={key} style={s.text}>
          {inline(s, block.text, `p${key}`)}
        </Text>
      );
    case "quote":
      return (
        <View key={key} style={s.quote}>
          <Text style={[s.text, s.quoteText]}>{inline(s, block.text, `q${key}`)}</Text>
        </View>
      );
    case "code":
      return (
        <ScrollView key={key} horizontal style={s.pre}>
          <Text style={s.codeBlock}>{block.text}</Text>
        </ScrollView>
      );
    case "rule":
      return <View key={key} style={s.rule} />;
    case "list":
      return (
        <View key={key} style={{ gap: 6 }}>
          {block.items.map((item, j) => (
            <View key={j} style={s.listItem}>
              <Text style={[s.text, s.marker]}>{block.ordered ? `${block.start + j}.` : "•"}</Text>
              <Text style={[s.text, { flex: 1 }]}>{inline(s, item, `l${key}-${j}`)}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <ScrollView key={key} horizontal>
          <View>
            <View style={[s.tableRow, s.tableHead]}>
              {block.header.map((cell, c) => (
                <Text key={c} style={[s.cell, s.bold, { textAlign: block.align[c] ?? "left" }]}>
                  {inline(s, cell, `t${key}-h${c}`)}
                </Text>
              ))}
            </View>
            {block.rows.map((row, r) => (
              <View key={r} style={s.tableRow}>
                {block.header.map((_, c) => (
                  <Text key={c} style={[s.cell, { textAlign: block.align[c] ?? "left" }]}>
                    {inline(s, row[c] ?? "", `t${key}-${r}-${c}`)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
  }
}

export function Markdown({ source }: { source: string }) {
  const s = useStyles();
  return <View style={{ gap: 14 }}>{parseMarkdown(source).map((block, i) => renderBlock(s, block, i))}</View>;
}

const useStyles = makeStyles((c) => ({
  text: { fontSize: 15, lineHeight: 23, color: c.inkMuted },
  heading: { fontWeight: "600", color: c.ink, marginTop: 6 },
  headingSmall: { textTransform: "uppercase", letterSpacing: 1, color: c.inkSubtle },
  bold: { fontWeight: "600", color: c.ink },
  em: { fontStyle: "italic" },
  link: { color: c.accent, textDecorationLine: "underline" },
  code: { fontFamily: "Menlo", fontSize: 13, backgroundColor: c.paperSoft, color: c.ink },
  pre: { backgroundColor: c.paperSoft, borderWidth: 1, borderColor: c.line, padding: 12 },
  codeBlock: { fontFamily: "Menlo", fontSize: 13, color: c.ink },
  quote: { borderLeftWidth: 2, borderLeftColor: c.gold, backgroundColor: c.paperSoft, paddingHorizontal: 12, paddingVertical: 8 },
  quoteText: { color: c.ink },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.line },
  listItem: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  marker: { color: c.gold, minWidth: 14 },
  tableRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  tableHead: { borderBottomColor: c.inkSubtle },
  cell: { width: 140, paddingHorizontal: 8, paddingVertical: 8, fontSize: 14, color: c.inkMuted },
}));
