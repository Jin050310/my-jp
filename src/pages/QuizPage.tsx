import { useMemo, useState } from 'react';
import { EmptyState } from '../components/common';
import { normalize } from '../lib/text';
import { useStore } from '../store';
import type { Word } from '../types';

type Pool = 'all' | 'wrong';
type Kind = 'ko2ja' | 'ja2ko';

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
  queue: string[]; // word ids
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

  function start(p: Pool = pool, k: Kind = kind) {
    const source = p === 'wrong' ? wrongWords : data.words;
    if (!source.length) return;
    setSession({ pool: p, kind: k, queue: shuffle(source.map((w) => w.id)), index: 0, correct: 0, wrong: 0 });
    resetCard();
  }

  function resetCard() {
    setInput('');
    setRevealed(false);
    setVerdict(null);
  }

  if (data.words.length === 0) {
    return (
      <section>
        <div className="page-head"><h1>퀴즈</h1></div>
        <EmptyState
          title="퀴즈를 낼 단어가 없어요"
          steps={[
            '먼저 단어장에 단어를 저장해 주세요.',
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
              <button className={kind === 'ko2ja' ? 'on' : ''} onClick={() => setKind('ko2ja')}>뜻 → 일본어 (직접 입력)</button>
              <button className={kind === 'ja2ko' ? 'on' : ''} onClick={() => setKind('ja2ko')}>일본어 → 뜻 (스스로 채점)</button>
            </div>
          </div>
          <div>
            <span className="label">출제 범위</span>
            <div className="seg inline">
              <button className={pool === 'all' ? 'on' : ''} onClick={() => setPool('all')}>전체 단어 ({data.words.length})</button>
              <button className={pool === 'wrong' ? 'on' : ''} onClick={() => setPool('wrong')}>오답만 ({wrongWords.length})</button>
            </div>
          </div>
          {pool === 'wrong' && wrongWords.length === 0 && <p className="muted">기록된 오답이 없어요. 전체 단어로 먼저 풀어 보세요.</p>}
          <button className="btn primary big" disabled={pool === 'wrong' && wrongWords.length === 0} onClick={() => start()}>
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
          <p>기록된 오답: {wrongWords.length}개</p>
          <div className="row center">
            <button className="btn primary" onClick={() => start(session.pool, session.kind)}>같은 범위로 다시</button>
            <button className="btn" disabled={wrongWords.length === 0} onClick={() => { setPool('wrong'); start('wrong', session.kind); }}>
              오답만 다시 풀기
            </button>
            <button className="btn" onClick={() => setSession(null)}>설정으로</button>
          </div>
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
