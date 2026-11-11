import { LocalStorageRepository } from './localStorageRepository';
import type { Repository } from './repository';

// 원격 저장소(Supabase 등)로 바꿀 때 여기서 구현체만 교체하세요.
export const repository: Repository = new LocalStorageRepository();
export type { Repository };
