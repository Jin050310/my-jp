import { useMemo, useState } from 'react';
import { EmptyState, Field, Modal, TagChips } from '../components/common';
import { randomId } from '../lib/id';
import { formatDate, matches, parseTags } from '../lib/text';
import { useStore } from '../store';
import type { Direction, Translation } from '../types';

const DIR_LABEL: Record<Direction, string> = { 'ko-ja': '한 → 일', 'ja-ko': '일 → 한' };
const langOf = (d: Direction, side: 'source' | 'target') =>
  (d === 'ko-ja') === (side === 'source') ? 'ko' : 'ja';

function TranslationForm({ initial, onClose }: { initial: Translation | null; onClose: () => void }) {
  const { saveTranslation, notify } = useStore();
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? 'ko-ja');
  const [source, setSource] = useState(initial?.source ?? '');
  const [target, setTarget] = useState(initial?.target ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source.trim() || !target.trim()) return setError('원문과 번역문을 모두 입력해 주세요.');
    const now = new Date().toISOString();
    const item: Translation = {
      id: initial?.id ?? randomId('t'),
      direction,
      source: source.trim(),
      target: target.trim(),
      memo: memo.trim(),
      tags: parseTags(tags),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    if (await saveTranslation(item)) {
      notify(initial ? '번역 문장을 수정했어요.' : '번역 문장을 저장했어요.');
      onClose();
    }
  }

  return (
    <Modal title={initial ? '번역 수정' : '번역 추가'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <fieldset className="seg">
          <legend className="label">방향</legend>
          {(Object.keys(DIR_LABEL) as Direction[]).map((d) => (
            <label key={d} className={direction === d ? 'on' : ''}>
              <input type="radio" name="dir" checked={direction === d} onChange={() => setDirection(d)} />
              {DIR_LABEL[d]}
            </label>
          ))}
        </fieldset>
        <Field label={`원문 (${langOf(direction, 'source') === 'ko' ? '한국어' : '일본어'}) *`}>
          <textarea lang={langOf(direction, 'source')} rows={3} value={source} onChange={(e) => setSource(e.target.value)} autoFocus />
        </Field>
        <Field label={`번역문 (${langOf(direction, 'target') === 'ko' ? '한국어' : '일본어'}) *`}>
          <textarea lang={langOf(direction, 'target')} rows={3} value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="상황 / 메모">
          <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 식당에서 주문할 때" />
        </Field>
        <Field label="태그" hint="쉼표로 구분해요.">
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
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

export function TranslationsPage({ goData }: { goData: () => void }) {
  const { data, removeTranslation } = useStore();
  const [query, setQuery] = useState('');
  const [dir, setDir] = useState<'all' | Direction>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Translation | null | 'new'>(null);

  const allTags = useMemo(() => [...new Set(data.translations.flatMap((t) => t.tags))].sort(), [data.translations]);
  const list = useMemo(
    () =>
      data.translations
        .filter(
          (t) =>
            (dir === 'all' || t.direction === dir) &&
            (!tag || t.tags.includes(tag)) &&
            matches([t.source, t.target, t.memo, ...t.tags], query),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.translations, query, dir, tag],
  );

  return (
    <section>
      <div className="page-head">
        <h1>번역장</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>
          ＋ 번역 추가
        </button>
      </div>

      {data.translations.length === 0 ? (
        <EmptyState
          title="아직 저장한 번역 문장이 없어요"
          steps={[
            "'번역 추가'에서 방향(한→일 / 일→한)을 고르고 원문과 번역문을 저장해요.",
            '어떤 상황에서 쓰는 말인지 메모해 두면 나중에 찾기 쉬워요.',
            '검색창과 태그로 다시 찾아봐요.',
          ]}
          actionLabel="＋ 첫 번역 추가"
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
            placeholder="원문 · 번역문 · 메모 · 태그 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="번역 검색"
          />
          <div className="seg inline" role="group" aria-label="방향 필터">
            {(['all', 'ko-ja', 'ja-ko'] as const).map((d) => (
              <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>
                {d === 'all' ? '전체' : DIR_LABEL[d]}
              </button>
            ))}
          </div>
          <TagChips tags={allTags} active={tag} onToggle={(t) => setTag(tag === t ? null : t)} />
          <p className="count">
            {list.length === data.translations.length ? `전체 ${list.length}개` : `${data.translations.length}개 중 ${list.length}개`}
          </p>
          {list.length === 0 && <p className="muted">검색 결과가 없어요.</p>}
          <ul className="list">
            {list.map((t) => (
              <li key={t.id} className="card item">
                <div className="item-main">
                  <span className="badge">{DIR_LABEL[t.direction]}</span>
                  <p className="src" lang={langOf(t.direction, 'source')}>{t.source}</p>
                  <p className="tgt" lang={langOf(t.direction, 'target')}>{t.target}</p>
                  {t.memo && <p className="memo">📝 {t.memo}</p>}
                  <TagChips tags={t.tags} />
                  <div className="meta">{formatDate(t.createdAt)}</div>
                </div>
                <div className="item-actions">
                  <button className="btn" onClick={() => setEditing(t)}>
                    수정
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (window.confirm('이 번역 문장을 삭제할까요?')) void removeTranslation(t.id);
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

      {editing && <TranslationForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
