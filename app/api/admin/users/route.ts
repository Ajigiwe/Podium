import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function PATCH(req: NextRequest) {
    try {
        const { userId, role, disabled, isVerified } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const updates: { disabled?: boolean } = {};
        const firestoreUpdates: Record<string, any> = { updatedAt: new Date() };

        if (role) {
            firestoreUpdates.role = role;
        }

        if (isVerified !== undefined) {
            firestoreUpdates.isVerified = isVerified;
        }

        if (disabled !== undefined) {
            updates.disabled = disabled;
            firestoreUpdates.status = disabled ? 'disabled' : 'active';
        }

        // Update Firebase Auth and Firestore Profile in parallel
        const promises: Promise<unknown>[] = [];

        if (Object.keys(updates).length > 0) {
            promises.push(adminAuth.updateUser(userId, updates));
        }

        if (Object.keys(firestoreUpdates).length > 1) { // updatedAt is always there
            const profileRef = adminDb.collection('profiles').doc(userId);
            promises.push(profileRef.update(firestoreUpdates));
        }

        await Promise.all(promises);

        return NextResponse.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error updating user:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Delete from Firebase Auth and Firestore profile in parallel
        await Promise.all([
            adminAuth.deleteUser(userId),
            adminDb.collection('profiles').doc(userId).delete()
        ]);

        // Optional: Could also delete attendance logs, etc. but usually we want to keep some history or soft delete.
        // For this task, we'll fulfill the request of direct management.

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
