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
      const amt=Number(t.amount)||0;
      if(t.type==='top_up'||t.type==='wallet_topup') correct+=amt;
      else if(t.type==='refund') correct+=amt;
      else if(t.type==='session_payment') correct-=amt;
      else if(!t.type && t.sessionId==='wallet_topup' && amt>0) correct+=amt;
    });
    if(correct<0) correct=0;
    const profRef=adminDb.collection('profiles').doc(uid);
    const prof=await profRef.get();
    const current=prof.data()?.walletBalance||0;
    if(current!==correct){
      const fields={walletBalance:correct, walletCurrency:'GHS', walletUpdatedAt: Timestamp.now(), updatedAt: Timestamp.now()};
      if(prof.exists){
        await profRef.update(fields);
      }else{
        // Account has no profile doc (e.g. legacy static-site signups); create it so balances can display
        await profRef.set({id:uid, role:'student', ...fields, createdAt: Timestamp.now()});
      }
    }
    return NextResponse.json({success:true, previous:current, newBalance:correct, count:snap.size});
  }catch(e:any){ console.error(e); return NextResponse.json({error:e.message},{status:500}); }
}
export async function GET(req: NextRequest){
  // allow verify-style reconcile via reference, but POST is primary
  return POST(req);
}
