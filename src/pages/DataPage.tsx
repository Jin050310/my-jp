import { useRef, useState } from 'react';
import {
  parseImport,
  planImport,
  SAMPLE_IMPORT_JSON,
  serializeExport,
  type ImportMode,
  type ImportPlan,
  type ParsedImport,
} from '../lib/importExport';
import { useStore } from '../store';

const MODE_LABEL: Record<ImportMode, { title: string; desc: string }> = {
  'merge-keep': { title: '병합 (기존 유지)', desc: '새 항목만 추가해요. ID가 같은 항목은 기존 것을 그대로 두고 건너뛰어요.' },
  'merge-overwrite': { title: '병합 (가져온 것으로 덮어쓰기)', desc: '새 항목은 추가하고, ID가 같은 항목은 가져온 내용으로 바꿔요. 그 밖의 기존 항목은 그대로 둬요.' },
  replace: { title: '전체 교체', desc: '현재 데이터를 모두 지우고 파일 내용으로 바꿔요. 파일에 없는 기존 항목은 사라져요.' },
};

export function DataPage() {
  const { data, replaceAll, notify } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge-keep');
  const [showFormat, setShowFormat] = useState(false);

  const plan: ImportPlan | null = parsed ? planImport(data, parsed, mode) : null;

  function exportJson() {
    const blob = new Blob([serializeExport(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jp-study-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`내보냈어요: 단어 ${data.words.length}개, 번역 ${data.translations.length}개`);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setErrors([]);
    const text = await file.text();
    const result = parseImport(text);
    if (result.ok) setParsed(result.value);
    else setErrors(result.errors);
  }

  function cancel() {
    setParsed(null);
    setErrors([]);
    setFileName('');
  }

  async function apply() {
    if (!plan) return;
    if (plan.mode === 'replace' && !window.confirm(`현재 데이터(단어 ${data.words.length}개, 번역 ${data.translations.length}개)를 모두 지우고 교체할까요? 되돌릴 수 없어요.\n필요하면 먼저 내보내기를 해 두세요.`)) return;
    if (await replaceAll(plan.result)) {
      const w = plan.words, t = plan.translations;
      notify(`가져오기 완료 — 단어: 추가 ${w.added} · 덮어쓰기 ${w.overwritten} · 건너뜀 ${w.skipped} · 삭제 ${w.removed} / 번역: 추가 ${t.added} · 덮어쓰기 ${t.overwritten} · 건너뜀 ${t.skipped} · 삭제 ${t.removed}`);
      cancel();
    }
  }

  return (
    <section>
      <div className="page-head"><h1>데이터 관리</h1></div>

      <div className="card">
        <h2>내보내기</h2>
        <p className="muted">현재 데이터: 단어 {data.words.length}개 · 번역 {data.translations.length}개 · 오답 기록 {data.wrongWordIds.length}개</p>
        <p className="hint">데이터는 이 브라우저(localStorage)에만 저장돼요. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지므로 가끔 내보내서 백업해 두세요.</p>
        <button className="btn primary" onClick={exportJson}>JSON 파일로 내보내기</button>
      </div>

      <div className="card">
        <h2>가져오기</h2>
        <p className="muted">내보내기로 만든 파일이나, 아래 형식에 맞춘 JSON(예: ChatGPT가 정리해 준 단어 목록)을 가져올 수 있어요.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()}>JSON 파일 선택</button>
          <button className="btn link" onClick={() => setShowFormat(!showFormat)}>
            {showFormat ? '형식 설명 닫기' : '가져오기 형식 보기'}
          </button>
        </div>

        {showFormat && (
          <div className="format">
            <pre>{SAMPLE_IMPORT_JSON}</pre>
            <ul>
              <li>단어 필수: <code>japanese</code>, <code>meaning</code> / 번역 필수: <code>direction</code>(<code>"ko-ja"</code> 또는 <code>"ja-ko"</code>), <code>source</code>, <code>target</code></li>
              <li><code>id</code>를 생략하면 내용(일본어+읽는 법 / 방향+원문)으로 ID를 만들어서, 같은 파일을 다시 가져와도 중복되지 않아요.</li>
              <li>위 예시는 형식 설명용이며 자동으로 저장되지 않아요.</li>
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="alert error" role="alert">
            <strong>{fileName}: 가져올 수 없어요. 아무것도 바뀌지 않았어요.</strong>
            <ul>{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

        {parsed && plan && (
          <div className="preview">
            <p><strong>{fileName}</strong> — 단어 {parsed.words.length}개 · 번역 {parsed.translations.length}개 확인됨 (형식 이상 없음)</p>
            {parsed.warnings.length > 0 && (
              <div className="alert warn"><ul>{parsed.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
            )}
            <fieldset className="modes">
              <legend className="label">기존 데이터와 합치는 방법</legend>
              {(Object.keys(MODE_LABEL) as ImportMode[]).map((m) => (
                <label key={m} className={mode === m ? 'on' : ''}>
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                  <span><strong>{MODE_LABEL[m].title}</strong><br /><small>{MODE_LABEL[m].desc}</small></span>
                </label>
              ))}
            </fieldset>
            <table className="result">
              <thead><tr><th></th><th>추가</th><th>덮어쓰기</th><th>건너뜀</th><th>삭제</th></tr></thead>
              <tbody>
                <tr><th>단어</th><td>{plan.words.added}</td><td>{plan.words.overwritten}</td><td>{plan.words.skipped}</td><td>{plan.words.removed}</td></tr>
                <tr><th>번역</th><td>{plan.translations.added}</td><td>{plan.translations.overwritten}</td><td>{plan.translations.skipped}</td><td>{plan.translations.removed}</td></tr>
              </tbody>
            </table>
            {plan.similarWords > 0 && (
              <p className="alert warn">일본어·읽는 법이 같지만 ID가 달라 새 항목으로 추가될 단어가 {plan.similarWords}개 있어요. 중복될 수 있으니 가져온 뒤 단어장에서 확인해 주세요.</p>
            )}
            <p className="hint">적용 후 합계: 단어 {plan.result.words.length}개 · 번역 {plan.result.translations.length}개</p>
            <div className="row end">
              <button className="btn" onClick={cancel}>취소</button>
              <button className={`btn ${mode === 'replace' ? 'danger' : 'primary'}`} onClick={() => void apply()}>
                {mode === 'replace' ? '전체 교체 적용' : '가져오기 적용'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
