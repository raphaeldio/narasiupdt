import { beforeEach, describe, expect, it } from 'vitest';
import type { ScanResult } from '../types';
import { MAX_ITEMS, useFeed } from './store';

const result = (id: string, label: ScanResult['label'] = 'hoax'): ScanResult =>
  ({ id, label, score: 92, tni_related: true, claims: 1, cached: false });

describe('useFeed', () => {
  beforeEach(() => useFeed.getState().clear());

  it('queued → done menyimpan label', () => {
    useFeed.getState().queued(['a'], 1);
    useFeed.getState().resolved([result('a')], 2);
    expect(useFeed.getState().entries.get('a')).toMatchObject({ status: 'done', label: 'hoax', score: 92, tniRelated: true });
  });

  it('gagal lalu diantre ulang menandai retried', () => {
    const s = useFeed.getState();
    s.queued(['a'], 1);
    s.failed(['a'], 2);
    expect(useFeed.getState().entries.get('a')).toMatchObject({ status: 'error', retried: false, at: 2 });
    useFeed.getState().queued(['a'], 3);
    useFeed.getState().failed(['a'], 4);
    expect(useFeed.getState().entries.get('a')).toMatchObject({ status: 'error', retried: true });
  });

  it(`dibatasi ${MAX_ITEMS} item, yang paling lama dibuang`, () => {
    const ids = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => `p${i}`);
    useFeed.getState().queued(ids, 1);
    const entries = useFeed.getState().entries;
    expect(entries.size).toBe(MAX_ITEMS);
    expect(entries.has('p0')).toBe(false);
    expect(entries.has(`p${MAX_ITEMS}`)).toBe(true);
  });
});
