// Turns content/prep.md (Part D of interview-prep.md) into src/data/prep.json for the app.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const md = readFileSync(new URL('../content/prep.md', import.meta.url), 'utf8');
const tokens = marked.lexer(md);

const render = (toks) => {
  const list = [...toks];
  list.links = tokens.links ?? {};
  return marked.parser(list);
};
const inline = (text) => marked.parseInline(text);
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const STATUSES = [
  ['Minh họa', 'minh-hoa'],
  ['Một phần', 'mot-phan'],
  ['Thật', 'that'],
];
const statusOf = (text) => STATUSES.find(([label]) => text.trim().startsWith(label))?.[1] ?? 'mot-phan';

// Split into the intro (before the first ##) and ## sections.
const intro = [];
const sections = [];
for (const t of tokens) {
  if (t.type === 'hr' || (t.type === 'heading' && t.depth === 1)) continue;
  if (t.type === 'heading' && t.depth === 2) {
    sections.push({ title: t.text, tokens: [] });
    continue;
  }
  (sections.at(-1)?.tokens ?? intro).push(t);
}
const section = (prefix) => {
  const s = sections.find((x) => x.title.startsWith(prefix));
  if (!s) throw new Error(`Missing section ${prefix}`);
  return s;
};

// Splits a section's tokens at ### headings like "D2.1. Title".
function subsections(s) {
  const head = [];
  const subs = [];
  for (const t of s.tokens) {
    if (t.type === 'heading' && t.depth === 3) {
      const m = t.text.match(/^(D\d+\.\d+)\.\s*(.*)$/);
      subs.push({ code: m ? m[1] : t.text, title: m ? m[2] : t.text, tokens: [] });
      continue;
    }
    (subs.at(-1)?.tokens ?? head).push(t);
  }
  return { head, subs };
}

// D0: status table.
const d0 = section('D0.');
const statusTable = d0.tokens.find((t) => t.type === 'table');
const statusRows = statusTable.rows.map((r) => ({
  num: r[0].text,
  line: inline(r[1].text),
  status: statusOf(r[2].text),
  real: inline(r[3].text),
  illustrative: inline(r[4].text),
}));

// D2–D4: one card per CV bullet. List items that open with a bold quoted question become Q&A.
const QA_RE = /^\*\*"([\s\S]+?)"\*\*\s*([\s\S]*)$/;
function buildCard(sub, group) {
  let status = 'mot-phan';
  let statusHtml = '';
  const body = [];
  const qas = [];
  for (const t of sub.tokens) {
    if (t.type === 'paragraph' && t.text.startsWith('**Trạng thái:**')) {
      const rest = t.text.replace(/^\*\*Trạng thái:\*\*\s*/, '');
      status = statusOf(rest);
      statusHtml = marked.parse(rest);
      continue;
    }
    if (t.type === 'paragraph' && /^\*\*Câu hỏi xoáy/.test(t.text)) continue;
    if (t.type === 'list') {
      const keep = [];
      for (const item of t.items) {
        const m = item.text.match(QA_RE);
        if (m && m[1].trim().endsWith('?')) {
          qas.push({
            id: `${sub.code}-q${qas.length + 1}`,
            q: inline(m[1].trim()),
            a: marked.parse(m[2].trim()),
            source: sub.code,
            sourceTitle: sub.title,
          });
        } else {
          keep.push(item);
        }
      }
      if (keep.length) body.push({ ...t, items: keep });
      continue;
    }
    body.push(t);
  }
  const bodyHtml = render(body);
  return {
    id: sub.code,
    code: sub.code,
    title: sub.title,
    group,
    status,
    statusHtml,
    bodyHtml,
    qas,
    search: plain(`${sub.title} ${bodyHtml} ${qas.map((q) => q.q + ' ' + q.a).join(' ')}`),
  };
}
const cards = [
  ['D2.', 'VTC Online'],
  ['D3.', 'Examena'],
  ['D4.', 'IAS 2.0'],
].flatMap(([prefix, group]) => subsections(section(prefix)).subs.map((s) => buildCard(s, group)));

// D5: keyword tables grouped by ### heading.
const d5 = section('D5.');
const keywords = [];
let kwGroup = '';
const kwIntro = [];
for (const t of d5.tokens) {
  if (t.type === 'heading' && t.depth === 3) {
    kwGroup = t.text;
    continue;
  }
  if (t.type === 'table') {
    for (const r of t.rows) {
      keywords.push({
        id: `kw-${keywords.length + 1}`,
        group: kwGroup,
        keyword: r[0].text,
        say: inline(r[1].text),
        evidence: inline(r[2].text),
      });
    }
    continue;
  }
  if (!kwGroup) kwIntro.push(t);
}

