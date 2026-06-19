import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Supabase 자격증명이 있으면 클라우드 모드, 없으면 localStorage 목업 모드
export const isSupabaseEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anon!)
  : null;
