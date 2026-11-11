import { useMemo, useState } from 'react';
import { EmptyState } from '../components/common';
import { normalize } from '../lib/text';
import { useStore } from '../store';
import { TAG_RELATED } from '../lib/ai';
import type { Translation, Word } from '../types';

type Pool = 'all' | 'wrong' | 'related';
type Kind = 'ko2ja' | 'ja2ko' | 'sent';

/** 문장 퀴즈: 한국어 쪽을 문제로, 일본어 쪽을 정답으로 */
const sides = (t: Translation) =>
  t.direction === 'ko-ja' ? { ko: t.source, ja: t.target } : { ko: t.target, ja: t.source };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Session {
  pool: Pool;
  kind: Kind;
  queue: string[]; // word ids (문장 퀴즈는 translation ids)
  index: number;
  correct: number;
  wrong: number;
}

export function QuizPage({ goWords }: { goWords: () => void }) {
  const { data, setWrongIds } = useStore();
  const [pool, setPool] = useState<Pool>('all');
  const [kind, setKind] = useState<Kind>('ko2ja');
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);

  const wordMap = useMemo(() => new Map(data.words.map((w) => [w.id, w])), [data.words]);
  const wrongWords = useMemo(
    () => data.wrongWordIds.map((id) => wordMap.get(id)).filter((w): w is Word => !!w),
    [data.wrongWordIds, wordMap],
  );

  const transMap = useMemo(() => new Map(data.translations.map((t) => [t.id, t])), [data.translations]);
  const relatedSents = useMemo(() => data.translations.filter((t) => t.tags.includes(TAG_RELATED)), [data.translations]);

  function idsFor(p: Pool, k: Kind): string[] {
    if (k === 'sent') return (p === 'related' ? relatedSents : data.translations).map((t) => t.id);
    return (p === 'wrong' ? wrongWords : data.words).map((w) => w.id);
  }

  function start(p: Pool = pool, k: Kind = kind) {
    const ids = idsFor(p, k);
    if (!ids.length) return;
    setSession({ pool: p, kind: k, queue: shuffle(ids), index: 0, correct: 0, wrong: 0 });
    resetCard();
  }

  function pickKind(k: Kind) {
    setKind(k);
    if (k === 'sent' && pool === 'wrong') setPool('all');
    if (k !== 'sent' && pool === 'related') setPool('all');
  }

  function resetCard() {
    setInput('');
    setRevealed(false);
    setVerdict(null);
  }

  if (data.words.length === 0 && data.translations.length === 0) {
    return (
      <section>
        <div className="page-head"><h1>퀴즈</h1></div>
        <EmptyState
          title="퀴즈를 낼 단어가 없어요"
          steps={[
            '번역기에서 문장을 번역하면 단어와 추천 회화가 자동으로 저장돼요.',
            '한국어 뜻을 보고 일본어를 맞히는 퀴즈가 무작위로 나와요.',
            '틀린 단어는 기록되어 오답만 다시 풀 수 있어요.',
          ]}
          actionLabel="단어장으로 가기"
          onAction={goWords}
        />
      </section>
    );
  }

  // ---- 시작 화면 ----
  if (!session) {
    return (
      <section>
        <div className="page-head"><h1>퀴즈</h1></div>
        <div className="card form">
          <div>
            <span className="label">문제 유형</span>
            <div className="seg inline">
              <button className={kind === 'ko2ja' ? 'on' : ''} onClick={() => pickKind('ko2ja')}>뜻 → 일본어 (직접 입력)</button>
              <button className={kind === 'ja2ko' ? 'on' : ''} onClick={() => pickKind('ja2ko')}>일본어 → 뜻 (스스로 채점)</button>
              <button className={kind === 'sent' ? 'on' : ''} onClick={() => pickKind('sent')}>회화 문장 말하기 (스스로 채점)</button>
            </div>
          </div>
          <div>
            <span className="label">출제 범위</span>
            {kind === 'sent' ? (
              <div className="seg inline">
                <button className={pool === 'all' ? 'on' : ''} onClick={() => setPool('all')}>전체 문장 ({data.translations.length})</button>
                <button className={pool === 'related' ? 'on' : ''} onClick={() => setPool('related')}>추천 회화만 ({relatedSents.length})</button>
              </div>
            ) : (
              <div className="seg inline">
                <button className={pool === 'all' ? 'on' : ''} onClick={() => setPool('all')}>전체 단어 ({data.words.length})</button>
                <button className={pool === 'wrong' ? 'on' : ''} onClick={() => setPool('wrong')}>오답만 ({wrongWords.length})</button>
              </div>
            )}
          </div>
          {pool === 'wrong' && wrongWords.length === 0 && <p className="muted">기록된 오답이 없어요. 전체 단어로 먼저 풀어 보세요.</p>}
          {idsFor(pool, kind).length === 0 && pool !== 'wrong' && <p className="muted">이 범위에는 아직 문제가 없어요. 번역기에서 문장을 먼저 번역해 보세요.</p>}
          <button className="btn primary big" disabled={idsFor(pool, kind).length === 0} onClick={() => start()}>
            시작하기
          </button>
          <p className="hint">
            전체 단어 모드에서 틀린 단어가 오답에 기록돼요. 오답 모드에서 맞히면 오답 목록에서 빠져요.
          </p>
        </div>
      </section>
    );
  }

  // ---- 결과 화면 ----
  const total = session.queue.length;
  if (session.index >= total) {
    return (
      <section>
        <div className="page-head"><h1>퀴즈 결과</h1></div>
        <div className="card center">
          <p className="score">{session.correct} / {total}</p>
          <p className="muted">정답 {session.correct}개 · 오답 {session.wrong}개</p>
          {session.kind !== 'sent' && <p>기록된 오답: {wrongWords.length}개</p>}
          <div className="row center">
            <button className="btn primary" onClick={() => start(session.pool, session.kind)}>같은 범위로 다시</button>
            {session.kind !== 'sent' && (
              <button className="btn" disabled={wrongWords.length === 0} onClick={() => { setPool('wrong'); start('wrong', session.kind); }}>
                오답만 다시 풀기
              </button>
            )}
            <button className="btn" onClick={() => setSession(null)}>설정으로</button>
          </div>
        </div>
      </section>
    );
  }

  if (session.kind === 'sent') {
    const t = transMap.get(session.queue[session.index]);
    if (!t) {
      queueMicrotask(() => setSession({ ...session, index: session.index + 1 }));
      return null;
    }
    const { ko, ja } = sides(t);
    const mark = (ok: boolean) => {
      setVerdict(ok ? 'correct' : 'wrong');
      setSession({ ...session, correct: session.correct + (ok ? 1 : 0), wrong: session.wrong + (ok ? 0 : 1) });
    };
    return (
      <section>
        <div className="page-head">
          <h1>퀴즈 <small>회화 문장</small></h1>
          <button className="btn" onClick={() => setSession(null)}>그만하기</button>
        </div>
        <div className="progress" aria-label={`진행 ${session.index + 1}/${total}`}>
          <div style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
        <p className="count">{session.index + 1} / {total} · 정답 {session.correct} · 오답 {session.wrong}</p>
        <div className="card quiz">
          <p className="label">일본어로 말해 보세요 (소리 내거나 적어 본 뒤 답 보기)</p>
          <p className="q">{ko}</p>
          {!revealed && <button className="btn primary" onClick={() => setRevealed(true)}>답 보기</button>}
          {revealed && (
            <div className={`answer ${verdict ?? ''}`} role="status" aria-live="polite">
              {verdict && <p className="verdict">{verdict === 'correct' ? '⭕ 좋아요!' : '❌ 다음엔 맞혀 봐요'}</p>}
              <p className="ja-big" lang="ja">{ja}</p>
              {t.memo && <p className="memo">{t.memo}</p>}
            </div>
          )}
          {revealed && !verdict && (
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <button className="btn primary" onClick={() => mark(true)}>말할 수 있었어요</button>
              <button className="btn danger" onClick={() => mark(false)}>못 했어요</button>
            </div>
          )}
          {verdict && (
            <button className="btn primary big" onClick={() => { setSession({ ...session, index: session.index + 1 }); resetCard(); }} autoFocus>
              {session.index + 1 >= total ? '결과 보기' : '다음 문제'}
            </button>
          )}
        </div>
      </section>
    );
  }

  const word = wordMap.get(session.queue[session.index]);
  // 풀이 도중 삭제된 단어는 건너뜀
  if (!word) {
    queueMicrotask(() => setSession({ ...session, index: session.index + 1 }));
    return null;
  }

  async function record(isCorrect: boolean) {
    if (!word || !session) return;
    setVerdict(isCorrect ? 'correct' : 'wrong');
    setSession({ ...session, correct: session.correct + (isCorrect ? 1 : 0), wrong: session.wrong + (isCorrect ? 0 : 1) });
    const has = data.wrongWordIds.includes(word.id);
    if (!isCorrect && !has) await setWrongIds([...data.wrongWordIds, word.id]);
    if (isCorrect && has && session.pool === 'wrong') await setWrongIds(data.wrongWordIds.filter((x) => x !== word.id));
  }

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!word || verdict) return;
    const a = normalize(input);
    if (!a) return;
    void record(a === normalize(word.japanese) || (!!word.reading && a === normalize(word.reading)));
  }

  function next() {
    if (!session) return;
    setSession({ ...session, index: session.index + 1 });
    resetCard();
  }

  return (
    <section>
      <div className="page-head">
        <h1>퀴즈 <small>{session.pool === 'wrong' ? '오답 복습' : '전체'}</small></h1>
        <button className="btn" onClick={() => setSession(null)}>그만하기</button>
      </div>
      <div className="progress" aria-label={`진행 ${session.index + 1}/${total}`}>
        <div style={{ width: `${(session.index / total) * 100}%` }} />
      </div>
      <p className="count">{session.index + 1} / {total} · 정답 {session.correct} · 오답 {session.wrong}</p>

      <div className="card quiz">
        {session.kind === 'ko2ja' ? (
          <>
            <p className="label">이 뜻의 일본어는?</p>
            <p className="q">{word.meaning}</p>
            <form onSubmit={check} className="row">
              <input
                lang="ja"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!!verdict}
                placeholder="일본어 또는 히라가나로 입력"
                autoFocus
                autoCapitalize="off"
                autoComplete="off"
              />
              {!verdict && (
                <button className="btn primary" type="submit" disabled={!normalize(input)}>
                  정답 확인
                </button>
              )}
            </form>
            {!verdict && (
              <button className="btn link" onClick={() => void record(false).then(() => setRevealed(true))}>
                모르겠어요 (답 보기)
              </button>
            )}
          </>
        ) : (
          <>
            <p className="label">이 단어의 뜻은?</p>
            <p className="q ja" lang="ja">{word.japanese}</p>
            {!revealed && !verdict && (
              <button className="btn primary" onClick={() => setRevealed(true)}>답 보기</button>
            )}
          </>
        )}

        {(verdict || revealed) && (
          <div className={`answer ${verdict ?? ''}`} role="status" aria-live="polite">
            {verdict && (
              <p className="verdict">{verdict === 'correct' ? '⭕ 정답이에요!' : session.kind === 'ko2ja' ? '❌ 아쉬워요' : '❌ 오답으로 기록했어요'}</p>
            )}
            <p className="ja-big" lang="ja">
              {word.japanese}
              {word.reading && <small lang="ja">{word.reading}</small>}
            </p>
            <p className="meaning">{word.meaning}</p>
            {word.exampleJa && <p lang="ja">{word.exampleJa}</p>}
            {word.exampleKo && <p className="muted">{word.exampleKo}</p>}
            {word.memo && <p className="memo">📝 {word.memo}</p>}
          </div>
        )}

        {session.kind === 'ja2ko' && revealed && !verdict && (
          <div className="row">
            <button className="btn primary" onClick={() => void record(true)}>알고 있었어요</button>
            <button className="btn danger" onClick={() => void record(false)}>몰랐어요</button>
          </div>
        )}

        {verdict && (
          <button className="btn primary big" onClick={next} autoFocus>
            {session.index + 1 >= total ? '결과 보기' : '다음 문제'}
          </button>
        )}
      </div>
    </section>
  );
}
