import { storage } from '#imports';
import type { Mode, Platform } from './types';

export type PlatformToggles = Record<Platform, boolean>;

export const enabledItem = storage.defineItem<boolean>('local:enabled', { fallback: true });

export const platformsItem = storage.defineItem<PlatformToggles>('local:platforms', {
  fallback: { instagram: true, tiktok: true, youtube: true, facebook: true, testbed: true },
});

export const modeItem = storage.defineItem<Mode>('local:mode', { fallback: 'multimodal' });

export const feedEnabledItem = storage.defineItem<boolean>('local:feedEnabled', { fallback: true });

export const backendUrlItem = storage.defineItem<string>('local:backendUrl', {
  fallback: import.meta.env.WXT_BACKEND_URL ?? 'http://localhost:8000',
});

// ID instalasi acak untuk rate limit; bukan identitas pengguna.
export const installIdItem = storage.defineItem<string>('local:installId', {
  init: () => crypto.randomUUID(),
});

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram Reels & feed',
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  facebook: 'Facebook Reels & feed',
  testbed: 'Halaman uji (testbed)',
};
