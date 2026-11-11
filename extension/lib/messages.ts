import type { AnalysisResult, AnalyzeRequest, Health, Platform, ReportReason, ScanItem, ScanResult, StageEvent } from './types';

// Konten → background
export type ContentMessage =
  | { type: 'analyze:start'; key: string; payload: AnalyzeRequest }
  | { type: 'analyze:frames'; key: string; frames: string[] }
  | { type: 'analyze:audio'; key: string; chunk: string; index: number }
  | { type: 'analyze:complete'; key: string }
  | { type: 'analyze:cancel'; key: string }
  | { type: 'feed:scan'; platform: Platform; items: ScanItem[] }
  | { type: 'prefetch'; platform: Platform; videoId: string; caption: string }
  | { type: 'feedback'; platform: Platform; videoId: string; claimId: string | null }
  | { type: 'report'; platform: Platform; videoId: string; url: string; reason: ReportReason; note: string; result: AnalysisResult }
  | { type: 'capture:tab' }
  | { type: 'status'; active: boolean }
  | { type: 'health' };

export type StartResponse =
  | { ok: true; cached: true; result: AnalysisResult }
  | { ok: true; cached: false; sessionId: string; accepts: { frames: boolean; audio: boolean } }
  | { ok: false; error: string };

// Background → konten
export type SessionEvent =
  | { event: 'stage'; data: StageEvent }
  | { event: 'result'; data: AnalysisResult }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: Record<string, never> };

export type BackgroundMessage = { type: 'analyze:event'; key: string } & SessionEvent;

export type HealthResponse = { ok: true; health: Health } | { ok: false; error: string };

export type ScanResponse = { ok: true; results: ScanResult[] } | { ok: false; error: string };

export function send<T = unknown>(msg: ContentMessage): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}
