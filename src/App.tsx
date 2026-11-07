import { useEffect, useState } from 'react';
import { BookOpen, Cards, CaretRight, Check, List, MagnifyingGlass, Moon, Sun, X, type Icon } from '@phosphor-icons/react';
import { ProgressContext, useProgress, useProgressState } from './store';
import { CHAPTERS, PARTS, chapterHref, lessonById, lessonHref, partOfChapter } from './data';
import { Home } from './views/Home';
import { ChapterView } from './views/ChapterView';
import { LessonView } from './views/LessonView';
import { Practice } from './views/Practice';
import { Search } from './views/Search';

type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string }
  | { name: 'chapter'; num: number }
  | { name: 'practice' }
  | { name: 'search'; q: string };

function parseHash(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const [head, arg] = path.split('/');
  if (head === 'bai' && arg && lessonById(arg)) return { name: 'lesson', id: arg };
  if (head === 'chuong' && arg && CHAPTERS.some((c) => c.num === Number(arg))) return { name: 'chapter', num: Number(arg) };
  if (head === 'on-tap') return { name: 'practice' };
  if (head === 'tim') return { name: 'search', q: new URLSearchParams(query).get('q') ?? '' };
  return { name: 'home' };
}

type Theme = 'light' | 'dark';
const THEME_KEY = 'senior-interview-prep:theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: follow the system setting.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const NAV: { href: string; label: string; icon: Icon; route: Route['name'] }[] = [
  { href: '#/', label: 'Mục lục', icon: BookOpen, route: 'home' },
  { href: '#/on-tap', label: 'Ôn tập', icon: Cards, route: 'practice' },
  { href: '#/tim', label: 'Tra cứu', icon: MagnifyingGlass, route: 'search' },
];

export function App() {
  const progress = useProgressState();
  const [route, setRoute] = useState<Route>(parseHash);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const next = parseHash();
      setRoute(next);
      setDrawer(false);
      if (!window.location.hash.includes('?')) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage blocked: theme resets on reload.
    }
  }, [theme]);

  // The chapter that holds the current page stays open in the table of contents.
  const activeChapter = route.name === 'lesson' ? lessonById(route.id)!.chapter : route.name === 'chapter' ? route.num : 0;
  const activePart = activeChapter ? partOfChapter(activeChapter).id : '';

  useEffect(() => {
    const title =
      route.name === 'lesson' ? `Bài ${route.id}. ${lessonById(route.id)!.titleText}` : route.name === 'practice' ? 'Ôn tập' : route.name === 'search' ? 'Tra cứu' : '';
    document.title = title ? `${title} · Giáo trình Senior Backend` : 'Giáo trình Senior Backend';
  }, [route]);

  const resetProgress = () => {
    if (window.confirm('Xóa toàn bộ tiến độ đọc, ôn tập và checklist trên trình duyệt này?')) progress.reset();
  };

  return (
    <ProgressContext.Provider value={progress}>
      <div className="app">
        <header className="topbar">
          <button className="btn-icon" onClick={() => setDrawer(true)} aria-label="Mở mục lục">
            <List weight="bold" />
          </button>
          <a className="brand small-brand" href="#/">
            Giáo trình Senior Backend
          </a>
          <button className="btn-icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Đổi giao diện sáng tối">
            {theme === 'dark' ? <Sun weight="bold" /> : <Moon weight="bold" />}
          </button>
        </header>

        {drawer && <div className="scrim" onClick={() => setDrawer(false)} aria-hidden />}

        <aside className={`sidebar ${drawer ? 'open' : ''}`}>
          <div className="sidebar-head">
            <a className="brand" href="#/">
              <span className="brand-mark" aria-hidden>
                SB
              </span>
              <span>
                <strong>Senior Backend</strong>
                <span className="muted small">Giáo trình ôn phỏng vấn</span>
              </span>
            </a>
            <button className="btn-icon drawer-close" onClick={() => setDrawer(false)} aria-label="Đóng mục lục">
              <X weight="bold" />
            </button>
          </div>

          <form
            className="side-search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? '';
              window.location.hash = `/tim${q ? `?q=${encodeURIComponent(q)}` : ''}`;
            }}
          >
            <MagnifyingGlass weight="bold" aria-hidden />
            <input name="q" type="search" placeholder="Tìm trong giáo trình" aria-label="Tìm trong giáo trình" />
          </form>

          <nav className="nav">
            {NAV.map(({ href, label, icon: NavIcon, route: r }) => (
              <a key={href} href={href} className={route.name === r ? 'active' : ''}>
                <NavIcon weight="bold" />
                <span>{label}</span>
              </a>
            ))}
          </nav>

          <Toc activePart={activePart} activeChapter={activeChapter} activeLesson={route.name === 'lesson' ? route.id : ''} />

          <div className="sidebar-foot">
            <button className="btn-icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Đổi giao diện sáng tối">
              {theme === 'dark' ? <Sun weight="bold" /> : <Moon weight="bold" />}
            </button>
            <button className="btn-link small" onClick={resetProgress}>
              Xóa tiến độ
            </button>
          </div>
        </aside>

        <main className="main">
          {route.name === 'home' && <Home />}
          {route.name === 'chapter' && <ChapterView key={route.num} num={route.num} />}
          {route.name === 'lesson' && <LessonView key={route.id} id={route.id} />}
          {route.name === 'practice' && <Practice />}
          {route.name === 'search' && <Search key={route.q} initial={route.q} />}
        </main>
      </div>
    </ProgressContext.Provider>
  );
}

function Toc({ activePart, activeChapter, activeLesson }: { activePart: string; activeChapter: number; activeLesson: string }) {
  const { progress } = useProgress();
  const [openParts, setOpenParts] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => openParts[id] ?? id === activePart;

  useEffect(() => {
    document.querySelector('.toc .toc-lesson.active')?.scrollIntoView({ block: 'nearest' });
  }, [activeLesson]);

  return (
    <nav className="toc" aria-label="Mục lục">
      {PARTS.map((p) => {
        const lessons = p.chapters.flatMap((c) => c.lessons);
        const done = lessons.filter((l) => progress.read[l.id]).length;
        const open = isOpen(p.id);
        return (
          <div key={p.id} className={`toc-part ${open ? 'open' : ''}`}>
            <button className="toc-part-head" onClick={() => setOpenParts((o) => ({ ...o, [p.id]: !open }))} aria-expanded={open}>
              <CaretRight weight="bold" className="caret" />
              <span className="toc-part-num mono">{p.id}</span>
              <span className="toc-part-title" dangerouslySetInnerHTML={{ __html: p.title }} />
              <span className="toc-count mono">
                {done}/{lessons.length}
              </span>
            </button>
            {open &&
              p.chapters.map((c) => (
                <div key={c.num} className="toc-chapter">
                  <a href={chapterHref(c.num)} className={`toc-chapter-head ${activeChapter === c.num && !activeLesson ? 'active' : ''}`}>
                    <span className="mono">{c.num}</span>
                    <span dangerouslySetInnerHTML={{ __html: c.title }} />
                  </a>
                  {c.lessons.map((l) => (
                    <a key={l.id} href={lessonHref(l.id)} className={`toc-lesson ${activeLesson === l.id ? 'active' : ''} ${progress.read[l.id] ? 'done' : ''}`}>
                      <span className="toc-lesson-num mono">{l.id}</span>
                      <span className="toc-lesson-title">{l.titleText}</span>
                      {progress.read[l.id] ? <Check weight="bold" className="toc-check" aria-label="Đã học" /> : null}
                    </a>
                  ))}
                </div>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
