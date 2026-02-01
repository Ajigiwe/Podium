import { auth } from '../firebase/config';

/**
 * Initialize a Paystack payment transaction
 * Note: checks server for session price and user details for security
 */
export async function initializePayment(
    userId: string,
    sessionId: string,
    amount: number,
    email: string
): Promise<string | null> {
    if (!auth.currentUser) {
        console.error('User not authenticated');
        return null;
    }

    try {
        const token = await auth.currentUser.getIdToken();

        const response = await fetch('/api/paystack/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId,
                callbackUrl: `${window.location.origin}/classroom/${sessionId}?payment=success`
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to initialize payment');
        }

        const data = await response.json();
        return data.authorizationUrl;
    } catch (error) {
        console.error('Error initializing payment:', error);
        return null; // Return null to let the UI handle the error state (it checks only for truthy url)
    }
}
