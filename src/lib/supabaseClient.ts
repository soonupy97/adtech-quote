import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 연결 기본값(코드 내장). 환경변수(VITE_SUPABASE_*)가 있으면 그쪽이 우선한다.
// publishable 키는 "브라우저 공개용" 키라 클라이언트 번들에 포함돼도 안전하며
// (이미 배포 JS에 노출되는 종류), 실제 데이터 보호는 Supabase RLS 정책이 담당한다.
// ※ 배포 전 supabase/schema.sql 을 실행해 테이블/RLS를 먼저 생성해야 한다.
const DEFAULT_URL = "https://egbnloazsitbzycyymzh.supabase.co";
const DEFAULT_ANON = "sb_publishable_YALwTe4gtG4h4PRirxbYhQ_wl1f0alY";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON;

// Supabase 자격증명이 있으면 클라우드 모드, 없으면 localStorage 목업 모드
export const isSupabaseEnabled = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anon!)
  : null;