// D6: system design.
const d6 = subsections(section('D6.'));
const design = {
  frameHtml: render(d6.head),
  topics: d6.subs.map((s) => ({ id: s.code, title: s.title, html: render(s.tokens) })),
};

// D7: behavioral questions.
const d7 = section('D7.');
const behaviorTable = d7.tokens.find((t) => t.type === 'table');
const behavior = {
  items: behaviorTable.rows.map((r, i) => ({
    id: `bh-${i + 1}`,
    question: inline(r[0].text),
    story: inline(r[1].text),
    source: inline(r[2].text),
  })),
  noteHtml: render(d7.tokens.filter((t) => t.type !== 'table')),
};

// D8: checklist.
const d8 = section('D8.');
const checklist = d8.tokens
  .filter((t) => t.type === 'list')
  .flatMap((t) => t.items.map((item) => inline(item.text.replace(/^\[[ xX]\]\s*/, ''))));

const data = {
  introHtml: render(intro),
  statusRows,
  summaryHtml: render(section('D1.').tokens),
  cards,
  keywordIntroHtml: render(kwIntro),
  keywords,
  design,
  behavior,
  checklist,
};

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/prep.json', import.meta.url), JSON.stringify(data, null, 2));

// content/sql-tuning.md → src/data/sql.json. "## T1. Group" holds "### S1. Skill" items.
// Inside a skill, "**Viz:** key" picks an interactive widget and the list under "#### Tự hỏi" becomes Q&A.
const sqlTokens = marked.lexer(readFileSync(new URL('../content/sql-tuning.md', import.meta.url), 'utf8'));
const renderSql = (toks) => {
  const list = [...toks];
  list.links = sqlTokens.links ?? {};
  return marked.parser(list);
};
const sqlIntro = [];
const sqlGroups = [];
for (const t of sqlTokens) {
  if (t.type === 'hr' || (t.type === 'heading' && t.depth === 1)) continue;
  const group = sqlGroups.at(-1);
  if (t.type === 'heading' && t.depth === 2) {
    const m = t.text.match(/^(T\d+)\.\s*(.*)$/);
    sqlGroups.push({ id: m ? m[1] : t.text, title: m ? m[2] : t.text, intro: [], skills: [] });
  } else if (t.type === 'heading' && t.depth === 3 && group) {
    const m = t.text.match(/^(S\d+)\.\s*(.*)$/);
    group.skills.push({ code: m ? m[1] : t.text, title: m ? m[2] : t.text, tokens: [] });
  } else if (group?.skills.length) {
    group.skills.at(-1).tokens.push(t);
  } else {
    (group?.intro ?? sqlIntro).push(t);
  }
}
const sql = {
  introHtml: renderSql(sqlIntro),
  groups: sqlGroups.map((g) => ({
    id: g.id,
    title: g.title,
    introHtml: renderSql(g.intro),
    skills: g.skills.map((s) => {
      let viz = '';
      let inQa = false;
      const body = [];
      const qas = [];
      for (const t of s.tokens) {
        if (t.type === 'paragraph' && t.text.startsWith('**Viz:**')) {
          viz = t.text.replace('**Viz:**', '').trim();
          continue;
        }
        if (t.type === 'heading' && t.depth === 4) inQa = t.text.trim() === 'Tự hỏi';
        if (inQa && t.type === 'list') {
          for (const item of t.items) {
            const m = item.text.match(QA_RE);
            if (!m) throw new Error(`${s.code}: Q&A item must start with **"question?"**`);
            qas.push({
              id: `sql-${s.code}-q${qas.length + 1}`,
              q: inline(m[1].trim()),
              a: marked.parse(m[2].trim()),
              source: s.code,
              sourceTitle: s.title,
            });
          }
          continue;
        }
        if (inQa) continue;
        body.push(t);
      }
      return { id: s.code, code: s.code, title: s.title, group: g.id, viz, bodyHtml: renderSql(body), qas };
    }),
  })),
};
writeFileSync(new URL('../src/data/sql.json', import.meta.url), JSON.stringify(sql, null, 2));

const qaCount = cards.reduce((n, c) => n + c.qas.length, 0);
console.log(
  `prep.json: ${statusRows.length} status rows, ${cards.length} cards, ${qaCount} Q&A, ` +
    `${keywords.length} keywords, ${design.topics.length} design topics, ` +
    `${behavior.items.length} behavioral, ${checklist.length} checklist items`,
);
const sqlSkills = sql.groups.flatMap((g) => g.skills);
console.log(
  `sql.json: ${sql.groups.length} groups, ${sqlSkills.length} skills, ` +
    `${sqlSkills.filter((s) => s.viz).length} widgets, ${sqlSkills.reduce((n, s) => n + s.qas.length, 0)} Q&A`,
);
