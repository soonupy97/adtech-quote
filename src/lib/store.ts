// Store 선택: Supabase 설정 시 클라우드, 아니면 localStorage 목업
import { localStore, reseedCatalog } from "./store.local";
import { supabaseStore } from "./store.supabase";
import { isSupabaseEnabled } from "./supabaseClient";
import type { Store } from "./store.types";

export const store: Store = isSupabaseEnabled ? supabaseStore : localStore;
export { isSupabaseEnabled, reseedCatalog };
export type { Store } from "./store.types";
