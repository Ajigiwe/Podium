export const DEFAULT_SESSION_FEE = 600;

export interface FeeSettings {
    perClassFee?: number;
    defaultSessionFee?: number;
}

export interface FeeSession {
    price?: number;
    isFree?: boolean;
}

/** Resolve the wallet charge in pesewas. */
export function resolveSessionFee(
    session: FeeSession,
    subscriptionSettings?: FeeSettings,
    walletSettings?: FeeSettings,
): { amount: number; isFree: boolean } {
    if (session.isFree === true) return { amount: 0, isFree: true };

    const candidates = [
        session.price,
        subscriptionSettings?.perClassFee,
        walletSettings?.defaultSessionFee,
        DEFAULT_SESSION_FEE,
    ];
    const amount = candidates.find(value => typeof value === 'number' && Number.isFinite(value) && value > 0) || DEFAULT_SESSION_FEE;
    return { amount, isFree: false };
}
