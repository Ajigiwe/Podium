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
    sendPasswordResetEmail,
    sendEmailVerification,
} from 'firebase/auth';
import { auth, db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Profile } from '@/lib/firebase/types';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, role: 'student' | 'lecturer' | 'admin') => Promise<void>;
    signInWithGoogle: (role?: 'student' | 'lecturer' | 'admin') => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                // Fetch user profile
                try {
                    const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                    if (profileDoc.exists()) {
                        const data = profileDoc.data() as Profile;
                        // Auto-promote admin (fix for existing users)
                        if (user.email === 'minatoflash82@gmail.com' && data.role !== 'admin') {
                            console.log('Auto-promoting user to admin:', user.email);
                            await updateDoc(doc(db, 'profiles', user.uid), { role: 'admin' });
                            data.role = 'admin';
                        }
                        setProfile(data);
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    // Attempt to handle Firestore error and retry
                    const handled = await handleFirestoreError(db, error);
                    if (handled) {
                        // Retry once more after handling the error
                        try {
                            const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                            if (profileDoc.exists()) {
                                setProfile(profileDoc.data() as Profile);
                            }
                        } catch (retryError) {
                            console.error('Retry failed to fetch profile:', retryError);
                        }
                    }
                }
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

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
        fullName: string,
        role: 'student' | 'lecturer' | 'admin'
    ) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        try {
            await setDoc(doc(db, 'profiles', user.uid), {
                id: user.uid,
                email: user.email,
                fullName,
                role: email === 'minatoflash82@gmail.com' ? 'admin' : role,
                createdAt: new Date(),
            });
        } catch (error) {
            console.error('Error creating profile:', error);
            const handled = await handleFirestoreError(db, error);
            if (handled) {
                // Retry once more after handling the error
                try {
                    await setDoc(doc(db, 'profiles', user.uid), {
                        id: user.uid,
                        email: user.email,
                        fullName,
                        role: email === 'minatoflash82@gmail.com' ? 'admin' : role,
                        createdAt: new Date(),
                    });
                } catch (retryError) {
                    console.error('Retry failed to create profile:', retryError);
                    throw retryError; // Re-throw to prevent user from continuing
                }
            } else {
                throw error; // Re-throw original error
            }
        }

        // Send email verification
        await sendEmailVerification(user);
        await firebaseSignOut(auth); // Sign out immediately so they have to login (and check verification)
    };

    const signInWithGoogle = async (role: 'student' | 'lecturer' | 'admin' = 'student') => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if profile exists, if not create one
            try {
                const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                if (!profileDoc.exists()) {
                    await setDoc(doc(db, 'profiles', user.uid), {
                        id: user.uid,
                        email: user.email,
                        fullName: user.displayName || 'User',
                        role: user.email === 'minatoflash82@gmail.com' ? 'admin' : role,
                        createdAt: new Date(),
                    });
                }
            } catch (error) {
                console.error('Error checking/creating profile for Google sign-in:', error);
                const handled = await handleFirestoreError(db, error);
                if (handled) {
                    // Retry once more after handling the error
                    try {
                        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                        if (!profileDoc.exists()) {
                            await setDoc(doc(db, 'profiles', user.uid), {
                                id: user.uid,
                                email: user.email,
                                fullName: user.displayName || 'User',
                                role: user.email === 'minatoflash82@gmail.com' ? 'admin' : role,
                                createdAt: new Date(),
                            });
                        }
                    } catch (retryError) {
                        console.error('Retry failed for Google sign-in profile:', retryError);
                    }
                }
            }
        } catch (error) {
            console.error('Google Sign In Error:', error);
            throw error;
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const resendVerification = async () => {
        if (auth.currentUser) {
            await sendEmailVerification(auth.currentUser);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
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
