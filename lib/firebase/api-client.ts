import { auth } from './config';

export async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) {
        console.error('Failed to get auth token:', e);
    }
    return headers;
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = await getAuthHeaders();
    return fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers as Record<string, string> || {}),
        },
    });
}
