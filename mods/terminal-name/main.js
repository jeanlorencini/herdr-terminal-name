// Modified 2026-11-11: terminal references, native names, bilingual messages.
// Personal adaptation of Herdr App pane header (Apache-2.0).
// Focus: exact terminal references and existing native names for human-to-agent targeting.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "terminal-name" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, Button } from "gpui-base";
import { messages } from "./i18n.js";
import { panes, terminals, props, run, theme, home, layout, notify } from "herdr";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args, label) {
    return div()
      .id(id)
      .tooltip(label)
      .accessibility_label(label)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/terminal-name/${icon}.svg`).size(14));
  }

  terminalReference(t, p, nativeName, labels) {
    const address = p.terminal;
    return Button.new(`terminal-reference-${p.pane}`)
      .flex_none().h(20).px(7).rounded(5)
      .border_1().border_color(t.border).bg(t.surface)
      .flex().items_center().font_family("JetBrains Mono").text_size(11)
      .font_semibold().text_color(p.focused ? t.accent : t.foreground).cursor_pointer()
      .accessibility_label(labels.copyLabel(address))
      .tooltip(labels.tooltip(address, nativeName))
      .hover(s => s.bg(t.hover).text_color(t.accent))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        cx.write_to_clipboard(address);
        notify({ title: labels.copied, body: labels.copiedBody(address), timeout: 1800 });
      })
      .child(address);
  }

  render(cx) {
    const t = theme();
    const labels = messages(props()?.language);
    const p = this.me();
    if (!p) return div();
    const nativeName = p.terminal ? terminals().find(item => item.address === p.terminal)?.name : null;
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || labels.shell;
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(p.terminal), el => el.child(this.terminalReference(t, p, nativeName, labels)))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().min_w(0).flex_shrink(1).truncate().max_w(260).font_medium().text_color(t.foreground).child(nativeName || name))
      .child(div().min_w(0).flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/terminal-name/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child(labels.needsYou)))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }, labels.splitRight))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }, labels.splitDown))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }, p.zoomed ? labels.unzoom : labels.zoom))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane }, labels.close)));
  }
}
