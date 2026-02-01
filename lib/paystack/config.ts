const paystackConfig = {
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/paystack/callback`,
};

export default paystackConfig;
