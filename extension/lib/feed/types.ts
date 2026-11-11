import type { FeedItemKind, Platform } from '../types';

export interface FeedItem {
  id: string;
  kind: FeedItemKind;
  text: string;           // caption lengkap, sama seperti splitCaption() pada adapter video
  hashtags: string[];
  url: string;
  root: Element;          // elemen postingan (diobservasi)
  anchor: Element;        // elemen caption, atau root bila caption kosong
  media: Element | null;  // <video> atau <img> konten pertama
}

/** Adapter feed: hanya mengurus daftar postingan; analisis dipakai bersama semua platform. */
export interface FeedAdapter {
  platform: Platform;
  matchesFeed(location: Location): boolean;
  /** Hanya postingan yang punya ID; iklan bersponsor dilewati. */
  findItems(): FeedItem[];
}
