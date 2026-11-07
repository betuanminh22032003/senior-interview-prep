import { useEffect, useState } from 'react';
import {
  ChatsCircle,
  CheckSquare,
  Database,
  House,
  Lightning,
  ListChecks,
  Moon,
  Sun,
  Tag,
  TreeStructure,
  type Icon,
} from '@phosphor-icons/react';
import { ProgressContext, useProgressState } from './store';
import { Overview } from './views/Overview';
import { Cards } from './views/Cards';
import { Practice } from './views/Practice';
import { Keywords } from './views/Keywords';
import { Design } from './views/Design';
import { Behavior } from './views/Behavior';
import { Checklist } from './views/Checklist';
import { Sql } from './views/Sql';

const NAV: { key: string; label: string; icon: Icon }[] = [
  { key: 'overview', label: 'Tổng quan', icon: House },
  { key: 'cards', label: 'Từng dòng CV', icon: ListChecks },
  { key: 'practice', label: 'Luyện tập', icon: Lightning },
  { key: 'keywords', label: 'Keyword', icon: Tag },
  { key: 'design', label: 'System design', icon: TreeStructure },
  { key: 'behavior', label: 'Hành vi', icon: ChatsCircle },
  { key: 'sql', label: 'Tối ưu SQL', icon: Database },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare },
];

const viewFromHash = () => {
  const key = window.location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.key === key) ? key : 'overview';
};

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('senior-interview-prep:theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: follow the system setting.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const progress = useProgressState();
  const [view, setView] = useState(viewFromHash);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const onHash = () => {
      setView(viewFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('senior-interview-prep:theme', theme);
    } catch {
      // Storage blocked: theme resets on reload.
    }
  }, [theme]);

  const go = (key: string) => {
    window.location.hash = `/${key}`;
  };

  const resetProgress = () => {
    if (window.confirm('Xóa toàn bộ tiến độ ôn tập và checklist trên trình duyệt này?')) progress.reset();
  };

  return (
    <ProgressContext.Provider value={progress}>
      <div className="ambient" aria-hidden />
      <div className="app">
        <aside className="sidebar">
          <a className="brand" href="#/overview">
            <span className="brand-mark" aria-hidden />
            <span>
              <strong>Senior Backend</strong>
              <span className="muted small">Ôn phỏng vấn</span>
            </span>
          </a>
          <nav className="nav">
            {NAV.map(({ key, label, icon: NavIcon }) => (
              <a key={key} href={`#/${key}`} className={view === key ? 'active' : ''}>
                <NavIcon weight="bold" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
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
          {view === 'overview' && <Overview go={go} />}
          {view === 'cards' && <Cards />}
          {view === 'practice' && <Practice />}
          {view === 'keywords' && <Keywords />}
          {view === 'design' && <Design />}
          {view === 'behavior' && <Behavior />}
          {view === 'sql' && <Sql />}
          {view === 'checklist' && <Checklist />}
        </main>
      </div>
    </ProgressContext.Provider>
  );
}
