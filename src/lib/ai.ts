import { stableTranslationId, stableWordId } from './id';
import type { Direction, Translation, Word } from '../types';

// ---------------- 설정 (API 키는 이 브라우저에만 저장, 내보내기 파일에는 포함하지 않음) ----------------

export interface AiSettings {
  apiKey: string;
  model: string;
  autoSave: boolean;
  relatedCount: number;
}

const SETTINGS_KEY = 'jp-study:settings:v1';
export const DEFAULT_MODEL = 'gpt-5-mini';
export const defaultSettings = (): AiSettings => ({ apiKey: '', model: DEFAULT_MODEL, autoSave: true, relatedCount: 3 });

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const v = JSON.parse(raw) as Partial<AiSettings>;
    const d = defaultSettings();
    return {
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : d.apiKey,
      model: typeof v.model === 'string' && v.model.trim() ? v.model : d.model,
      autoSave: typeof v.autoSave === 'boolean' ? v.autoSave : d.autoSave,
      relatedCount: typeof v.relatedCount === 'number' ? Math.min(10, Math.max(0, v.relatedCount)) : d.relatedCount,
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 저장 불가(시크릿 모드 등) — 이번 세션 동안만 유지 */
  }
}

// ---------------- 방향 자동 판별 ----------------

export function detectDirection(text: string): Direction {
  const hangul = (text.match(/[가-힣ㄱ-ㆎ]/g) ?? []).length;
  const japanese = (text.match(/[぀-ヿ一-鿿ｦ-ﾟ]/g) ?? []).length;
  return japanese > hangul ? 'ja-ko' : 'ko-ja';
}

// ---------------- 결과 형식 ----------------

export interface AiWord {
  japanese: string;
  reading: string;
  meaning: string;
  exampleJa: string;
  exampleKo: string;
}

export interface AiPhrase {
  ko: string;
  ja: string;
  reading: string;
  situation: string;
}

export interface AiResult {
  direction: Direction;
  source: string;
  translation: string;
  /** 일본어 쪽 문장의 히라가나 읽기 */
  reading: string;
  notes: string;
  words: AiWord[];
  related: AiPhrase[];
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];

