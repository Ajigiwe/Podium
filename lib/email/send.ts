import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : { emails: { send: async () => ({ error: { message: 'RESEND_API_KEY missing' } }) } as any };

interface PaymentConfirmationEmailProps {
    to: string;
    userName: string;
    sessionTitle: string;
    amount: number;
    currency: string;
    transactionId: string;
    sessionId: string;
}

export async function sendPaymentConfirmation({
    to,
    userName,
    sessionTitle,
    amount,
    currency,
    transactionId,
    sessionId,
}: PaymentConfirmationEmailProps) {
    const classroomUrl = `${process.env.NEXT_PUBLIC_APP_URL}/classroom/${sessionId}`;
    const amountFormatted = (amount / 100).toFixed(2);

    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium Class <noreply@podiumclass.online>',
            to: [to],
            subject: `Payment Confirmed - ${sessionTitle}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">✅ Payment Confirmed!</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">Hi ${userName},</p>
                            
                            <p style="margin: 0 0 30px; font-size: 16px; color: #374151;">
                                Your payment has been successfully processed! You now have full access to the classroom session.
                            </p>
                            
                            <!-- Session Details Card -->
                            <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                                <tr>
                                    <td>
                                        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 600;">Session Details</h2>
                                        <table role="presentation" style="width: 100%;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Class:</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${sessionTitle}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Paid:</td>
                                                <td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: 600; text-align: right;">${currency} ${amountFormatted}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction ID:</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 12px; text-align: right; font-family: monospace;">${transactionId}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                                <tr>
                                    <td align="center">
                                        <a href="${classroomUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Join Classroom Now →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                                You can access this classroom anytime from your student dashboard.
                            </p>
                            
                            <p style="margin: 0; font-size: 14px; color: #6b7280;">
                                If you have any questions, please don't hesitate to contact us.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                                Thank you for choosing Lite-LMS!
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                                This is an automated email. Please do not reply.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `,
        });

        if (error) {
            console.error('Error sending payment confirmation:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Failed to send payment confirmation email:', error);
        throw error;
    }
}


