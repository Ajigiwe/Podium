'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/config';
import { Wallet, ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';

interface Tx {
    id: string;
    type?: string;
    amount: number;
    currency: string;
    status: string;
    paymentChannel: string;
    sessionId: string;
    createdAt: string | null;
    paystackReference: string;
    relatedTransactionId?: string;
}

export default function WalletPage() {
    const { profile } = useAuth();
    const [txs, setTxs] = useState<Tx[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth.currentUser) { setLoading(false); return; }
        auth.currentUser.getIdToken().then(token => {
            fetch('/api/wallet/history', { headers: { Authorization: `Bearer ${token}` }})
                .then(r=>r.json()).then(d=>{ if(d.success) setTxs(d.data||[]); }).finally(()=> setLoading(false));
        });
    }, [profile?.walletBalance]);

    const bal = (profile?.walletBalance ?? 0)/100;

    return (
        <div className="max-w-5xl mx-auto p-8 space-y-6">
            <div className="bg-white border border-[#DDE0F0] rounded-lg p-6 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-[#E8EEFF] rounded-lg flex items-center justify-center text-[#1845D4]"><Wallet className="w-5 h-5"/></div><div><div className="text-[11px] font-bold text-[#8888A8] uppercase tracking-widest">Wallet Balance</div><div className="text-2xl font-black tracking-tight">GHS {bal.toFixed(2)}</div></div></div>
                <div className="text-[11px] text-[#8888A8]">GHS only</div>
            </div>
            <div className="bg-white border border-[#DDE0F0] rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-[#DDE0F0] font-bold text-[13px]">Transaction History (Credits & Debits)</div>
                {loading ? <div className="p-8 text-center text-sm">Loading...</div> : txs.length===0 ? <div className="p-8 text-center text-[11px] text-[#8888A8] uppercase tracking-widest">No transactions yet</div> : (
                    <div className="divide-y divide-[#DDE0F0]">
                        {txs.map(t=>{
                            const isCredit = t.type==='top_up' || t.type==='refund';
                            const isDebit = t.type==='session_payment' || (!t.type && t.amount>0);
                            return (
                                <div key={t.id} className="px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCredit? 'bg-emerald-50 text-emerald-600' : isDebit ? 'bg-red-50 text-red-600' : 'bg-[#F5F6FA] text-[#8888A8]'}`}>
                                            {t.type==='refund' ? <RotateCcw className="w-4 h-4"/> : isCredit ? <ArrowDownLeft className="w-4 h-4"/> : <ArrowUpRight className="w-4 h-4"/>}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-[#0D0D1A]">{t.type==='top_up' ? 'Top-up' : t.type==='refund' ? 'Refund' : t.type==='session_payment' ? `Class payment` : 'Transaction'} <span className="text-[11px] text-[#8888A8]">{t.sessionId !== 'wallet_topup' ? `· ${t.sessionId.slice(0,8)}` : ''}</span></div>
                                            <div className="text-[11px] text-[#8888A8]">{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''} · {t.paymentChannel} · {t.paystackReference.slice(0,12)}</div>
                                        </div>
                                    </div>
                                    <div className={`text-[13px] font-black ${isCredit ? 'text-emerald-600' : 'text-[#0D0D1A]'}`}>{isCredit ? '+' : '-'}GHS {(t.amount/100).toFixed(2)} <span className="text-[10px] font-bold uppercase tracking-widest text-[#8888A8]">{t.status}</span></div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
