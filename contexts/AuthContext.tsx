'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
} from 'firebase/auth';
import { auth, db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Profile } from '@/lib/firebase/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const queryClient = useQueryClient();

    // Profile Query
    const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
        queryKey: ['profile', user?.uid],
        queryFn: async () => {
            if (!user) return null;
            try {
                const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                if (profileDoc.exists()) {
                    return profileDoc.data() as Profile;
                }
                return null;
            } catch (error) {
                console.error('[Auth:Profile] Error fetching profile:', error);
                const handled = await handleFirestoreError(db, error, 1, '[Auth:Profile]');
                if (handled) {
                    // Retry once if error was recoverable
                    const retryDoc = await getDoc(doc(db, 'profiles', user.uid));
                    return retryDoc.data() as Profile;
                }
                throw error;
            }
        },
        enabled: !!user,
    });

    const loading = authLoading || (!!user && profileLoading);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            setAuthLoading(false);
            if (!user) {
                queryClient.setQueryData(['profile', undefined], null);
            }
        });

        return unsubscribe;
    }, [queryClient]);

    const signIn = async (email: string, password: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        if (!userCredential.user.emailVerified) {
            await firebaseSignOut(auth);
            throw new Error('Please verify your email address before logging in.');
        }
    };

    const signUp = async (
        email: string,
        password: string,
        fullName: string
    ) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Force a token refresh to ensure auth state is immediately propagated
        // to the backend rules engine before attempting a write
        await user.getIdToken(true);

        // Create user profile in Firestore with a resilient retry mechanism
        // to handle the short delay between Auth creation and Firestore awareness
        let profileCreated = false;
        let retries = 4;
        let lastError: any = null;

        while (!profileCreated && retries > 0) {
            try {
                await setDoc(doc(db, 'profiles', user.uid), {
                    id: user.uid,
                    email: user.email,
                    fullName,
                    role: 'student',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                profileCreated = true;
            } catch (error: any) {
                lastError = error;
                console.error(`Error creating profile (retries left: ${retries - 1}):`, error);

                // If it's a permission sync delay, simply wait and try again
                if (error.code === 'permission-denied' || error.code === 'unavailable') {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    retries--;
                } else {
                    const handled = await handleFirestoreError(db, error, 1, '[Auth:SignUp]');
                    if (handled) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        retries--;
                    } else {
                        throw error; // Irrecoverable error
                    }
                }
            }
        }

        if (!profileCreated) {
            console.error('Failed to create profile after all retries');
            // We should ideally clean up the Auth user here if profile creation definitively fails
            throw lastError || new Error('Failed to fully create your account. Please try again.');
        }

        // Send email verification via custom API
        await fetch('/api/auth/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        await firebaseSignOut(auth);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Robust Profile Creation / Check
            let profileCreated = false;
            let retries = 3;
            let lastError: any = null;

            while (!profileCreated && retries > 0) {
                try {
                    const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                    if (!profileDoc.exists()) {
                        console.log('[Auth:Google] Creating new profile...');
                        await setDoc(doc(db, 'profiles', user.uid), {
                            id: user.uid,
                            email: user.email,
                            fullName: user.displayName || 'User',
                            role: 'student',
                            createdAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        });
                    }
                    profileCreated = true;
                } catch (error: any) {
                    lastError = error;
                    console.error(`[Auth:Google] Profile error (retries left: ${retries - 1}):`, error);

                    if (error.code === 'permission-denied' || error.code === 'unavailable') {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        retries--;
                    } else {
                        const handled = await handleFirestoreError(db, error, 1, '[Auth:Google]');
                        if (handled) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            retries--;
                        } else {
                            throw error;
                        }
                    }
                }
            }

            if (!profileCreated) {
                throw lastError || new Error('Failed to synchronize your profile. Please try again.');
            }

            queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
        } catch (error) {
            console.error('Google Sign In Error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        queryClient.clear();
    };

    const resetPassword = async (email: string) => {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to send reset email');
        }
    };

    const resendVerification = async () => {
        if (auth.currentUser?.email) {
            await fetch('/api/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: auth.currentUser.email }),
            });
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                profile: profile || null,
                loading,
                signIn,
                signUp,
                signInWithGoogle,
                signOut,
                resetPassword,
                resendVerification,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
