import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getAuthenticatedUser } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
    try {
        const decoded = await getAuthenticatedUser(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (!profileDoc.exists || profileDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const role = searchParams.get('role');

        if (!query || query.length < 3) {
            return NextResponse.json({ users: [] });
        }

        const profilesRef = adminDb.collection('profiles');

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
