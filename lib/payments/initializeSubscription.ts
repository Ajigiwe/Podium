import { auth } from '../firebase/config';

/**
 * Initialize a Paystack Subscription payment
 * Calls the subscription-specific API endpoint
 */
export async function initializeSubscription(
    userId: string,
    email: string
): Promise<string | null> {
    if (!auth.currentUser) {
        console.error('User not authenticated');
        return null;
    }

    try {
        const token = await auth.currentUser.getIdToken();

        const response = await fetch('/api/paystack/initialize-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                callbackUrl: `${window.location.origin}/dashboard?subscription=success`
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to initialize subscription');
        }

        const data = await response.json();
        return data.authorizationUrl;
    } catch (error) {
        console.error('Error initializing subscription:', error);
        return null;
    }
}
