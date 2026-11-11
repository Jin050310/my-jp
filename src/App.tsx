import { useEffect, useState } from 'react';
import { ToastView } from './components/common';
import { DataPage } from './pages/DataPage';
import { QuizPage } from './pages/QuizPage';
import { TranslationsPage } from './pages/TranslationsPage';
import { TranslatorPage } from './pages/TranslatorPage';
import { WordsPage } from './pages/WordsPage';
import { StoreProvider, useStore } from './store';

const TABS = [
  { id: 'translate', label: '번역기', icon: '🤖' },
  { id: 'words', label: '단어장', icon: '📖' },
  { id: 'translations', label: '번역장', icon: '💬' },
  { id: 'quiz', label: '퀴즈', icon: '✏️' },
  { id: 'data', label: '데이터', icon: '💾' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'translate';
};

function Shell() {
  const { ready, loadError } = useStore();
  const [tab, setTab] = useState<TabId>(fromHash);

  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (t: TabId) => {
    window.location.hash = `/${t}`;
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span lang="ja">日本語</span> 공부장</div>
        <nav className="tabs" aria-label="주 메뉴">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main>
        {!ready ? (
          <p className="muted">불러오는 중…</p>
        ) : loadError ? (
          <div className="alert error" role="alert">
            <strong>{loadError}</strong>
            <p>저장된 데이터를 덮어쓰지 않도록 앱 사용을 잠시 멈췄어요. 브라우저 개발자 도구(Application → Local Storage)에서 <code>jp-study:data:v1</code> 값을 복사해 백업한 뒤 다시 시도해 주세요.</p>
          </div>
        ) : tab === 'translate' ? (
          <TranslatorPage goQuiz={() => go('quiz')} />
        ) : tab === 'words' ? (
          <WordsPage goData={() => go('data')} />
        ) : tab === 'translations' ? (
          <TranslationsPage goData={() => go('data')} />
        ) : tab === 'quiz' ? (
          <QuizPage goWords={() => go('words')} />
        ) : (
          <DataPage />
        )}
      </main>
      <ToastView />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
