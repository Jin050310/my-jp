import { useMemo, useState } from 'react';
import { EmptyState, Field, Modal, TagChips } from '../components/common';
import { randomId } from '../lib/id';
import { formatDate, matches, parseTags } from '../lib/text';
import { useStore } from '../store';
import type { Word } from '../types';

const HIRAGANA = /^[ぁ-ゟーー\s・]*$/;

function WordForm({ initial, onClose }: { initial: Word | null; onClose: () => void }) {
  const { saveWord, notify } = useStore();
  const [f, setF] = useState({
    japanese: initial?.japanese ?? '',
    reading: initial?.reading ?? '',
    meaning: initial?.meaning ?? '',
    exampleJa: initial?.exampleJa ?? '',
    exampleKo: initial?.exampleKo ?? '',
    memo: initial?.memo ?? '',
    tags: initial?.tags.join(', ') ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.japanese.trim() || !f.meaning.trim()) return setError('일본어와 한국어 뜻은 꼭 입력해 주세요.');
    if (!HIRAGANA.test(f.reading.trim())) return setError('읽는 법은 히라가나로 입력해 주세요.');
    const now = new Date().toISOString();
    const word: Word = {
      id: initial?.id ?? randomId('w'),
      japanese: f.japanese.trim(),
      reading: f.reading.trim(),
      meaning: f.meaning.trim(),
      exampleJa: f.exampleJa.trim(),
      exampleKo: f.exampleKo.trim(),
      memo: f.memo.trim(),
      tags: parseTags(f.tags),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    if (await saveWord(word)) {
      notify(initial ? `'${word.japanese}'을(를) 수정했어요.` : `'${word.japanese}'을(를) 저장했어요.`);
      onClose();
    }
  }

  return (
    <Modal title={initial ? '단어 수정' : '단어 추가'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="일본어 *">
          <input lang="ja" value={f.japanese} onChange={set('japanese')} autoFocus placeholder="例: 勉強" />
        </Field>
        <Field label="읽는 법 (히라가나)">
          <input lang="ja" value={f.reading} onChange={set('reading')} placeholder="例: べんきょう" />
        </Field>
        <Field label="한국어 뜻 *">
          <input value={f.meaning} onChange={set('meaning')} placeholder="예: 공부" />
        </Field>
        <Field label="예문 (일본어)">
          <textarea lang="ja" rows={2} value={f.exampleJa} onChange={set('exampleJa')} />
        </Field>
        <Field label="예문 (한국어)">
          <textarea rows={2} value={f.exampleKo} onChange={set('exampleKo')} />
        </Field>
        <Field label="메모">
          <textarea rows={2} value={f.memo} onChange={set('memo')} />
        </Field>
        <Field label="태그" hint="쉼표로 구분해요. 예: 기초, 여행">
          <input value={f.tags} onChange={set('tags')} />
        </Field>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn primary">
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function WordsPage({ goData }: { goData: () => void }) {
  const { data, removeWord } = useStore();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Word | null | 'new'>(null);

  const allTags = useMemo(() => [...new Set(data.words.flatMap((w) => w.tags))].sort(), [data.words]);
  const list = useMemo(
    () =>
      data.words
        .filter((w) => (!tag || w.tags.includes(tag)) && matches([w.japanese, w.reading, w.meaning, ...w.tags], query))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.words, query, tag],
  );

  return (
    <section>
      <div className="page-head">
        <h1>단어장</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>
          ＋ 단어 추가
        </button>
      </div>

      {data.words.length === 0 ? (
        <EmptyState
          title="아직 저장한 단어가 없어요"
          steps={[
            "'단어 추가'로 일본어, 읽는 법, 한국어 뜻을 저장해요.",
            '저장한 단어는 검색하고 태그로 모아볼 수 있어요.',
            '단어가 쌓이면 퀴즈 탭에서 무작위로 복습해요.',
          ]}
          actionLabel="＋ 첫 단어 추가"
          onAction={() => setEditing('new')}
          secondary={
            <button className="btn" onClick={goData}>
              JSON 가져오기
            </button>
          }
        />
      ) : (
        <>
          <input
            className="search"
            type="search"
            placeholder="일본어 · 읽는 법 · 뜻 · 태그 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="단어 검색"
          />
          <TagChips tags={allTags} active={tag} onToggle={(t) => setTag(tag === t ? null : t)} />
          <p className="count">
            {list.length === data.words.length ? `전체 ${list.length}개` : `${data.words.length}개 중 ${list.length}개`}
          </p>
          {list.length === 0 && <p className="muted">검색 결과가 없어요.</p>}
          <ul className="list">
            {list.map((w) => (
              <li key={w.id} className="card item">
                <div className="item-main">
                  <div className="ja-big" lang="ja">
                    {w.japanese}
                    {w.reading && <small lang="ja">{w.reading}</small>}
                  </div>
                  <div className="meaning">{w.meaning}</div>
                  {(w.exampleJa || w.exampleKo) && (
                    <div className="example">
                      {w.exampleJa && <div lang="ja">{w.exampleJa}</div>}
                      {w.exampleKo && <div className="muted">{w.exampleKo}</div>}
                    </div>
                  )}
                  {w.memo && <p className="memo">📝 {w.memo}</p>}
                  <TagChips tags={w.tags} />
                  <div className="meta">{formatDate(w.createdAt)}</div>
                </div>
                <div className="item-actions">
                  <button className="btn" onClick={() => setEditing(w)}>
                    수정
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (window.confirm(`'${w.japanese}'을(를) 삭제할까요?`)) void removeWord(w.id);
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <WordForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
