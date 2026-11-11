/** 무작위 ID (직접 추가한 항목용) */
export function randomId(prefix: string): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return `${prefix}_${c.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** cyrb53 문자열 해시 (비암호용, 내용 기반 안정 ID 생성) */
function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const norm = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ');

/** ID 없이 가져온 단어: 일본어+읽는 법이 같으면 항상 같은 ID → 중복 가져오기 방지 */
export const stableWordId = (japanese: string, reading: string) =>
  `w_${hash(`${norm(japanese)}|${norm(reading)}`)}`;

export const stableTranslationId = (direction: string, source: string) =>
  `t_${hash(`${direction}|${norm(source)}`)}`;
