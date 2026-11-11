export type Direction = 'ko-ja' | 'ja-ko';

export interface Word {
  id: string;
  japanese: string;
  reading: string; // 히라가나
  meaning: string; // 한국어 뜻
  exampleJa: string;
  exampleKo: string;
  memo: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Translation {
  id: string;
  direction: Direction;
  source: string; // 원문
  target: string; // 번역문
  memo: string; // 상황/메모
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  schemaVersion: 1;
  words: Word[];
  translations: Translation[];
  /** 퀴즈에서 틀린 단어의 ID 목록 */
  wrongWordIds: string[];
}

export const emptyData = (): AppData => ({
  schemaVersion: 1,
  words: [],
  translations: [],
  wrongWordIds: [],
});
