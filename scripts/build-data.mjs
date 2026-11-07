// Turns content/book/*.md into src/data/book.json.
//
// Structure (see the heading rules at the top of each file):
//   # Phần I. Title            → part
//   ## Chương 3. Title         → chapter (numbered across the whole book)
//   ### Bài 3.1. Title         → lesson
//   #### Section               → lesson section; "Mục tiêu", "Câu hỏi phỏng vấn", "Tóm tắt", "Bài tập" are special.
// Lesson preamble lines: **Dòng CV:**, **Trạng thái:**, **Viz:**.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import csharp from 'highlight.js/lib/languages/csharp';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import lua from 'highlight.js/lib/languages/lua';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import powershell from 'highlight.js/lib/languages/powershell';

for (const [name, lang] of Object.entries({ sql, csharp, bash, json, yaml, lua, javascript, typescript, xml, ini, dockerfile, powershell })) {
  hljs.registerLanguage(name, lang);
}
const ALIAS = { 'c#': 'csharp', cs: 'csharp', tsql: 'sql', 't-sql': 'sql', sh: 'bash', shell: 'bash', js: 'javascript', ts: 'typescript', yml: 'yaml', toml: 'ini', ps1: 'powershell', html: 'xml' };

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const raw = (lang || 'text').trim().toLowerCase();
      const name = ALIAS[raw] ?? raw;
      const body = hljs.getLanguage(name) ? hljs.highlight(text, { language: name, ignoreIllegals: true }).value : escapeHtml(text);
      const label = raw === 'text' ? '' : `<span class="code-lang">${escapeHtml(raw)}</span>`;
      return `<div class="code">${label}<pre><code class="hljs language-${escapeHtml(name)}">${body}</code></pre></div>\n`;
    },
    // Tables scroll sideways inside a wrapper instead of widening the page.
    table(token) {
      const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      const head = `<tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr>`;
      const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
    },
  },
});

const CALLOUTS = { 'Ghi nhớ': 'note', 'Cảnh báo': 'warn', 'Mẹo': 'tip', 'Ví dụ': 'example' };
const decorate = (html) =>
  html.replace(/<blockquote>\s*<p><strong>([^<:]+):<\/strong>/g, (m, label) =>
    CALLOUTS[label.trim()] ? `<blockquote class="callout callout-${CALLOUTS[label.trim()]}"><p><strong class="callout-label">${label.trim()}</strong>` : m,
  );

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dir = new URL('../content/book/', import.meta.url);
const files = readdirSync(dir)
  .filter((f) => /^\d+.*\.md$/.test(f))
  .sort();

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const parts = [];
let links = {};
const render = (toks) => {
  const list = [...toks];
  list.links = links;
  return decorate(marked.parser(list));
};
const inline = (text) => marked.parseInline(text);

for (const file of files) {
  const tokens = marked.lexer(readFileSync(new URL(file, dir), 'utf8'));
  links = { ...links, ...(tokens.links ?? {}) };
  for (const t of tokens) {
    if (t.type === 'hr' || t.type === 'space') continue;
    const part = parts.at(-1);
    const chapter = part?.chapters.at(-1);
    const lesson = chapter?.lessons.at(-1);
    if (t.type === 'heading' && t.depth === 1) {
      const m = t.text.match(/^Phần\s+([IVXLC]+)\.\s*(.+)$/);
      if (!m) fail(file, `part heading must be "Phần <roman>. Title": ${t.text}`);
      parts.push({ id: m ? m[1] : t.text, title: m ? m[2] : t.text, intro: [], chapters: [] });
    } else if (t.type === 'heading' && t.depth === 2) {
      const m = t.text.match(/^Chương\s+(\d+)\.\s*(.+)$/);
      if (!m) fail(file, `chapter heading must be "Chương N. Title": ${t.text}`);
      if (!part) fail(file, `chapter before any part: ${t.text}`);
      part?.chapters.push({ num: m ? Number(m[1]) : 0, title: m ? m[2] : t.text, intro: [], lessons: [] });
    } else if (t.type === 'heading' && t.depth === 3) {
      const m = t.text.match(/^Bài\s+(\d+\.\d+)\.\s*(.+)$/);
      if (!m) fail(file, `lesson heading must be "Bài N.M. Title": ${t.text}`);
      if (!chapter) fail(file, `lesson before any chapter: ${t.text}`);
      chapter?.lessons.push({ id: m ? m[1] : t.text, title: m ? m[2] : t.text, file, tokens: [] });
    } else if (lesson) {
      lesson.tokens.push(t);
    } else if (chapter) {
      chapter.intro.push(t);
    } else if (part) {
      part.intro.push(t);
    } else if (t.type !== 'heading') {
      fail(file, `content before the first heading`);
    }
  }
}

