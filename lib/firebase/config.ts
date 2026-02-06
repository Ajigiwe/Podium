import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator, waitForPendingWrites, enableNetwork, disableNetwork, terminate } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
};

// Initialize Firebase (client-side)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let rtdb: Database;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
    // Only initialize on client side
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }

    auth = getAuth(app);

    // Initialize Firestore with persistence
    // We try to initialize with persistence, but fallback to getFirestore if it fails or already initialized
    try {
        // Use require or direct import if possible, but keeping it simple for now
        // Since we are in an ES module environment (Next.js), we can rely on the top-level imports
        // created by the bundler.
        // However, initializeFirestore helps setting cache.

        // Note: We are removing the dynamic import complexity which was causing race conditions
        // and just using the standard initialization.
        db = getFirestore(app);
    } catch (e) {
        console.warn('Firestore initialization error:', e);
        // Fallback
        db = getFirestore(app);
    }

    rtdb = getDatabase(app);
    storage = getStorage(app);
}

export { app, auth, db, rtdb, storage };

// Export Firestore utility functions
export * from './firestore-utils';
