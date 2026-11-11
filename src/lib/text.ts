/** 검색용 정규화: 공백/대소문자/전각 차이 무시, 가타카나→히라가나 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const t of input.split(/[,，、\n]/)) {
    const v = t.trim().replace(/^#/, '');
    if (v) seen.add(v);
  }
  return [...seen];
}

export function matches(haystacks: string[], query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return haystacks.some((h) => normalize(h).includes(q));
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
