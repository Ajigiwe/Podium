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
            from: 'Lite-LMS <onboarding@resend.dev>', // Change this when you verify your domain
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
            console.error('Error sending email:', error);
            throw error;
        }

        console.log('Payment confirmation email sent:', data);
        return data;
    } catch (error) {
        console.error('Failed to send payment confirmation email:', error);
        throw error;
    }
}
