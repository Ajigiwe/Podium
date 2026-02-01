import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

// Initialize Firebase Admin SDK (server-side only)
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
        // Fallback for build time or missing credentials
        console.warn('Firebase Admin SDK not initialized: Missing environment variables');
        // We can't really initialize a dummy app easily without errors later, 
        // but we can avoid crashing here. The route using this will need to handle it.
        // For build time static generation, this might be enough if the code path isn't executed.
        // If it IS executed, we need a mock.

        // This is a minimal mock to satisfy the export types during build
        adminApp = {} as App;
    }
} else {
    adminApp = getApps()[0];
}

// Helper to safely get Auth
const adminAuth = adminApp.name ? getAuth(adminApp) : {} as ReturnType<typeof getAuth>;

// Helper to safely get Firestore
const adminDb = adminApp.name ? getFirestore(adminApp) : {} as ReturnType<typeof getFirestore>;

export { adminApp, adminAuth, adminDb };
