import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack/initialize';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function handleVerify(reference: string) {
    if (!reference) {
        return NextResponse.json(
            { error: 'Transaction reference is required' },
            { status: 400 }
        );
    }

    try {
        const response = await verifyTransaction(reference);

        if (!response.status || response.data.status !== 'success') {
            return NextResponse.json(
                { error: 'Transaction verification failed or payment not successful' },
                { status: 400 }
            );
        }

        const { amount, metadata, channel } = response.data;

        const existingTxDocs = await adminDb
            .collection('transactions')
            .where('paystackReference', '==', reference)
            .get();

        if (!existingTxDocs.empty) {
            const existing = existingTxDocs.docs[0].data() as any;
            const isTopUpExisting = existing.type === 'top_up' || response.data.metadata?.type === 'top_up';
            if (isTopUpExisting) {
                const uid = existing.userId || response.data.metadata?.userId;
                if (uid) {
                    try {
                        if (!existing.type) {
                            await existingTxDocs.docs[0].ref.update({ type: 'top_up' });
                            existing.type = 'top_up';
                        }
                        const ledgerSnap = await adminDb.collection('transactions').where('userId','==',uid).where('status','==','succeeded').get();
                        let correct = 0;
                        ledgerSnap.forEach(d=>{
                            const t:any=d.data();
                            if(t.type==='top_up') correct+=t.amount;
                            else if(t.type==='refund') correct+=t.amount;
                            else if(t.type==='session_payment') correct-=t.amount;
                            else if(!t.type && t.sessionId==='wallet_topup' && t.amount>0) correct+=t.amount;
                        });
                        if (correct < 0) correct = 0;
                        const profSnap = await adminDb.collection('profiles').doc(uid).get();
                        const currentBal = profSnap.data()?.walletBalance || 0;
                        if (currentBal !== correct) {
                            await adminDb.collection('profiles').doc(uid).update({
                                walletBalance: correct,
                                walletCurrency:'GHS',
                                walletUpdatedAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                            });
                            return NextResponse.json({
                                success: true,
                                message: 'Transaction already recorded - wallet reconciled',
                                data: existing,
                                newBalance: correct,
                                reconciled: true
                            });
                        }
                    } catch (e) { console.error('reconcile existing failed', e); }
                }
            }
            return NextResponse.json({
                success: true,
                message: 'Transaction already recorded',
                data: existingTxDocs.docs[0].data()
            });
        }

        const isTopUp = metadata?.type === 'top_up';
        const transactionData: any = {
            userId: metadata.userId || 'unknown',
            sessionId: metadata.sessionId || 'unknown',
            paystackReference: reference,
            amount: amount,
            currency: 'GHS',
            paymentChannel: channel,
            status: 'succeeded',
            type: isTopUp ? 'top_up' : (metadata?.type || 'session_payment'),
            createdAt: Timestamp.now(),
            paidAt: Timestamp.now(),
            verifiedVia: 'api_fallback'
        };

        if (isTopUp) {
            const userId = metadata.userId;
            if (!userId || userId === 'unknown') {
                return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
            }
            const already = await adminDb.collection('transactions').where('paystackReference', '==', reference).get();
            if (!already.empty) {
                return NextResponse.json({
                    success: true,
                    message: 'Transaction already recorded',
                    data: already.docs[0].data()
                });
            }
            const profileRef = adminDb.collection('profiles').doc(userId);
            await adminDb.runTransaction(async (tx) => {
                const profileSnap = await tx.get(profileRef);
                if (!profileSnap.exists) throw new Error('Profile not found');
                const current = profileSnap.data()?.walletBalance || 0;
                tx.update(profileRef, {
                    walletBalance: current + amount,
                    walletCurrency: 'GHS',
                    walletUpdatedAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
            });
            await adminDb.collection('transactions').add(transactionData);
            const updated = await adminDb.collection('profiles').doc(userId).get();
            return NextResponse.json({
                success: true,
                message: 'Top-up verified and wallet credited',
                data: transactionData,
                newBalance: updated.data()?.walletBalance || 0
            });
        } else {
            await adminDb.collection('transactions').add(transactionData);
        }

        return NextResponse.json({
            success: true,
            message: 'Transaction verified and recorded',
            data: transactionData
        });

    } catch (error: any) {
        console.error('Payment verification error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to verify payment' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('trRef');
    return handleVerify(reference || '');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        return handleVerify(body.reference || '');
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
