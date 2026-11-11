import { describe, expect, it } from 'vitest';
import { detectDirection, parseAiResult, toRecords } from './ai';

describe('detectDirection', () => {
  it('한국어 → ko-ja, 일본어 → ja-ko', () => {
    expect(detectDirection('화장실 어디예요?')).toBe('ko-ja');
    expect(detectDirection('トイレはどこですか')).toBe('ja-ko');
    expect(detectDirection('勉強')).toBe('ja-ko');
  });
});

describe('parseAiResult', () => {
  const content = JSON.stringify({
    translation: 'トイレはどこですか？',
    reading: 'といれはどこですか？',
    notes: '정중한 표현',
    words: [
      { japanese: 'トイレ', reading: 'といれ', meaning: '화장실' },
      { japanese: 'トイレ', reading: 'といれ', meaning: '중복' },
      { japanese: '', meaning: '빈 값' },
    ],
    related: [{ ko: '역은 어디예요?', ja: '駅はどこですか？', reading: 'えきはどこですか', situation: '길 묻기' }, { ko: 'x' }],
  });

  it('유효한 항목만 남기고 중복을 제거한다', () => {
    const r = parseAiResult(content, 'ko-ja', ' 화장실 어디예요? ');
    expect(r.source).toBe('화장실 어디예요?');
    expect(r.words).toHaveLength(1);
    expect(r.related).toHaveLength(1);
  });

  it('코드블록으로 감싼 응답도 읽는다', () => {
    expect(parseAiResult('```json\n' + content + '\n```', 'ko-ja', 'a').translation).toBe('トイレはどこですか？');
  });

  it('번역문이 없으면 예외', () => {
    expect(() => parseAiResult('{}', 'ko-ja', 'a')).toThrow();
    expect(() => parseAiResult('not json', 'ko-ja', 'a')).toThrow();
  });

  it('같은 내용이면 같은 ID로 변환된다', () => {
    const r = parseAiResult(content, 'ko-ja', '화장실 어디예요?');
    const a = toRecords(r, '2026-01-01T00:00:00.000Z');
    const b = toRecords(r, '2026-02-01T00:00:00.000Z');
    expect(a.words.map((w) => w.id)).toEqual(b.words.map((w) => w.id));
    expect(a.translations.map((t) => t.id)).toEqual(b.translations.map((t) => t.id));
    expect(a.translations).toHaveLength(2);
    expect(a.words[0].exampleJa).toBe('トイレはどこですか？');
  });
});
