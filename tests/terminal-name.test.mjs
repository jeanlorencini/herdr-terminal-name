import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { messages, resolveLanguage } from '../mods/terminal-name/i18n.js';
import { fileURLToPath } from 'node:url';

const sourcePath = process.env.HERDR_TERMINAL_NAME_SOURCE || fileURLToPath(new URL('../mods/terminal-name/main.js', import.meta.url));
const source = readFileSync(sourcePath, 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default class Pane', 'globalThis.Pane = class Pane');
function builder(kind = 'div') {
  const node = { kind, children: [], attrs: {}, handlers: {} };
  const proxy = new Proxy(node, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => {
      if (key === 'child') target.children.push(args[0]);
      else if (key === 'when') { if (args[0]) args[1](proxy); }
      else if (String(key).startsWith('on_')) target.handlers[key] = args[0];
      else target.attrs[key] = args;
      return proxy;
    };
  }});
  return proxy;
}
const panes = [
  { pane: 'p111111', terminal: 't58', title: 'Do not copy this title', program: { name: 'Codex', agent: true }, cwd: 'E:/a', focused: true },
  { pane: 'p222222', terminal: 't59', title: 'same title', program: { name: 'Codex', agent: true }, cwd: 'E:/b' },
  { pane: 'p333333', terminal: 't60', title: 'PowerShell', program: { name: 'pwsh', shell: true }, cwd: 'E:/c' },
  { pane: 'vps/p111111', terminal: 'vps/t58', title: 'remote', program: { name: 'Codex', agent: true }, cwd: '/repo' },
  { pane: 'p444444', terminal: null, title: 'files', program: null },
];
let terminals = [{ address: 't60', name: 'revisor' }, { address: 'vps/t58', name: 'revisor' }, { address: 'unrelated/t59', name: 'wrong-name' }];
let currentLanguage = 'pt-BR';
let props = { pane: panes[0].pane };
let layout = { content: { tab: 'active', pane: { header: { position: 'top' } } } };
const colors = { background: '#17191b', border: '#303237', surface: '#1f2124', muted: '#9c9da1', foreground: '#e4e4e7', accent: '#8ab4f8' };
const calls = [], notices = [];
const context = vm.createContext({ View: class {}, div: builder, h_flex: () => builder('row'), svg: () => builder('svg'), image: () => builder('image'), Button: { new: id => builder('button').id(id) }, messages, panes: () => panes, terminals: () => terminals, props: () => props, theme: () => colors, layout: () => layout, home: () => 'C:/Users/test', run: (...args) => calls.push(args), notify: n => notices.push(n) });
vm.runInContext(source, context);
function render(p = panes[0], hover = false) {
  props = { pane: p.pane, language: currentLanguage };
  const v = new context.Pane(); v.init(); v.hovered = hover;
  return v.render({});
}
function nodes(tree) { return [tree, ...tree.children.filter(n => n && typeof n === 'object').flatMap(nodes)]; }
function find(tree, id) { return nodes(tree).find(n => n.attrs.id?.[0] === id); }
function badge(tree, p) { return find(tree, `terminal-reference-${p.pane}`); }