/** 모델 응답(JSON 문자열)을 검증해 AiResult로 바꾼다. 필수값이 없으면 예외. */
export function parseAiResult(content: string, direction: Direction, source: string): AiResult {
  let raw: unknown;
  try {
    // 혹시 ```json 코드블록으로 감싸 오면 벗겨 낸다
    raw = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    throw new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('AI 응답 형식이 올바르지 않아요.');
  const r = raw as Record<string, unknown>;
  const translation = s(r.translation);
  if (!translation) throw new Error('AI 응답에 번역문이 없어요. 다시 시도해 주세요.');

  const seenW = new Set<string>();
  const words = arr(r.words)
    .map((w) => ({
      japanese: s(w.japanese),
      reading: s(w.reading),
      meaning: s(w.meaning),
      exampleJa: s(w.exampleJa),
      exampleKo: s(w.exampleKo),
    }))
    .filter((w) => w.japanese && w.meaning && !seenW.has(w.japanese) && seenW.add(w.japanese));

  const seenP = new Set<string>();
  const related = arr(r.related)
    .map((p) => ({ ko: s(p.ko), ja: s(p.ja), reading: s(p.reading), situation: s(p.situation) }))
    .filter((p) => p.ko && p.ja && !seenP.has(p.ko) && seenP.add(p.ko));

  return { direction, source: source.trim(), translation, reading: s(r.reading), notes: s(r.notes), words, related };
}

export const TAG_TRANSLATOR = '번역기';
export const TAG_RELATED = '추천회화';

/** AI 결과를 단어장/번역장 항목으로 변환. 내용 기반 ID라 같은 내용은 중복 저장되지 않는다. */
export function toRecords(r: AiResult, now: string = new Date().toISOString()): { words: Word[]; translations: Translation[] } {
  const jaSentence = r.direction === 'ko-ja' ? r.translation : r.source;
  const main: Translation = {
    id: stableTranslationId(r.direction, r.source),
    direction: r.direction,
    source: r.source,
    target: r.translation,
    memo: [r.reading && `읽기: ${r.reading}`, r.notes].filter(Boolean).join('\n'),
    tags: [TAG_TRANSLATOR],
    createdAt: now,
    updatedAt: now,
  };
  const words: Word[] = r.words.map((w) => ({
    id: stableWordId(w.japanese, w.reading),
    japanese: w.japanese,
    reading: w.reading,
    meaning: w.meaning,
    exampleJa: w.exampleJa || jaSentence,
    exampleKo: w.exampleJa ? w.exampleKo : r.direction === 'ko-ja' ? r.source : r.translation,
    memo: '',
    tags: [TAG_TRANSLATOR],
    createdAt: now,
    updatedAt: now,
  }));
  const related: Translation[] = r.related.map((p) => ({
    id: stableTranslationId('ko-ja', p.ko),
    direction: 'ko-ja',
    source: p.ko,
    target: p.ja,
    memo: [p.reading && `읽기: ${p.reading}`, p.situation].filter(Boolean).join('\n'),
    tags: [TAG_RELATED],
    createdAt: now,
    updatedAt: now,
  }));
  return { words, translations: [main, ...related] };
}

// ---------------- OpenAI 호출 ----------------

const API = 'https://api.openai.com/v1';

function systemPrompt(relatedCount: number): string {
  return `너는 한국인 학습자를 돕는 일본어 선생님 겸 번역가야. 사용자가 보낸 문장을 지정된 방향으로 자연스럽게 번역하고, 학습용 정보를 함께 JSON 객체 하나로만 답해.
형식:
{
  "translation": "번역문",
  "reading": "일본어 쪽 문장 전체의 히라가나 읽기 (한자를 모두 히라가나로)",
  "notes": "뉘앙스·문법·말투(반말/존댓말) 포인트를 한국어 1~3문장으로",
  "words": [ { "japanese": "단어(사전형)", "reading": "히라가나", "meaning": "한국어 뜻", "exampleJa": "짧은 일본어 예문", "exampleKo": "예문 해석" } ],
  "related": [ { "ko": "한국어 문장", "ja": "일본어 문장", "reading": "히라가나 읽기", "situation": "쓰는 상황 짧게" } ]
}
규칙:
- words: 일본어 쪽 문장에서 학습할 만한 핵심 단어·표현 최대 5개. 조사나 너무 쉬운 단어(です, は 등)는 빼.
- related: 이 문장과 비슷한 상황에서 바로 쓸 수 있는 실용 회화 ${relatedCount}개. 원문과 같은 문장은 빼.
- 일본어는 자연스러운 현대 일본어 구어체(상황에 맞는 정중도)로.
- JSON 외의 텍스트는 절대 쓰지 마.`;
}

async function readError(res: Response): Promise<string> {
  let detail = '';
  try {
    const j = (await res.json()) as { error?: { message?: string; code?: string } };
    detail = j.error?.message ?? '';
  } catch {
    /* ignore */
  }
  if (res.status === 401) return 'API 키가 올바르지 않아요. 설정에서 키를 다시 확인해 주세요.';
  if (res.status === 429) return `요청 한도를 넘었거나 크레딧이 부족해요. OpenAI 결제/사용량 페이지를 확인해 주세요. (${detail})`;
  if (res.status === 404 || /model/i.test(detail)) return `모델을 쓸 수 없어요. 설정에서 '모델 목록 불러오기'로 다른 모델을 골라 주세요. (${detail})`;
  return `OpenAI 오류 ${res.status}: ${detail || res.statusText}`;
}

export async function translateWithAi(
  settings: AiSettings,
  text: string,
  direction: Direction,
  signal?: AbortSignal,
): Promise<AiResult> {
  const dirText = direction === 'ko-ja' ? '한국어 → 일본어' : '일본어 → 한국어';
  let res: Response;
  try {
    res = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey.trim()}` },
      body: JSON.stringify({
        model: settings.model.trim(),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(settings.relatedCount) },
          { role: 'user', content: `방향: ${dirText}\n문장:\n${text.trim()}` },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('OpenAI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있어요. 다시 시도해 주세요.');
  return parseAiResult(content, direction, text);
}

/** 키로 쓸 수 있는 채팅 모델 목록 (gpt-*, o*) */
export async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey.trim()}` } });
  if (!res.ok) throw new Error(await readError(res));
  const j = (await res.json()) as { data?: { id: string }[] };
  return (j.data ?? [])
    .map((m) => m.id)
    .filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding)/.test(id))
    .sort();
}
