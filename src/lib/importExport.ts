import { stableTranslationId, stableWordId } from './id';
import { normalize } from './text';
import { emptyData, type AppData, type Direction, type Translation, type Word } from '../types';

export interface ParsedImport {
  words: Word[];
  translations: Translation[];
  wrongWordIds: string[] | null; // null = 파일에 없음
  warnings: string[];
}

export type ParseResult = { ok: true; value: ParsedImport } | { ok: false; errors: string[] };

const MAX_ERRORS = 20;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 문자열 칸: 없으면 '', 문자열이면 trim, 그 외 형식이면 null(오류) */
function str(v: unknown): string | null {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' ? v.trim() : null;
}

function tagsOf(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return v.split(/[,，、]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  if (Array.isArray(v) && v.every((t) => typeof t === 'string'))
    return [...new Set((v as string[]).map((t) => t.trim().replace(/^#/, '')).filter(Boolean))];
  return null;
}

function dateOf(v: unknown, fallback: string): string {
  if (typeof v === 'string' && !Number.isNaN(new Date(v).getTime())) return v;
  return fallback;
}

export function parseImport(text: string, now: string = new Date().toISOString()): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['올바른 JSON 형식이 아니에요. 파일 내용이 잘렸거나 쉼표·따옴표가 빠지지 않았는지 확인해 주세요.'] };
  }
  if (!isObj(raw)) {
    return { ok: false, errors: ['최상위가 { "words": [...], "translations": [...] } 형태의 객체여야 해요.'] };
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) {
    return { ok: false, errors: [`지원하지 않는 schemaVersion(${String(raw.schemaVersion)})이에요. 1만 지원해요.`] };
  }
  if (raw.words === undefined && raw.translations === undefined) {
    return { ok: false, errors: ['"words" 또는 "translations" 배열이 하나도 없어요.'] };
  }
  for (const k of ['words', 'translations', 'wrongWordIds'] as const) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) return { ok: false, errors: [`"${k}"는 배열이어야 해요.`] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => {
    if (errors.length < MAX_ERRORS) errors.push(m);
    else if (errors.length === MAX_ERRORS) errors.push('…오류가 더 있어요. 위 항목부터 고쳐 주세요.');
  };

  const words = new Map<string, Word>();
  ((raw.words as unknown[]) ?? []).forEach((it, i) => {
    const at = `words[${i}]`;
    if (!isObj(it)) return err(`${at}: 객체가 아니에요.`);
    const japanese = str(it.japanese);
    const meaning = str(it.meaning);
    const reading = str(it.reading);
    const exampleJa = str(it.exampleJa);
    const exampleKo = str(it.exampleKo);
    const memo = str(it.memo);
    const tags = tagsOf(it.tags);
    if (japanese === null || meaning === null || reading === null || exampleJa === null || exampleKo === null || memo === null)
      return err(`${at}: 문자열이어야 하는 칸에 다른 형식의 값이 있어요.`);
    if (tags === null) return err(`${at}: tags는 문자열 배열이어야 해요.`);
    if (!japanese) return err(`${at}: "japanese"가 비어 있어요.`);
    if (!meaning) return err(`${at} (${japanese}): "meaning"이 비어 있어요.`);
    if (it.id !== undefined && (typeof it.id !== 'string' || !it.id.trim()))
      return err(`${at}: "id"는 비어 있지 않은 문자열이어야 해요.`);
    const id = typeof it.id === 'string' ? it.id.trim() : stableWordId(japanese, reading);
    if (words.has(id)) warnings.push(`words[${i}] (${japanese}): 파일 안에서 ID가 겹쳐 뒤의 항목만 사용해요.`);
    const createdAt = dateOf(it.createdAt, now);
    words.set(id, {
      id, japanese, reading, meaning, exampleJa, exampleKo, memo, tags,
      createdAt, updatedAt: dateOf(it.updatedAt, createdAt),
    });
  });

  const translations = new Map<string, Translation>();
  ((raw.translations as unknown[]) ?? []).forEach((it, i) => {
    const at = `translations[${i}]`;
    if (!isObj(it)) return err(`${at}: 객체가 아니에요.`);
    const source = str(it.source);
    const target = str(it.target);
    const memo = str(it.memo);
    const tags = tagsOf(it.tags);
    if (source === null || target === null || memo === null)
      return err(`${at}: 문자열이어야 하는 칸에 다른 형식의 값이 있어요.`);
    if (tags === null) return err(`${at}: tags는 문자열 배열이어야 해요.`);
    if (it.direction !== 'ko-ja' && it.direction !== 'ja-ko')
      return err(`${at}: "direction"은 "ko-ja" 또는 "ja-ko"여야 해요.`);
    if (!source) return err(`${at}: "source"가 비어 있어요.`);
    if (!target) return err(`${at}: "target"이 비어 있어요.`);
    if (it.id !== undefined && (typeof it.id !== 'string' || !it.id.trim()))
      return err(`${at}: "id"는 비어 있지 않은 문자열이어야 해요.`);
    const direction: Direction = it.direction;
    const id = typeof it.id === 'string' ? it.id.trim() : stableTranslationId(direction, source);
    if (translations.has(id)) warnings.push(`translations[${i}]: 파일 안에서 ID가 겹쳐 뒤의 항목만 사용해요.`);
    const createdAt = dateOf(it.createdAt, now);
    translations.set(id, {
      id, direction, source, target, memo, tags,
      createdAt, updatedAt: dateOf(it.updatedAt, createdAt),
    });
  });

  let wrongWordIds: string[] | null = null;
  if (Array.isArray(raw.wrongWordIds)) {
    if (!raw.wrongWordIds.every((x) => typeof x === 'string')) err('"wrongWordIds"는 문자열 배열이어야 해요.');
    else wrongWordIds = raw.wrongWordIds as string[];
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { words: [...words.values()], translations: [...translations.values()], wrongWordIds, warnings },
  };
}

export type ImportMode = 'merge-keep' | 'merge-overwrite' | 'replace';

interface Stat {
  added: number;
  overwritten: number;
  skipped: number;
  removed: number;
}

export interface ImportPlan {
  mode: ImportMode;
  words: Stat;
  translations: Stat;
  /** 내용은 같은데 ID만 달라 중복으로 보이는 단어 수 (병합 모드) */
  similarWords: number;
  result: AppData;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[], mode: ImportMode): { list: T[]; stat: Stat } {
  if (mode === 'replace') {
    const incomingIds = new Set(incoming.map((x) => x.id));
    const same = existing.filter((x) => incomingIds.has(x.id)).length;
    return {
      list: incoming,
      stat: { added: incoming.length - same, overwritten: same, skipped: 0, removed: existing.length - same },
    };
  }
  const map = new Map(existing.map((x) => [x.id, x]));
  const stat: Stat = { added: 0, overwritten: 0, skipped: 0, removed: 0 };
  for (const it of incoming) {
    if (!map.has(it.id)) {
      map.set(it.id, it);
      stat.added++;
    } else if (mode === 'merge-overwrite') {
      map.set(it.id, it);
      stat.overwritten++;
    } else {
      stat.skipped++;
    }
  }
  return { list: [...map.values()], stat };
}

export function planImport(current: AppData, parsed: ParsedImport, mode: ImportMode): ImportPlan {
  const w = mergeById(current.words, parsed.words, mode);
  const t = mergeById(current.translations, parsed.translations, mode);
  const valid = new Set(w.list.map((x) => x.id));
  const wrongRaw =
    mode === 'replace'
      ? (parsed.wrongWordIds ?? [])
      : [...new Set([...current.wrongWordIds, ...(parsed.wrongWordIds ?? [])])];
  const wrongWordIds = wrongRaw.filter((id) => valid.has(id));

  let similarWords = 0;
  if (mode !== 'replace') {
    const key = (x: Word) => `${normalize(x.japanese)}|${normalize(x.reading)}`;
    const ids = new Set(current.words.map((x) => x.id));
    const keys = new Set(current.words.map(key));
    similarWords = parsed.words.filter((x) => !ids.has(x.id) && keys.has(key(x))).length;
  }
  return {
    mode,
    words: w.stat,
    translations: t.stat,
    similarWords,
    result: { schemaVersion: 1, words: w.list, translations: t.list, wrongWordIds },
  };
}

export function serializeExport(data: AppData): string {
  return JSON.stringify({ ...emptyData(), ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export const SAMPLE_IMPORT_JSON = `{
  "words": [
    {
      "japanese": "勉強",
      "reading": "べんきょう",
      "meaning": "공부",
      "exampleJa": "毎日日本語を勉強します。",
      "exampleKo": "매일 일본어를 공부합니다.",
      "memo": "",
      "tags": ["기초"]
    }
  ],
  "translations": [
    {
      "direction": "ko-ja",
      "source": "처음 뵙겠습니다.",
      "target": "はじめまして。",
      "memo": "첫 인사",
      "tags": ["인사"]
    }
  ]
}`;
