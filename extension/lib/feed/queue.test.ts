import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanItem, ScanResult } from '../types';
import { BATCH_SIZE, PAUSE_MS, RETRY_AFTER_MS, ScanQueue } from './queue';
import { useFeed } from './store';

const item = (id: string): ScanItem => ({ id, kind: 'text', text: `teks ${id}`, hashtags: [], url: '' });
const ok = (items: ScanItem[]): ScanResult[] =>
  items.map((i) => ({ id: i.id, label: 'unverified', score: null, tni_related: false, claims: 0, cached: false }));

describe('ScanQueue', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
    useFeed.getState().clear();
  });

  it(`mengirim per batch maksimal ${BATCH_SIZE}`, async () => {
    const send = vi.fn(async (items: ScanItem[]) => ok(items));
    const q = new ScanQueue(send, () => now);
    for (let i = 0; i < 12; i++) q.enqueue(item(`p${i}`));
    await q.flush();
    await q.flush();
    expect(send.mock.calls.map(([items]) => items.length)).toEqual([10, 2]);
  });

  it('tidak mengirim ulang ID yang sama', async () => {
    const send = vi.fn(async (items: ScanItem[]) => ok(items));
    const q = new ScanQueue(send, () => now);
    q.enqueue(item('a'));
    q.enqueue(item('a'));
    await q.flush();
    q.enqueue(item('a'));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toHaveLength(1);
  });

  it('item gagal dicoba ulang sekali setelah 30 dtk', async () => {
    const send = vi.fn(async () => null);
    const q = new ScanQueue(send, () => now);
    q.enqueue(item('a'));
    await q.flush();
    expect(useFeed.getState().entries.get('a')?.status).toBe('error');
    q.enqueue(item('a'));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
    now += RETRY_AFTER_MS;
    q.enqueue(item('a'));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(2);
    now += RETRY_AFTER_MS;
    q.enqueue(item('a'));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('jeda 60 dtk setelah 3 batch gagal berturut-turut', async () => {
    const send = vi.fn(async () => null);
    const q = new ScanQueue(send, () => now);
    for (const id of ['a', 'b', 'c']) {
      q.enqueue(item(id));
      await q.flush();
    }
    q.enqueue(item('d'));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(3);
    now += PAUSE_MS;
    await q.flush();
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('ID yang tidak dikembalikan server ditandai gagal', async () => {
    const q = new ScanQueue(async (items) => ok(items.slice(1)), () => now);
    q.enqueue(item('a'));
    q.enqueue(item('b'));
    await q.flush();
    expect(useFeed.getState().entries.get('a')?.status).toBe('error');
    expect(useFeed.getState().entries.get('b')?.status).toBe('done');
  });
});
