import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
export const dynamic='force-dynamic';
export async function POST(req: NextRequest){
  try{
    const authHeader=req.headers.get('authorization');
    if(!authHeader?.startsWith('Bearer ')) return NextResponse.json({error:'Unauthorized'},{status:401});
    const token=authHeader.split('Bearer ')[1];
    const decoded=await adminAuth.verifyIdToken(token);
    const uid=decoded.uid;
    const snap=await adminDb.collection('transactions').where('userId','==',uid).where('status','==','succeeded').get();
    let correct=0;
    snap.forEach(d=>{
      const t:any=d.data();
      if(t.type==='top_up') correct+=t.amount;
      else if(t.type==='refund') correct+=t.amount;
      else if(t.type==='session_payment') correct-=t.amount;
      else if(!t.type && t.sessionId==='wallet_topup' && t.amount>0) correct+=t.amount;
    });
    if(correct<0) correct=0;
    const prof=await adminDb.collection('profiles').doc(uid).get();
    const current=prof.data()?.walletBalance||0;
    if(current!==correct){
      await adminDb.collection('profiles').doc(uid).update({walletBalance:correct, walletCurrency:'GHS', walletUpdatedAt: Timestamp.now(), updatedAt: Timestamp.now()});
    }
    return NextResponse.json({success:true, previous:current, newBalance:correct, count:snap.size});
  }catch(e:any){ console.error(e); return NextResponse.json({error:e.message},{status:500}); }
}
export async function GET(req: NextRequest){
  // allow verify-style reconcile via reference, but POST is primary
  return POST(req);
}
