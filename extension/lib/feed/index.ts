import { facebookFeed } from './facebook';
import { instagramFeed } from './instagram';
import type { FeedAdapter } from './types';

export const FEED_ADAPTERS: FeedAdapter[] = [instagramFeed, facebookFeed];

export function feedAdapterFor(location: Location): FeedAdapter | null {
  return FEED_ADAPTERS.find((a) => a.matchesFeed(location)) ?? null;
}

export type { FeedAdapter, FeedItem } from './types';
