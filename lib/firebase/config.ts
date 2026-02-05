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
    // Initialize Firestore with proper settings
    db = getFirestore(app);
    
    // Configure Firestore settings to improve connection reliability
    // Set up cache size and other settings
    if (typeof window !== 'undefined') {
        // Only configure on client side
        try {
            const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED } = await import('firebase/firestore');
            
            // Initialize Firestore with persistent cache settings
            initializeFirestore(app, {
                localCache: persistentLocalCache({
                    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
                    tabManager: persistentMultipleTabManager()
                })
            });
        } catch (error) {
            console.warn('Could not initialize Firestore with persistence:', error);
        }
    }
    
    rtdb = getDatabase(app);
    storage = getStorage(app);
}

export { app, auth, db, rtdb, storage };

// Export Firestore utility functions
export * from './firestore-utils';