test('the exact terminal reference is visible for every local and remote pane', () => {
  for (const p of panes.filter(p => p.terminal)) {
    const b = badge(render(p), p);
    assert.equal(b.kind, 'button');
    assert.equal(b.children[0], p.terminal);
    assert.ok(b.attrs.flex_none, 'reference cannot shrink away');
    assert.equal(b.attrs.truncate, undefined, 'address is never abbreviated');
    assert.match(b.attrs.accessibility_label[0], /para a IA/);
    assert.ok(b.attrs.tooltip[0].includes(`Para indicar à IA: ${p.terminal}`));
    assert.ok(!b.attrs.tooltip[0].includes(p.pane));
  }
});
test('copy uses the full terminal address, never title, alias or Pane ID', () => {
  for (const p of panes.filter(p => p.terminal)) {
    let value, stopped = false;
    const before = calls.length;
    badge(render(p), p).handlers.on_click({}, { stop_propagation() { stopped = true; }, write_to_clipboard(text) { value = text; } });
    assert.equal(value, p.terminal);
    assert.equal(stopped, true);
    assert.equal(calls.length, before);
    assert.ok(notices.at(-1).body.includes(p.terminal));
  }
});
test('native names appear next to the reference and are resolved by exact address', () => {
  for (const p of [panes[2], panes[3]]) assert.ok(nodes(render(p)).some(n => n.children.includes('revisor')));
  const t59 = render(panes[1]);
  assert.ok(!nodes(t59).some(n => n.children.includes('wrong-name')));
  assert.ok(nodes(t59).some(n => n.children.includes('Codex')));
});
test('metadata updates rerender without inventing names or keeping stale metadata', () => {
  terminals = [{ address: 't58', name: 'backend' }];
  assert.ok(nodes(render()).some(n => n.children.includes('backend')));
  terminals = [];
  assert.ok(!nodes(render()).some(n => n.children.includes('backend')));
  assert.ok(nodes(render()).some(n => n.children.includes('Codex')));
});
test('mod panes and removed panes never get a fake terminal reference', () => {
  assert.equal(badge(render(panes[4]), panes[4]), undefined);
  assert.equal(render({ pane: 'removed' }).children.length, 0);
});
test('native split zoom close and header focus still target the actual Pane ID', () => {
  const p = panes[0], tree = render(p, true);
  tree.handlers.on_click();
  assert.equal(calls.at(-1)[0], 'pane.focus');
  assert.equal(calls.at(-1)[1].pane, p.pane);
  for (const [id, cmd] of [['r','pane.split'], ['d','pane.split'], ['z','pane.zoom'], ['x','pane.close']]) {
    let stopped = false;
    find(tree, `ph-${id}-${p.pane}`).handlers.on_click({}, { stop_propagation() { stopped = true; } });
    assert.equal(calls.at(-1)[0], cmd);
    assert.equal(calls.at(-1)[1].pane, p.pane);
    assert.equal(stopped, true);
  }
});
test('focus styling, bottom divider and all status indicators stay available', () => {
  assert.equal(badge(render(), panes[0]).attrs.text_color[0], colors.accent);
  assert.equal(badge(render(panes[1]), panes[1]).attrs.text_color[0], colors.foreground);
  layout.content.pane.header.position = 'bottom';
  for (const status of ['working', 'blocked', 'done', 'idle']) {
    panes[0].status = status;
    const tree = render();
    assert.ok(tree.attrs.border_t);
    assert.equal(tree.attrs.border_b, undefined);
    assert.ok(badge(tree, panes[0]));
    if (status === 'working') assert.ok(nodes(tree).some(n => n.attrs.spin));
    if (status === 'blocked') assert.ok(nodes(tree).some(n => n.children.includes('Precisa de você')));
    if (status === 'done') assert.ok(nodes(tree).some(n => n.attrs.size?.[0] === 7));
  }
  assert.ok(source.includes('mods/terminal-name/spinner.svg'));
  assert.ok(!source.includes('mods/pane-id/'));
});

test('English is the default and unsupported or malformed language choices fall back safely', () => {
  for (const value of [undefined, null, '', 'en', 'en-US', 'de-DE', {}, 42]) assert.equal(resolveLanguage(value), 'en');
  for (const value of ['pt', 'pt-BR', 'pt-PT', ' PT_br ']) assert.equal(resolveLanguage(value), 'pt-BR');
  assert.deepEqual(Object.keys(messages('en')), Object.keys(messages('pt-BR')));
});

test('both languages translate labels, tooltips, notification and blocked status without changing targets', () => {
  for (const language of ['en', 'pt-BR']) {
    currentLanguage = language;
    const expected = messages(language), p = panes[0];
    p.status = 'blocked';
    const tree = render(p, true), b = badge(tree, p);
    assert.equal(b.attrs.accessibility_label[0], expected.copyLabel(p.terminal));
    assert.equal(b.attrs.tooltip[0], expected.tooltip(p.terminal, null));
    assert.ok(nodes(tree).some(n => n.children.includes(expected.needsYou)));
    for (const [id, text] of [['r', expected.splitRight], ['d', expected.splitDown], ['z', expected.zoom], ['x', expected.close]]) {
      assert.equal(find(tree, `ph-${id}-${p.pane}`).attrs.tooltip[0], text);
    }
    let copied;
    b.handlers.on_click({}, { stop_propagation() {}, write_to_clipboard(text) { copied = text; } });
    assert.equal(copied, 't58');
    assert.equal(notices.at(-1).title, expected.copied);
    assert.equal(notices.at(-1).body, expected.copiedBody('t58'));
  }
  currentLanguage = 'pt-BR';
});
