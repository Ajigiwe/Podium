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
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Profile } from '@/lib/firebase/types';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, role: 'student' | 'lecturer') => Promise<void>;
    signInWithGoogle: (role?: 'student' | 'lecturer') => Promise<void>;
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
                const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                if (profileDoc.exists()) {
                    setProfile(profileDoc.data() as Profile);
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
        role: 'student' | 'lecturer'
    ) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        // Create user profile in Firestore
        await setDoc(doc(db, 'profiles', user.uid), {
            id: user.uid,
            email: user.email,
            fullName,
            role,
            createdAt: new Date(),
        });

        // Send email verification
        await sendEmailVerification(user);
        await firebaseSignOut(auth); // Sign out immediately so they have to login (and check verification)
    };

    const signInWithGoogle = async (role: 'student' | 'lecturer' = 'student') => {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if profile exists, if not create one
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
        if (!profileDoc.exists()) {
            await setDoc(doc(db, 'profiles', user.uid), {
                id: user.uid,
                email: user.email,
                fullName: user.displayName || 'User',
                role: role,
                createdAt: new Date(),
            });
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