const STATUSES = [
  ['Minh họa', 'minh-hoa'],
  ['Một phần', 'mot-phan'],
  ['Thật', 'that'],
];
const QA_RE = /^\*\*"([\s\S]+?)"\*\*\s*([\s\S]*)$/;
const SPECIAL = { 'Mục tiêu': 'goals', 'Câu hỏi phỏng vấn': 'qas', 'Tóm tắt': 'summary', 'Bài tập': 'exercises' };

function buildLesson(l, part, chapter) {
  const where = `${l.file} Bài ${l.id}`;
  const out = {
    id: l.id,
    title: inline(l.title),
    titleText: plain(inline(l.title)),
    part: part.id,
    chapter: chapter.num,
    cvLine: '',
    status: '',
    statusHtml: '',
    viz: '',
    goalsHtml: '',
    sections: [],
    qas: [],
    summaryHtml: '',
    exercises: [],
    tasks: [],
    minutes: 1,
  };
  // Preamble paragraphs before the first ####.
  const groups = [];
  for (const t of l.tokens) {
    if (t.type === 'heading' && t.depth === 4) {
      groups.push({ title: t.text.trim(), tokens: [] });
      continue;
    }
    if (t.type === 'heading') {
      fail(where, `unexpected h${t.depth} "${t.text}"`);
      continue;
    }
    if (!groups.length) {
      if (t.type === 'paragraph') {
        // A paragraph may hold several **Key:** lines.
        for (const line of t.text.split('\n')) {
          const m = line.match(/^\*\*(Dòng CV|Trạng thái|Viz):\*\*\s*(.*)$/);
          if (!m) {
            fail(where, `preamble line not recognised: ${line.slice(0, 60)}`);
            continue;
          }
          if (m[1] === 'Viz') out.viz = m[2].trim();
          else if (m[1] === 'Dòng CV') out.cvLine = inline(m[2].trim());
          else {
            const st = STATUSES.find(([label]) => m[2].trim().startsWith(label));
            if (!st) fail(where, `status must start with Thật / Một phần / Minh họa`);
            out.status = st ? st[1] : 'mot-phan';
            out.statusHtml = inline(m[2].trim().replace(/^(Thật|Một phần|Minh họa)\.?\s*/, ''));
          }
        }
      } else {
        fail(where, `unexpected ${t.type} before the first section`);
      }
      continue;
    }
    groups.at(-1).tokens.push(t);
  }

  const titles = groups.map((g) => g.title);
  for (const name of Object.keys(SPECIAL)) if (!titles.includes(name)) fail(where, `missing section "${name}"`);
  if (titles[0] !== 'Mục tiêu') fail(where, `first section must be "Mục tiêu"`);

  let taskN = 0;
  const withTasks = (html) =>
    html.replace(/<input (?:checked="" )?disabled="" type="checkbox">\s*/g, (m) => {
      taskN += 1;
      const id = `t-${l.id}-${taskN}`;
      out.tasks.push(id);
      return `<input type="checkbox" class="task" data-task="${id}" aria-label="Đánh dấu hoàn thành"> `;
    });

  const usedIds = new Set();
  for (const g of groups) {
    const kind = SPECIAL[g.title];
    if (kind === 'goals') out.goalsHtml = render(g.tokens);
    else if (kind === 'summary') out.summaryHtml = render(g.tokens);
    else if (kind === 'qas') {
      for (const t of g.tokens) {
        if (t.type !== 'list') {
          fail(where, `"Câu hỏi phỏng vấn" may only hold a list (found ${t.type})`);
          continue;
        }
        for (const item of t.items) {
          const m = item.text.match(QA_RE);
          if (!m || !m[1].trim().endsWith('?')) {
            fail(where, `Q&A item must start with **"question?"**: ${item.text.slice(0, 70)}`);
            continue;
          }
          out.qas.push({ id: `q-${l.id}-${out.qas.length + 1}`, q: inline(m[1].trim()), a: decorate(marked.parse(m[2].trim())) });
        }
      }
    } else if (kind === 'exercises') {
      for (const t of g.tokens) {
        if (t.type !== 'list') {
          out.exercises.push({ q: render([t]), a: '' });
          continue;
        }
        for (const item of t.items) {
          const [q, ...rest] = item.text.split(/\*\*Đáp án:\*\*/);
          out.exercises.push({ q: decorate(marked.parse(q.trim())), a: rest.length ? decorate(marked.parse(rest.join('**Đáp án:**').trim())) : '' });
        }
      }
    } else {
      let id = slug(g.title) || 'muc';
      while (usedIds.has(id)) id += '-2';
      usedIds.add(id);
      out.sections.push({ id, title: inline(g.title), html: withTasks(render(g.tokens)) });
    }
  }
  if (out.qas.length === 0) fail(where, 'no interview questions');

  const text = [
    out.titleText,
    plain(out.cvLine),
    plain(out.statusHtml),
    plain(out.goalsHtml),
    ...out.sections.map((s) => `${plain(s.title)} ${plain(s.html)}`),
    ...out.qas.map((q) => `${plain(q.q)} ${plain(q.a)}`),
    plain(out.summaryHtml),
    ...out.exercises.map((e) => `${plain(e.q)} ${plain(e.a)}`),
  ].join(' ');
  out.minutes = Math.max(2, Math.round(text.split(' ').length / 180));
  return out;
}

