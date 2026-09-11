import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_FEE, resolveSessionFee } from '@/lib/payments/fee';

describe('resolveSessionFee', () => {
    it('honors an explicit free session', () => {
        expect(resolveSessionFee({ isFree: true, price: 10000 })).toEqual({ amount: 0, isFree: true });
    });

    it('uses the session price when it is positive', () => {
        expect(resolveSessionFee({ price: 10000 }, { perClassFee: 6000 }, { defaultSessionFee: 500 })).toEqual({ amount: 10000, isFree: false });
    });

    it('uses the admin per-class fee before the legacy wallet default', () => {
        expect(resolveSessionFee({}, { perClassFee: 10000 }, { defaultSessionFee: 50 })).toEqual({ amount: 10000, isFree: false });
    });

    it('does not turn a missing fee into a free class', () => {
        expect(resolveSessionFee({}, undefined, undefined)).toEqual({ amount: DEFAULT_SESSION_FEE, isFree: false });
    });

    it('ignores zero and invalid configured values', () => {
        expect(resolveSessionFee({ price: 0 }, { perClassFee: 0 }, { defaultSessionFee: -1 })).toEqual({ amount: DEFAULT_SESSION_FEE, isFree: false });
    });
});
