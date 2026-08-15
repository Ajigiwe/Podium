import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Room } from 'livekit-client';
import { useRaisedHands } from '@/hooks/useRaisedHands';

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockPublishData = vi.fn();

// Only the members the hook actually touches are stubbed, so the object is cast to
// Room rather than implementing all ~126 members of the real class.
const createMockRoom = (overrides: Partial<Room> = {}) => ({
  on: mockOn,
  off: mockOff,
  localParticipant: {
    publishData: mockPublishData,
  },
  ...overrides,
} as unknown as Room);

vi.mock('@livekit/components-react', () => ({
  useRoomContext: vi.fn(() => createMockRoom()),
}));

import { useRoomContext } from '@livekit/components-react';

describe('useRaisedHands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRoomContext).mockReturnValue(createMockRoom());
  });

  describe('initial state', () => {
    it('returns an empty raisedHands array', () => {
      const { result } = renderHook(() => useRaisedHands());
      expect(result.current.raisedHands).toEqual([]);
    });

    it('registers a data listener on mount', () => {
      renderHook(() => useRaisedHands());
      expect(mockOn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function)
      );
    });

    it('unregisters the listener on unmount', () => {
      const { unmount } = renderHook(() => useRaisedHands());
      unmount();
      expect(mockOff).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function)
      );
    });

    it('handles null room gracefully', () => {
      vi.mocked(useRoomContext).mockReturnValue(null as unknown as Room);
      const { result } = renderHook(() => useRaisedHands());
      expect(result.current.raisedHands).toEqual([]);
    });
  });

  describe('raiseHand', () => {
    it('optimistically adds a hand to the list', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });

      expect(result.current.raisedHands).toHaveLength(1);
      expect(result.current.raisedHands[0]).toMatchObject({
        participantId: 'user-1',
        participantName: 'Alice',
      });
      expect(result.current.raisedHands[0].timestamp).toBeGreaterThan(0);
    });

    it('broadcasts HAND_RAISED data via LiveKit', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });

      expect(mockPublishData).toHaveBeenCalledTimes(1);

      const callArg = mockPublishData.mock.calls[0][0];
      const decoded = JSON.parse(new TextDecoder().decode(callArg));
      expect(decoded).toMatchObject({
        type: 'HAND_RAISED',
        participantId: 'user-1',
        participantName: 'Alice',
      });
    });

    it('does not add duplicate hands for the same participant', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });
      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });

      expect(result.current.raisedHands).toHaveLength(1);
    });

    it('allows different participants to raise hands', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });
      await act(async () => {
        result.current.raiseHand('user-2', 'Bob');
      });

      expect(result.current.raisedHands).toHaveLength(2);
      expect(result.current.raisedHands[0].participantName).toBe('Alice');
      expect(result.current.raisedHands[1].participantName).toBe('Bob');
    });

    it('does not throw when room is null', async () => {
      vi.mocked(useRoomContext).mockReturnValue(null as unknown as Room);
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });

      expect(result.current.raisedHands).toHaveLength(1);
    });
  });

  describe('lowerHand', () => {
    it('removes a hand from the list', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
        result.current.raiseHand('user-2', 'Bob');
      });

      await act(async () => {
        result.current.lowerHand('user-1');
      });

      expect(result.current.raisedHands).toHaveLength(1);
      expect(result.current.raisedHands[0].participantId).toBe('user-2');
    });

    it('broadcasts HAND_LOWERED data', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
      });

      mockPublishData.mockClear();

      await act(async () => {
        result.current.lowerHand('user-1');
      });

      const callArg = mockPublishData.mock.calls[0][0];
      const decoded = JSON.parse(new TextDecoder().decode(callArg));
      expect(decoded).toMatchObject({
        type: 'HAND_LOWERED',
        participantId: 'user-1',
      });
    });

    it('does nothing if the hand was not raised', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.lowerHand('nonexistent');
      });

      expect(result.current.raisedHands).toEqual([]);
    });
  });

  describe('clearAllHands', () => {
    it('clears all raised hands', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.raiseHand('user-1', 'Alice');
        result.current.raiseHand('user-2', 'Bob');
        result.current.raiseHand('user-3', 'Carol');
      });

      await act(async () => {
        result.current.clearAllHands();
      });

      expect(result.current.raisedHands).toEqual([]);
    });

    it('broadcasts CLEAR_ALL_HANDS data', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.clearAllHands();
      });

      const callArg = mockPublishData.mock.calls[0][0];
      const decoded = JSON.parse(new TextDecoder().decode(callArg));
      expect(decoded).toEqual({ type: 'CLEAR_ALL_HANDS' });
    });

    it('is a no-op when list is already empty', async () => {
      const { result } = renderHook(() => useRaisedHands());

      await act(async () => {
        result.current.clearAllHands();
      });

      expect(result.current.raisedHands).toEqual([]);
    });
  });

  describe('receiving data events', () => {
    it('adds hand on HAND_RAISED event from remote', () => {
      const { result } = renderHook(() => useRaisedHands());

      const handler = mockOn.mock.calls[0][1];

      act(() => {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'HAND_RAISED',
          participantId: 'remote-1',
          participantName: 'Charlie',
          timestamp: 1234567890,
        }));
        handler(payload, undefined, undefined, 'raise-hand');
      });

      expect(result.current.raisedHands).toHaveLength(1);
      expect(result.current.raisedHands[0]).toMatchObject({
        participantId: 'remote-1',
        participantName: 'Charlie',
      });
    });

    it('removes hand on HAND_LOWERED event from remote', () => {
      const { result } = renderHook(() => useRaisedHands());
      const handler = mockOn.mock.calls[0][1];

      act(() => {
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'HAND_RAISED', participantId: 'r1', participantName: 'X', timestamp: 1 })),
          undefined, undefined, 'raise-hand'
        );
      });

      act(() => {
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'HAND_LOWERED', participantId: 'r1' })),
          undefined, undefined, 'raise-hand'
        );
      });

      expect(result.current.raisedHands).toEqual([]);
    });

    it('clears all on CLEAR_ALL_HANDS event from remote', () => {
      const { result } = renderHook(() => useRaisedHands());
      const handler = mockOn.mock.calls[0][1];

      act(() => {
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'HAND_RAISED', participantId: 'r1', participantName: 'A', timestamp: 1 })),
          undefined, undefined, 'raise-hand'
        );
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'HAND_RAISED', participantId: 'r2', participantName: 'B', timestamp: 2 })),
          undefined, undefined, 'raise-hand'
        );
      });

      act(() => {
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'CLEAR_ALL_HANDS' })),
          undefined, undefined, 'raise-hand'
        );
      });

      expect(result.current.raisedHands).toEqual([]);
    });

    it('ignores events with non-matching topic', () => {
      const { result } = renderHook(() => useRaisedHands());
      const handler = mockOn.mock.calls[0][1];

      act(() => {
        handler(
          new TextEncoder().encode(JSON.stringify({ type: 'HAND_RAISED', participantId: 'r1', participantName: 'A', timestamp: 1 })),
          undefined, undefined, 'different-topic'
        );
      });

      expect(result.current.raisedHands).toEqual([]);
    });

    it('ignores malformed JSON data gracefully', () => {
      const { result } = renderHook(() => useRaisedHands());
      const handler = mockOn.mock.calls[0][1];

      expect(() => {
        act(() => {
          handler(
            new TextEncoder().encode('not-valid-json'),
            undefined, undefined, 'raise-hand'
          );
        });
      }).not.toThrow();

      expect(result.current.raisedHands).toEqual([]);
    });
  });
});
