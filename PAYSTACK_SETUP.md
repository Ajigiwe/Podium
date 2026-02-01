# Paystack Setup Guide for Ghana Mobile Money

This guide will help you set up Paystack for accepting mobile money payments (MTN Mobile Money and Vodafone Cash) in Ghana.

## Prerequisites

- Business registered in Ghana
- Valid Ghana phone number
- Bank account in Ghana

## Step 1: Create Paystack Account

1. Go to [Paystack](https://paystack.com/)
2. Click **Sign Up**
3. Fill in your details:
   - Business name
   - Email address
   - Phone number
   - Password
4. Verify your email address

## Step 2: Complete Business Verification

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com/)
2. Go to **Settings** → **Business Information**
3. Provide:
   - Business registration documents
   - Director/Owner ID
   - Bank account details
4. Wait for verification (usually 1-3 business days)

## Step 3: Get API Keys

### Test Keys (for development)

1. Go to **Settings** → **API Keys & Webhooks**
2. Copy your **Test Public Key** (starts with `pk_test_`)
3. Copy your **Test Secret Key** (starts with `sk_test_`)

### Live Keys (for production)

1. After business verification is complete
2. Go to **Settings** → **API Keys & Webhooks**
3. Toggle to **Live mode**
4. Copy your **Live Public Key** (starts with `pk_live_`)
5. Copy your **Live Secret Key** (starts with `sk_live_`)

## Step 4: Configure Webhook URL

Webhooks are **CRITICAL** for payment verification.

1. Go to **Settings** → **API Keys & Webhooks**
2. Scroll to **Webhook URL** section
3. Add your webhook endpoint:
   - **Development**: `https://your-ngrok-url.ngrok.io/api/paystack/webhook`
   - **Production**: `https://your-domain.com/api/paystack/webhook`
4. Click **Save**

### Testing Webhooks Locally

### Testing Webhooks Locally (Free Alternatives)

Since we need a public URL for Paystack to talk to your laptop, use **Localtunnel** (it's free and requires no account).

**Option 1: Using Localtunnel (Recommended)**

run this in your terminal:
```bash
npx localtunnel --port 3000
```
It will give you a URL like `https://warm-river-42.loca.lt`.
**Important**: When you first visit this URL, it might ask for a password. The password is your IP address (it usually tells you where to find it).

**Option 2: Serveo (No installation required)**
If localtunnel fails, try this using the built-in SSH client:
```bash
ssh -R 80:localhost:3000 serveo.net
```
It will give you a URL like `https://acme.serveo.net`.

**Option 3: Cloudflare Tunnel (Advanced)**
If you prefer a more robust secure tunnel, you can use Cloudflare Tunnel `cloudflared`.

**Add the URL to Paystack**:
Copy the generated URL and update your Paystack Webhook URL:
`https://your-generated-url.loca.lt/api/paystack/webhook`

## Step 5: Enable Mobile Money

1. Go to **Settings** → **Payment Methods**
2. Ensure **Mobile Money** is enabled
3. Supported networks:
   - MTN Mobile Money
   - Vodafone Cash
   - AirtelTigo (via Telecel)

## Step 6: Configure Environment Variables

Add to your `.env.local` file:

```bash
# Paystack Test Keys (for development)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# For production, use live keys:
# NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
# PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
```

## Step 7: Test Mobile Money Payment

### Using Test Mode

Paystack provides test mobile money numbers:

1. **MTN Mobile Money Test Number**: `0241234567`
2. **Vodafone Cash Test Number**: `0501234567`

**Test Flow:**
1. Create a test session in your app
2. Click "Pay & Join"
3. Select mobile money
4. Enter test mobile number
5. You'll receive a simulated push notification
6. Payment will auto-complete in test mode

### Test Cards (for card payments)

If you want to test card payments:
- **Card Number**: `5060 6666 6666 6666 6666`
- **CVV**: `123`
- **Expiry**: Any future date
- **PIN**: `1234`
- **OTP**: `123456`

## Step 8: Verify Webhook Signature

Your webhook handler (`/api/paystack/webhook/route.ts`) already includes signature verification:

```typescript
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
  .update(body)
  .digest('hex');

if (hash !== signature) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
}
```

**Never skip signature verification in production!**

## Step 9: Monitor Transactions

1. Go to **Transactions** in Paystack Dashboard
2. View all successful/failed payments
3. Filter by:
   - Date range
   - Payment channel (mobile money, card)
   - Status (success, failed, pending)

## Step 10: Settlement Configuration

1. Go to **Settings** → **Settlement**
2. Configure:
   - Settlement bank account
   - Settlement schedule (T+1 for Ghana)
   - Minimum settlement amount

**Default**: Funds settle to your bank account the next business day (T+1).

## Transaction Fees

**Paystack Ghana Fees:**
- **Mobile Money**: 1.95% per transaction
- **Card Payments**: 1.95% per transaction
- **No setup fees**
- **No monthly fees**

**Example:**
- Student pays GH₵20
- Paystack fee: GH₵0.39 (1.95%)
- You receive: GH₵19.61

## Testing Checklist

- [ ] Test keys configured in `.env.local`
- [ ] Webhook URL configured in Paystack dashboard
- [ ] ngrok running for local webhook testing
- [ ] Test mobile money payment with test number
- [ ] Verify webhook receives `charge.success` event
- [ ] Check transaction created in Firestore
- [ ] Verify student can access classroom after payment

## Production Checklist

- [ ] Business verification complete
- [ ] Live API keys configured
- [ ] Production webhook URL configured
- [ ] SSL certificate active (HTTPS required)
- [ ] Test live payment with real mobile money
- [ ] Monitor transactions in dashboard
- [ ] Settlement account configured

## Troubleshooting

### Webhook not receiving events
**Solution**:
1. Check webhook URL is correct
2. Ensure endpoint is publicly accessible
3. Check Paystack dashboard logs for delivery attempts
4. Verify signature validation is not rejecting valid requests

### Payment fails immediately
**Solution**:
1. Check API keys are correct
2. Verify mobile money is enabled in Paystack settings
3. Check student has sufficient balance
4. Ensure network connectivity

### "Invalid signature" error
**Solution**:
1. Verify you're using the correct secret key
2. Ensure raw body is used for signature verification
3. Check no middleware is modifying the request body

## Support

- **Paystack Support**: support@paystack.com
- **Documentation**: https://paystack.com/docs
- **API Reference**: https://paystack.com/docs/api

---

**Next Steps**: Test the complete payment flow from student dashboard to classroom access.