export async function sendVerificationEmail(to: string, link: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium <support@podiumclass.online>',
            to: [to],
            subject: 'Verify your Podium account',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'DM Sans', sans-serif; background-color: #f5f6fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #dde0f0; overflow: hidden; }
        .header { background-color: #1845d4; padding: 40px; text-align: center; }
        .content { padding: 40px; text-align: center; }
        h1 { color: #0d0d1a; font-size: 24px; font-weight: 800; margin-bottom: 16px; }
        p { color: #444460; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
        .button { display: inline-block; background-color: #1845d4; color: #ffffff !important; padding: 16px 40px; border-radius: 8px; font-size: 13px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; }
        .footer { padding: 32px; border-top: 1px solid #f5f6fa; text-align: center; }
        .footer p { font-size: 11px; color: #8888a8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="background-color: white; width: 48px; height: 48px; border-radius: 10px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <img src="https://lite-class.firebaseapp.com/logo.png" alt="P" width="24" height="24">
            </div>
        </div>
        <div class="content">
            <h1>Confirm your identity</h1>
            <p>Welcome to Podium. Please verify your email address to unlock full access to Ghana's premium digital classroom environment.</p>
            <a href="${link}" class="button">Verify Account</a>
        </div>
        <div class="footer">
            <p>Podium Technologies • Absolute Record Reliability</p>
        </div>
    </div>
</body>
</html>
            `,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Failed to send verification email:', error);
        throw error;
    }
}

export async function sendPasswordResetEmail(to: string, link: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium <security@podiumclass.online>',
            to: [to],
            subject: 'Reset your Podium password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'DM Sans', sans-serif; background-color: #f5f6fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #dde0f0; overflow: hidden; }
        .header { background-color: #0d0d1a; padding: 40px; text-align: center; }
        .content { padding: 40px; text-align: center; }
        h1 { color: #0d0d1a; font-size: 24px; font-weight: 800; margin-bottom: 16px; }
        p { color: #444460; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
        .button { display: inline-block; background-color: #1845d4; color: #ffffff !important; padding: 16px 40px; border-radius: 8px; font-size: 13px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; }
        .footer { padding: 32px; border-top: 1px solid #f5f6fa; text-align: center; }
        .footer p { font-size: 11px; color: #8888a8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; }
        .note { font-size: 12px; color: #8888a8; margin-top: 24px; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="background-color: #1845d4; width: 48px; height: 48px; border-radius: 10px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <i style="color: white; font-size: 20px;">🔒</i>
            </div>
        </div>
        <div class="content">
            <h1>Reset your password</h1>
            <p>We received a request to reset your account password. Click the secure link below to choose a new one.</p>
            <a href="${link}" class="button">Reset Password</a>
            <p class="note">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>Podium Security • Protecting your Academic Workbench</p>
        </div>
    </div>
</body>
</html>
            `,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Failed to send password reset email:', error);
        throw error;
    }
}

export async function sendCommunityJoinRequestEmail({ to, ownerName, requesterName, communityName }: { to: string, ownerName: string, requesterName: string, communityName: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium Communities <noreply@podiumclass.online>',
            to: [to],
            subject: `Join Request: ${communityName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #111827;">New Access Request</h2>
                    <p>Hi ${ownerName},</p>
                    <p><strong>${requesterName}</strong> has requested to join your community <strong>${communityName}</strong>.</p>
                    <p>You can approve or reject this request from your Community Dashboard.</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                        <p style="font-size: 12px; color: #9ca3af;">Podium Class Communities</p>
                    </div>
                </div>
            `
        });
        if (error) throw error;
        return data;
    } catch (e) { console.error(e); throw e; }
}

export async function sendCommunityApprovalEmail({ to, userName, communityName }: { to: string, userName: string, communityName: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium Communities <noreply@podiumclass.online>',
            to: [to],
            subject: `Welcome to ${communityName}!`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #1845D4;">Request Approved!</h2>
                    <p>Hi ${userName},</p>
                    <p>Your request to join <strong>${communityName}</strong> has been approved.</p>
                    <p>You can now access announcements and resources in the community workspace.</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/communities" style="display: inline-block; background: #1845D4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">Open Workspace</a>
                </div>
            `
        });
        if (error) throw error;
        return data;
    } catch (e) { console.error(e); throw e; }
}

export async function sendCommunityAnnouncementEmail({ to, communityName, authorName, content }: { to: string, communityName: string, authorName: string, content: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium Communities <noreply@podiumclass.online>',
            to: [to],
            subject: `New Announcement in ${communityName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <p style="font-size: 11px; color: #8888A8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold; margin-bottom: 10px;">New Update from ${authorName}</p>
                    <h2 style="color: #111827; margin-top: 0;">${communityName}</h2>
                    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; white-space: pre-wrap; line-height: 1.6;">${content}</div>
                    <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">Log in to the dashboard to view more details or join the discussion.</p>
                </div>
            `
        });
        if (error) throw error;
        return data;
    } catch (e) { console.error(e); throw e; }
}

export async function sendCommunitySessionStartEmail({ to, communityName, lecturerName, sessionTitle, sessionId }: { to: string, communityName: string, lecturerName: string, sessionTitle: string, sessionId: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium Communities <noreply@podiumclass.online>',
            to: [to],
            subject: `LIVE NOW: ${sessionTitle} (${communityName})`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <div style="display: inline-block; background: #fee2e2; color: #ef4444; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 12px;">Happening Now</div>
                    <h2 style="color: #111827; margin-top: 0;">${sessionTitle}</h2>
                    <p style="color: #6b7280; font-size: 14px;">${lecturerName} has started a live session in <strong>${communityName}</strong>.</p>
                    <div style="margin-top: 30px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/classroom/${sessionId}" style="background: #1845D4; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Join Classroom Now</a>
                    </div>
                    <p style="margin-top: 20px; font-size: 11px; color: #9ca3af; font-weight: bold; text-transform: uppercase;">Podium Class Communities</p>
                </div>
            `
        });
        if (error) throw error;
        return data;
    } catch (e) { console.error(e); throw e; }
}

export async function sendWelcomeEmail(to: string, userName: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Podium <welcome@podiumclass.online>',
            to: [to],
            subject: 'Welcome to Podium!',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'DM Sans', sans-serif; background-color: #f5f6fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #dde0f0; overflow: hidden; }
        .header { background-color: #1845d4; padding: 40px; text-align: center; }
        .content { padding: 40px; text-align: center; }
        h1 { color: #0d0d1a; font-size: 28px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.02em; }
        p { color: #444460; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
        .button { display: inline-block; background-color: #1845d4; color: #ffffff !important; padding: 16px 40px; border-radius: 8px; font-size: 13px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; }
        .footer { padding: 32px; border-top: 1px solid #f5f6fa; text-align: center; }
        .footer p { font-size: 11px; color: #8888a8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="background-color: white; width: 48px; height: 48px; border-radius: 10px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <img src="https://lite-class.firebaseapp.com/logo.png" alt="P" width="24" height="24">
            </div>
        </div>
        <div class="content">
            <h1>Welcome to the Modern Classroom</h1>
            <p>Hi ${userName},<br><br>We're thrilled to have you join Podium. You've just unlocked Ghana's most powerful digital workspace for academic engagement and record reliability.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Go to Dashboard</a>
        </div>
        <div class="footer">
            <p>Podium Class • Education Without Limits</p>
        </div>
    </div>
</body>
</html>
            `
        });
        if (error) throw error;
        return data;
    } catch (e) { console.error(e); throw e; }
}
