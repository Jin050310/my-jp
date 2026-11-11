import { emptyData, type AppData, type Translation, type Word } from '../types';
import type { Repository } from './repository';

export const STORAGE_KEY = 'jp-study:data:v1';

export class LocalStorageRepository implements Repository {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<AppData> {
    const raw = localStorage.getItem(this.key);
    if (!raw) return emptyData();
    let parsed: Partial<AppData>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('브라우저에 저장된 데이터를 읽을 수 없어요. 데이터는 지우지 않고 그대로 두었어요.');
    }
    return {
      schemaVersion: 1,
      words: Array.isArray(parsed.words) ? parsed.words : [],
      translations: Array.isArray(parsed.translations) ? parsed.translations : [],
      wrongWordIds: Array.isArray(parsed.wrongWordIds) ? parsed.wrongWordIds : [],
    };
  }

  private write(data: AppData) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      throw new Error('저장하지 못했어요. 브라우저 저장 공간이 가득 찼거나 사용할 수 없는 상태예요.');
    }
  }

  private async mutate(fn: (d: AppData) => void) {
    const data = await this.load();
    fn(data);
    this.write(data);
  }

  upsertWord(word: Word) {
    return this.mutate((d) => {
      const i = d.words.findIndex((w) => w.id === word.id);
      if (i >= 0) d.words[i] = word;
      else d.words.push(word);
    });
  }

  deleteWord(id: string) {
    return this.mutate((d) => {
      d.words = d.words.filter((w) => w.id !== id);
      d.wrongWordIds = d.wrongWordIds.filter((x) => x !== id);
    });
  }

  upsertTranslation(item: Translation) {
    return this.mutate((d) => {
      const i = d.translations.findIndex((t) => t.id === item.id);
      if (i >= 0) d.translations[i] = item;
      else d.translations.push(item);
    });
  }

  deleteTranslation(id: string) {
    return this.mutate((d) => {
      d.translations = d.translations.filter((t) => t.id !== id);
    });
  }

  setWrongWordIds(ids: string[]) {
    return this.mutate((d) => {
      d.wrongWordIds = ids;
    });
  }

  async replaceAll(data: AppData) {
    this.write(data);
  }
}
