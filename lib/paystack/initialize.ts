import paystackConfig from './config';

interface InitializeTransactionParams {
    email: string;
    amount: number; // Amount in pesewas (GH₵20 = 2000)
    userId: string;
    sessionId: string;
    sessionTitle: string;
    callbackUrl?: string;
    customMetadata?: Record<string, any>;
}

interface PaystackResponse {
    status: boolean;
    message: string;
    data: {
        authorization_url: string;
        access_code: string;
        reference: string;
    };
}

/**
 * Initialize a Paystack transaction for mobile money payment
 */
export async function initializeTransaction(
    params: InitializeTransactionParams
): Promise<PaystackResponse> {
    const { email, amount, userId, sessionId, sessionTitle, callbackUrl } = params;

    // Wallet top-ups allow card + mobile_money, session payments mobile_money only
    const channels = params.customMetadata?.type === 'top_up' ? ['mobile_money', 'card'] : ['mobile_money'];
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${paystackConfig.secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            amount, // Amount in pesewas
            currency: 'GHS',
            channels,
            metadata: {
                userId,
                sessionId,
                sessionTitle,
                ...params.customMetadata,
            },
            callback_url: callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/classroom/${sessionId}?payment=success`,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize payment');
    }

    return response.json();
}

/**
 * Verify a Paystack transaction
 */
export async function verifyTransaction(reference: string): Promise<any> {
    const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${paystackConfig.secretKey}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify payment');
    }

    return response.json();
}
