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
            from: 'Podium Class <noreply@podiumclass.online>',
            to: [to],
            subject: 'Verify your email for Podium',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your email</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding: 40px 0; }
        .container { max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { padding: 40px 40px 20px; text-align: center; }
        .logo-box { width: 56px; height: 56px; background-color: #2563eb; border-radius: 14px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
        .content { padding: 0 40px 40px; text-align: center; }
        h1 { color: #111827; font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.025em; }
        p { color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 32px; font-weight: 500; }
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 16px 40px; border-radius: 16px; font-size: 15px; font-weight: 800; text-decoration: none; transition: background-color 0.2s; }
        .footer { padding: 32px 40px; background-color: #fcfcfc; border-top: 1px solid #f3f4f6; text-align: center; }
        .footer p { font-size: 11px; color: #9ca3af; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <div class="logo-box" style="display: inline-block; padding: 12px;">
                    <img src="https://lite-class.firebaseapp.com/logo.png" alt="P" width="32" height="32" style="display: block;">
                </div>
                <h1>Verify your email</h1>
            </div>
            <div class="content">
                <p>Welcome to Podium! Please confirm your email address to start hosting and joining interactive classrooms.</p>
                <a href="${link}" class="button">Verify Email Address</a>
            </div>
            <div class="footer">
                <p>Podium Class • Education Without Limits</p>
            </div>
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
            from: 'Podium Class <noreply@podiumclass.online>',
            to: [to],
            subject: 'Reset your Podium password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding: 40px 0; }
        .container { max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { padding: 40px 40px 20px; text-align: center; }
        .logo-box { width: 56px; height: 56px; background-color: #2563eb; border-radius: 14px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
        .content { padding: 0 40px 40px; text-align: center; }
        h1 { color: #111827; font-size: 24px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.025em; }
        p { color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 32px; font-weight: 500; }
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 16px 40px; border-radius: 16px; font-size: 15px; font-weight: 800; text-decoration: none; transition: background-color 0.2s; }
        .footer { padding: 32px 40px; background-color: #fcfcfc; border-top: 1px solid #f3f4f6; text-align: center; }
        .footer p { font-size: 11px; color: #9ca3af; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .small-note { font-size: 12px; color: #9ca3af; margin-top: 24px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <div class="logo-box" style="display: inline-block; padding: 12px;">
                    <img src="https://lite-class.firebaseapp.com/logo.png" alt="P" width="32" height="32" style="display: block;">
                </div>
                <h1>Reset password</h1>
            </div>
            <div class="content">
                <p>We received a request to reset your password. Click the button below to choose a new one.</p>
                <a href="${link}" class="button">Reset Password</a>
                <p class="small-note">If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>Podium Class • Education Without Limits</p>
            </div>
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
