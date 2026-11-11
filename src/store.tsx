import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repository } from './storage';
import { emptyData, type AppData, type Translation, type Word } from './types';

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
  undo?: () => void;
}

interface Store {
  data: AppData;
  ready: boolean;
  loadError: string | null;
  toast: Toast | null;
  dismissToast: () => void;
  notify: (message: string, tone?: 'ok' | 'error', undo?: () => void) => void;
  saveWord: (w: Word) => Promise<boolean>;
  removeWord: (id: string) => Promise<void>;
  saveTranslation: (t: Translation) => Promise<boolean>;
  removeTranslation: (id: string) => Promise<void>;
  setWrongIds: (ids: string[]) => Promise<void>;
  replaceAll: (d: AppData) => Promise<boolean>;
  /** 여러 항목을 한 번에 추가. ID가 이미 있으면 건너뜀. 실패 시 null */
  addMany: (words: Word[], translations: Translation[]) => Promise<{ words: number; translations: number } | null>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 안에서만 사용할 수 있어요.');
  return v;
}

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const dismissToast = useCallback(() => setToast(null), []);
  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok', undo?: () => void) => {
    window.clearTimeout(timer.current);
    setToast({ id: ++seq.current, message, tone, undo });
    timer.current = window.setTimeout(() => setToast(null), undo ? 8000 : 4000);
  }, []);

  useEffect(() => {
    repository
      .load()
      .then(setData)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '데이터를 불러오지 못했어요.'))
      .finally(() => setReady(true));
  }, []);

  /** 저장 성공 시에만 화면 상태를 갱신한다. 실패하면 알림만 띄운다. */
  const run = useCallback(
    async (op: () => Promise<void>, apply: (d: AppData) => AppData): Promise<boolean> => {
      try {
        await op();
        setData(apply);
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : '저장하지 못했어요.', 'error');
        return false;
      }
    },
    [notify],
  );

  const value = useMemo<Store>(() => {
    const store: Store = {
      data,
      ready,
      loadError,
      toast,
      dismissToast,
      notify,
      saveWord: (w) => run(() => repository.upsertWord(w), (d) => ({ ...d, words: upsert(d.words, w) })),
      removeWord: async (id) => {
        const target = data.words.find((x) => x.id === id);
        const wasWrong = data.wrongWordIds.includes(id);
        const ok = await run(
          () => repository.deleteWord(id),
          (d) => ({ ...d, words: d.words.filter((x) => x.id !== id), wrongWordIds: d.wrongWordIds.filter((x) => x !== id) }),
        );
        if (ok && target)
          notify(`'${target.japanese}'을(를) 삭제했어요.`, 'ok', () => {
            void store.saveWord(target).then(async (saved) => {
              if (saved && wasWrong) await store.setWrongIds([...new Set([...dataRef.current.wrongWordIds, id])]);
              if (saved) notify(`'${target.japanese}'을(를) 되살렸어요.`);
            });
          });
      },
      saveTranslation: (t) =>
        run(() => repository.upsertTranslation(t), (d) => ({ ...d, translations: upsert(d.translations, t) })),
      removeTranslation: async (id) => {
        const target = data.translations.find((x) => x.id === id);
        const ok = await run(
          () => repository.deleteTranslation(id),
          (d) => ({ ...d, translations: d.translations.filter((x) => x.id !== id) }),
        );
        if (ok && target)
          notify('번역 문장을 삭제했어요.', 'ok', () => {
            void store.saveTranslation(target).then((saved) => saved && notify('번역 문장을 되살렸어요.'));
          });
      },
      setWrongIds: async (ids) => {
        await run(() => repository.setWrongWordIds(ids), (d) => ({ ...d, wrongWordIds: ids }));
      },
      replaceAll: (d) => run(() => repository.replaceAll(d), () => d),
      addMany: async (words, translations) => {
        const cur = dataRef.current;
        const wIds = new Set(cur.words.map((x) => x.id));
        const tIds = new Set(cur.translations.map((x) => x.id));
        const newW = words.filter((x) => !wIds.has(x.id) && wIds.add(x.id));
        const newT = translations.filter((x) => !tIds.has(x.id) && tIds.add(x.id));
        if (!newW.length && !newT.length) return { words: 0, translations: 0 };
        const next: AppData = { ...cur, words: [...cur.words, ...newW], translations: [...cur.translations, ...newT] };
        const ok = await run(() => repository.replaceAll(next), (d) => ({
          ...d,
          words: [...d.words, ...newW.filter((x) => !d.words.some((y) => y.id === x.id))],
          translations: [...d.translations, ...newT.filter((x) => !d.translations.some((y) => y.id === x.id))],
        }));
        return ok ? { words: newW.length, translations: newT.length } : null;
      },
    };
    return store;
  }, [data, ready, loadError, toast, dismissToast, notify, run]);

  const dataRef = useRef(data);
  dataRef.current = data;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
