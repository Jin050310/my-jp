import { describe, expect, it } from 'vitest';
import { parseImport, planImport } from './importExport';
import { emptyData } from '../types';

const NOW = '2026-01-01T00:00:00.000Z';
const ok = (json: unknown) => {
  const r = parseImport(JSON.stringify(json), NOW);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.value;
};

describe('parseImport', () => {
  it('JSON 문법 오류를 거부한다', () => {
    expect(parseImport('{oops', NOW).ok).toBe(false);
  });

  it('필수 칸이 없으면 위치와 함께 오류를 알려준다', () => {
    const r = parseImport(JSON.stringify({ words: [{ japanese: '犬' }], translations: [{ source: 'a', target: 'b', direction: 'xx' }] }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes('words[0]'))).toBe(true);
      expect(r.errors.some((e) => e.includes('translations[0]'))).toBe(true);
    }
  });

  it('ID가 없으면 내용 기반의 같은 ID를 만든다', () => {
    const a = ok({ words: [{ japanese: '犬', reading: 'いぬ', meaning: '개' }] });
    const b = ok({ words: [{ japanese: ' 犬 ', reading: 'いぬ', meaning: '강아지' }] });
    expect(a.words[0].id).toBe(b.words[0].id);
  });
});

describe('planImport', () => {
  const base = { ...emptyData(), words: ok({ words: [{ japanese: '犬', reading: 'いぬ', meaning: '개' }, { japanese: '猫', reading: 'ねこ', meaning: '고양이' }] }).words };
  const incoming = ok({ words: [{ japanese: '犬', reading: 'いぬ', meaning: '멍멍이' }, { japanese: '鳥', reading: 'とり', meaning: '새' }] });

  it('병합(기존 유지): 새 항목만 추가', () => {
    const p = planImport(base, incoming, 'merge-keep');
    expect(p.words).toEqual({ added: 1, overwritten: 0, skipped: 1, removed: 0 });
    expect(p.result.words).toHaveLength(3);
    expect(p.result.words.find((w) => w.japanese === '犬')?.meaning).toBe('개');
  });

  it('병합(덮어쓰기): 같은 ID는 가져온 값 사용', () => {
    const p = planImport(base, incoming, 'merge-overwrite');
    expect(p.words).toEqual({ added: 1, overwritten: 1, skipped: 0, removed: 0 });
    expect(p.result.words.find((w) => w.japanese === '犬')?.meaning).toBe('멍멍이');
  });

  it('전체 교체: 파일에 없는 기존 항목 삭제', () => {
    const p = planImport(base, incoming, 'replace');
    expect(p.words).toEqual({ added: 1, overwritten: 1, skipped: 0, removed: 1 });
    expect(p.result.words).toHaveLength(2);
  });

  it('같은 파일을 두 번 가져와도 중복되지 않는다', () => {
    const once = planImport(base, incoming, 'merge-keep').result;
    const twice = planImport(once, incoming, 'merge-keep').result;
    expect(twice.words).toHaveLength(once.words.length);
  });
});
