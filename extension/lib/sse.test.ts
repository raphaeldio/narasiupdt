import { describe, expect, it } from 'vitest';
import { SseParser } from './sse';

describe('SseParser', () => {
  it('memisahkan event yang terpotong di tengah chunk', () => {
    const p = new SseParser();
    expect(p.push('event: stage\ndata: {"stage":"cap')).toEqual([]);
    expect(p.push('tion"}\n\nevent: result\r\ndata: {"a":1}\r\n\r\n')).toEqual([
      { event: 'stage', data: '{"stage":"caption"}' },
      { event: 'result', data: '{"a":1}' },
    ]);
  });

  it('mengabaikan komentar keep-alive', () => {
    const p = new SseParser();
    expect(p.push(': keep-alive\n\n')).toEqual([]);
  });
});