const book = {
  parts: parts.map((p) => ({
    id: p.id,
    title: inline(p.title),
    introHtml: render(p.intro),
    chapters: p.chapters.map((c) => ({
      num: c.num,
      title: inline(c.title),
      introHtml: render(c.intro),
      lessons: c.lessons.map((l) => buildLesson(l, p, c)),
    })),
  })),
};

// Numbering checks.
const chapters = book.parts.flatMap((p) => p.chapters);
chapters.forEach((c, i) => {
  if (i > 0 && c.num !== chapters[i - 1].num + 1) fail(`Chương ${c.num}`, `chapter numbers must be consecutive (after ${chapters[i - 1].num})`);
  c.lessons.forEach((l, j) => {
    if (l.id !== `${c.num}.${j + 1}`) fail(`Bài ${l.id}`, `expected Bài ${c.num}.${j + 1}`);
  });
});

if (errors.length) {
  console.error(`content/book has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/book.json', import.meta.url), JSON.stringify(book));

const lessons = chapters.flatMap((c) => c.lessons);
console.log(
  `book.json: ${book.parts.length} parts, ${chapters.length} chapters, ${lessons.length} lessons, ` +
    `${lessons.reduce((n, l) => n + l.qas.length, 0)} questions, ${lessons.reduce((n, l) => n + l.exercises.length, 0)} exercises, ` +
    `${lessons.filter((l) => l.viz).length} simulations, ${lessons.reduce((n, l) => n + l.tasks.length, 0)} checklist items`,
);
