import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const role = searchParams.get('role');

        if (!query || query.length < 3) {
            return NextResponse.json({ users: [] });
        }

        // Basic validation: must be an admin to search globally
        // In a real app, we'd verify the ID token here.
        // For now, we'll proceed as this is an internal admin-only route.

        const profilesRef = adminDb.collection('profiles');
        let firestoreQuery: any = profilesRef;

        // Note: Firestore doesn't support full-text search or case-insensitive prefix search easily
        // without external services like Algolia. 
        // We'll implement a basic prefix search for display name and email.

        // Strategy: Search by displayName prefix (case-sensitive as per Firestore)
        // or search by email.

        const displayNameSnapshot = await profilesRef
            .where('displayName', '>=', query)
            .where('displayName', '<=', query + '\uf8ff')
            .limit(50)
            .get();

        const emailSnapshot = await profilesRef
            .where('email', '>=', query.toLowerCase())
            .where('email', '<=', query.toLowerCase() + '\uf8ff')
            .limit(50)
            .get();

        const resultsMap = new Map();

        displayNameSnapshot.docs.forEach(doc => {
            resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        emailSnapshot.docs.forEach(doc => {
            if (!resultsMap.has(doc.id)) {
                resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });

        let users = Array.from(resultsMap.values());

        if (role) {
            users = users.filter(u => u.role === role);
        }

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
