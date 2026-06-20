// Store: 실서비스 전용(Supabase 클라우드). 로컬 목업 store 는 제거됨.
import { supabaseStore } from "./store.supabase";
import type { Store } from "./store.types";

export const store: Store = supabaseStore;
export type { Store } from "./store.types";
