import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { sendPasswordResetEmail } from '@/lib/email/send';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Check if user exists and has a password provider
        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            const hasPasswordProvider = userRecord.providerData.some(
                (provider) => provider.providerId === 'password'
            );

            if (!hasPasswordProvider) {
                return NextResponse.json(
                    { error: 'This account uses social login (Google). Please sign in using your Google account instead.' },
                    { status: 400 }
                );
            }
        } catch (error: any) {
            // If user doesn't exist, we still return success to prevent email enumeration
            if (error.code === 'auth/user-not-found') {
                return NextResponse.json({ success: true });
            }
            throw error;
        }

        const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
        };

        const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

        await sendPasswordResetEmail(email, link);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in reset-password route:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send password reset email' },
            { status: 500 }
        );
    }
}
