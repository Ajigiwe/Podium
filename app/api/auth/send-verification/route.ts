import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { sendVerificationEmail } from '@/lib/email/send';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
        };

        const link = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);

        const { data, error: sendError } = await sendVerificationEmail(email, link);

        if (sendError) {
            console.error('[API:SendVerification] Resend Error:', sendError);
            return NextResponse.json({ error: sendError.message || 'Verification email failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in send-verification route:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send verification email' },
            { status: 500 }
        );
    }
}
