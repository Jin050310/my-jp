import { useEffect, useRef, useState } from 'react';
import { Field } from '../components/common';
import {
  detectDirection,
  listModels,
  loadSettings,
  saveSettings,
  toRecords,
  translateWithAi,
  type AiResult,
  type AiSettings,
} from '../lib/ai';
import { useStore } from '../store';
import type { Direction } from '../types';

type DirChoice = 'auto' | Direction;
const DIR_LABEL: Record<DirChoice, string> = { auto: '자동', 'ko-ja': '한 → 일', 'ja-ko': '일 → 한' };

function SettingsCard({ settings, onChange, onDone }: { settings: AiSettings; onChange: (s: AiSettings) => void; onDone?: () => void }) {
  const [key, setKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadModels() {
    if (!key.trim()) return setMsg('먼저 API 키를 입력해 주세요.');
    setLoading(true);
    setMsg('');
    try {
      const list = await listModels(key);
      setModels(list);
      setMsg(list.length ? `사용 가능한 모델 ${list.length}개를 불러왔어요. 키도 정상이에요.` : '사용 가능한 채팅 모델이 없어요.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '모델 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    onChange({ ...settings, apiKey: key.trim(), model: model.trim() || settings.model });
    onDone?.();
  }

  return (
    <form className="card form" onSubmit={save}>
      <h2>ChatGPT 연결 설정</h2>
      <Field label="OpenAI API 키" hint="platform.openai.com → API keys 에서 발급해요. 키는 이 브라우저에만 저장되고, 내보내기 파일에도 들어가지 않아요.">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-..." autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="모델" hint="모르면 그대로 두세요. 오류가 나면 '모델 목록 불러오기'로 고를 수 있어요.">
        <div className="row">
          <input list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
          <button type="button" className="btn" onClick={() => void loadModels()} disabled={loading}>
            {loading ? '확인 중…' : '모델 목록 불러오기'}
          </button>
        </div>
        <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      </Field>
      {msg && <p className="hint">{msg}</p>}
      <label className="check">
        <input type="checkbox" checked={settings.autoSave} onChange={(e) => onChange({ ...settings, autoSave: e.target.checked })} />
        번역할 때마다 단어장·번역장에 자동 저장
      </label>
      <Field label="추천 회화 개수">
        <div className="seg">
          {[0, 3, 5].map((n) => (
            <button type="button" key={n} className={settings.relatedCount === n ? 'on' : ''} onClick={() => onChange({ ...settings, relatedCount: n })}>
              {n === 0 ? '안 받기' : `${n}개`}
            </button>
          ))}
        </div>
      </Field>
      <p className="alert warn">
        API 사용료는 OpenAI 계정으로 청구돼요. OpenAI 대시보드에서 <strong>월 사용 한도</strong>를 걸어 두고, 다른 사람과 같이 쓰는 PC에서는 키를 저장하지 마세요.
      </p>
      <div className="row end">
        <button className="btn primary" type="submit" disabled={!key.trim()}>저장</button>
      </div>
    </form>
  );
}

export function TranslatorPage({ goQuiz }: { goQuiz: () => void }) {
  const { addMany, notify } = useStore();
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(() => !loadSettings().apiKey);
  const [text, setText] = useState('');
  const [dir, setDir] = useState<DirChoice>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [saved, setSaved] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function updateSettings(s: AiSettings) {
    setSettings(s);
    saveSettings(s);
  }

  const effectiveDir: Direction = dir === 'auto' ? detectDirection(text) : dir;

  async function save(r: AiResult) {
    const { words, translations } = toRecords(r);
    const res = await addMany(words, translations);
    if (!res) return;
    setSaved(true);
    const related = r.related.length;
    if (res.words || res.translations)
      notify(`저장했어요 — 단어 ${res.words}개 · 문장 ${res.translations}개${related ? ` (추천 회화 포함)` : ''}`);
    else notify('이미 저장된 내용이에요.');
  }

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || loading) return;
    if (!settings.apiKey) return setShowSettings(true);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const r = await translateWithAi(settings, text, effectiveDir, ctrl.signal);
      setResult(r);
      if (settings.autoSave) await save(r);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '번역하지 못했어요.');
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }

  const jaLine = result && (result.direction === 'ko-ja' ? result.translation : result.source);

  return (
    <section>
      <div className="page-head">
        <h1>번역기</h1>
        <button className="btn" onClick={() => setShowSettings(!showSettings)}>{showSettings ? '설정 닫기' : '⚙️ 설정'}</button>
      </div>

      {showSettings && <SettingsCard settings={settings} onChange={updateSettings} onDone={() => setShowSettings(false)} />}

      <form className="card form" onSubmit={run}>
        <div className="seg">
          {(Object.keys(DIR_LABEL) as DirChoice[]).map((d) => (
            <button type="button" key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>
              {DIR_LABEL[d]}
              {d === 'auto' && dir === 'auto' && text.trim() ? ` (${DIR_LABEL[effectiveDir]})` : ''}
            </button>
          ))}
        </div>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void run();
          }}
          placeholder="번역할 한국어나 일본어 문장을 입력하세요"
          lang={effectiveDir === 'ko-ja' ? 'ko' : 'ja'}
        />
        <button className="btn primary big" type="submit" disabled={!text.trim() || loading}>
          {loading ? 'ChatGPT가 번역 중…' : '번역하기'}
        </button>
        <p className="hint">Ctrl + Enter로도 번역돼요. {settings.autoSave ? '결과는 단어장·번역장에 자동 저장돼요.' : '자동 저장이 꺼져 있어요.'}</p>
      </form>

      {error && <div className="alert error" role="alert">{error}</div>}

      {result && (
        <>
          <div className="card">
            <p className="muted" lang={result.direction === 'ko-ja' ? 'ko' : 'ja'}>{result.source}</p>
            <p className="ja-big" lang={result.direction === 'ko-ja' ? 'ja' : 'ko'}>{result.translation}</p>
            {result.reading && <p className="muted" lang="ja">{result.reading}</p>}
            {result.notes && <p className="memo">💡 {result.notes}</p>}
            <div className="row" style={{ marginTop: '0.6rem' }}>
              {saved ? (
                <span className="badge">✓ 저장됨</span>
              ) : (
                <button className="btn" onClick={() => void save(result)}>단어장·번역장에 저장</button>
              )}
              <button className="btn link" onClick={() => void navigator.clipboard?.writeText(result.translation).then(() => notify('번역문을 복사했어요.'))}>
                복사
              </button>
            </div>
          </div>

          {result.words.length > 0 && (
            <div className="card">
              <h2>📖 단어 정리</h2>
              <ul className="list">
                {result.words.map((w) => (
                  <li key={w.japanese} className="ai-row">
                    <p><strong lang="ja">{w.japanese}</strong> {w.reading && w.reading !== w.japanese && <small className="muted" lang="ja">{w.reading}</small>} — {w.meaning}</p>
                    {w.exampleJa && <p className="example" lang="ja">{w.exampleJa}{w.exampleKo && <><br /><span className="muted">{w.exampleKo}</span></>}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.related.length > 0 && (
            <div className="card">
              <h2>💬 비슷한 상황에서 쓰는 회화</h2>
              <ul className="list">
                {result.related.map((p) => (
                  <li key={p.ko} className="ai-row">
                    <p>{p.ko}</p>
                    <p className="tgt" lang="ja">{p.ja}</p>
                    {p.reading && <p className="muted" lang="ja">{p.reading}</p>}
                    {p.situation && <p className="hint">{p.situation}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {jaLine && saved && (
            <div className="row center">
              <button className="btn" onClick={goQuiz}>✏️ 저장한 내용으로 문제 풀기</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
