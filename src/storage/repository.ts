import type { AppData, Translation, Word } from '../types';

/**
 * 저장 계층 인터페이스.
 * 화면 코드는 이 인터페이스에만 의존합니다. 나중에 Supabase 등으로 바꿀 때는
 * 이 인터페이스를 구현한 클래스를 만들고 storage/index.ts 에서 교체하면 됩니다.
 * (모든 메서드가 Promise 를 반환하므로 원격 저장소로도 그대로 쓸 수 있습니다.)
 */
export interface Repository {
  /** 전체 데이터 읽기. 저장된 데이터가 손상된 경우 예외를 던집니다(덮어쓰지 않음). */
  load(): Promise<AppData>;
  upsertWord(word: Word): Promise<void>;
  deleteWord(id: string): Promise<void>;
  upsertTranslation(item: Translation): Promise<void>;
  deleteTranslation(id: string): Promise<void>;
  setWrongWordIds(ids: string[]): Promise<void>;
  /** 전체 교체 (가져오기 결과 반영용) */
  replaceAll(data: AppData): Promise<void>;
}
