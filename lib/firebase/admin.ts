import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';

let adminApp: App;

// Initialize Firebase Admin SDK (server-side only)
if (!getApps().length) {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        adminApp = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            databaseURL: `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
        });
    } else {
        console.warn('Firebase Admin SDK not initialized: Missing environment variables');
        adminApp = {} as App;
    }
} else {
    adminApp = getApps()[0];
}

const adminAuth = adminApp.name ? getAuth(adminApp) : {} as ReturnType<typeof getAuth>;
const adminDb = adminApp.name ? getFirestore(adminApp) : {} as ReturnType<typeof getFirestore>;

async function getBearerToken(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split('Bearer ')[1];
}

async function verifyIdToken(token: string) {
    if (!adminApp.name) throw new Error('Firebase Admin not initialized');
    return getAuth(adminApp).verifyIdToken(token);
}

async function getAuthenticatedUser(request: NextRequest) {
    const token = await getBearerToken(request);
    if (!token) return null;
    try {
        return await verifyIdToken(token);
    } catch {
        return null;
    }
}

async function isAuthenticatedAdmin(request: NextRequest): Promise<boolean> {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded) return false;
    if (!decoded.uid) return false;
    try {
        const profileDoc = await (adminDb as ReturnType<typeof getFirestore>).collection('profiles').doc(decoded.uid).get();
        return profileDoc.exists && profileDoc.data()?.role === 'admin';
    } catch {
        return false;
    }
}

export { adminApp, adminAuth, adminDb, getBearerToken, verifyIdToken, getAuthenticatedUser, isAuthenticatedAdmin };
