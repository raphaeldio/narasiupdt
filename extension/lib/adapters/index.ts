import { facebook } from './facebook';
import { instagram } from './instagram';
import { tiktok } from './tiktok';
import type { Adapter } from './types';
import { youtube } from './youtube';

export const ADAPTERS: Adapter[] = [instagram, tiktok, youtube, facebook];

export function adapterFor(location: Location): Adapter | null {
  return ADAPTERS.find((a) => a.matches(location)) ?? null;
}

export type { Adapter } from './types';
