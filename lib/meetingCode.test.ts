import { describe, it, expect } from 'vitest';
import {
  generateMeetingCode,
  normalizeCode,
  isMeetingCode,
  formatMeetingCode,
} from '@/lib/meetingCode';

describe('generateMeetingCode', () => {
  it('returns a string in the format pod-xxxx-xxxx', () => {
    const code = generateMeetingCode('abc123');
    expect(code).toMatch(/^pod-[a-z0-9]{4}-[a-z0-9]{4}$/);
  });

  it('is deterministic — same input produces same output', () => {
    const a = generateMeetingCode('session-1');
    const b = generateMeetingCode('session-1');
    expect(a).toBe(b);
  });

  it('produces different codes for different inputs', () => {
    const a = generateMeetingCode('session-A');
    const b = generateMeetingCode('session-B');
    expect(a).not.toBe(b);
  });

  it('only uses characters from the safe set (no 0, O, 1, l)', () => {
    const code = generateMeetingCode('test-id');
    const unsafe = /[0O1l]/;
    expect(code).not.toMatch(unsafe);
  });

  it('handles empty string input', () => {
    const code = generateMeetingCode('');
    expect(code).toMatch(/^pod-[a-z0-9]{4}-[a-z0-9]{4}$/);
  });

  it('handles very long session IDs', () => {
    const longId = 'a'.repeat(1000);
    const code = generateMeetingCode(longId);
    expect(code).toMatch(/^pod-[a-z0-9]{4}-[a-z0-9]{4}$/);
  });
});

describe('normalizeCode', () => {
  it('removes dashes and spaces', () => {
    expect(normalizeCode('pod-ab3k-9xmz')).toBe('ab3k9xmz');
    expect(normalizeCode('ab3k 9xmz')).toBe('ab3k9xmz');
  });

  it('removes the pod prefix', () => {
    expect(normalizeCode('podab3k9xmz')).toBe('ab3k9xmz');
    expect(normalizeCode('pod-ab3k-9xmz')).toBe('ab3k9xmz');
  });

  it('converts to lowercase', () => {
    expect(normalizeCode('POD-AB3K-9XMZ')).toBe('ab3k9xmz');
  });

  it('handles input without prefix or dashes', () => {
    expect(normalizeCode('ab3k9xmz')).toBe('ab3k9xmz');
  });

  it('handles empty string', () => {
    expect(normalizeCode('')).toBe('');
  });
});

describe('isMeetingCode', () => {
  it('accepts standard pod-xxxx-xxxx format', () => {
    expect(isMeetingCode('pod-ab3k-9xmz')).toBe(true);
  });

  it('accepts format without dashes', () => {
    expect(isMeetingCode('podab3k9xmz')).toBe(true);
  });

  it('accepts xxxx-xxxx without prefix', () => {
    expect(isMeetingCode('ab3k-9xmz')).toBe(true);
  });

  it('accepts 8 characters without prefix or dash', () => {
    expect(isMeetingCode('ab3k9xmz')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isMeetingCode('POD-AB3K-9XMZ')).toBe(true);
  });

  it('rejects codes that are too short', () => {
    expect(isMeetingCode('pod-ab3')).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isMeetingCode('pod-ab3k-9xmz-extra')).toBe(false);
  });

  it('rejects codes with invalid characters', () => {
    expect(isMeetingCode('pod-@b3k-9xmz')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isMeetingCode('')).toBe(false);
  });

  it('rejects input with only spaces', () => {
    expect(isMeetingCode('   ')).toBe(false);
  });

  it('accepts input with leading/trailing whitespace', () => {
    expect(isMeetingCode('  pod-ab3k-9xmz  ')).toBe(true);
  });
});

describe('formatMeetingCode', () => {
  it('formats 8-char normalized code with pod prefix and dash', () => {
    expect(formatMeetingCode('ab3k9xmz')).toBe('pod-ab3k-9xmz');
  });

  it('formats already-prefixed input correctly', () => {
    expect(formatMeetingCode('podab3k9xmz')).toBe('pod-ab3k-9xmz');
  });

  it('formats input with dashes correctly', () => {
    expect(formatMeetingCode('pod-ab3k-9xmz')).toBe('pod-ab3k-9xmz');
  });

  it('returns original if length is not 8 after normalization', () => {
    expect(formatMeetingCode('short')).toBe('short');
  });

  it('handles uppercase input', () => {
    expect(formatMeetingCode('POD-AB3K-9XMZ')).toBe('pod-ab3k-9xmz');
  });
});
