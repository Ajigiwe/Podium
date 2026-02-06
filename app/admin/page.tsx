'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SystemSettings } from '@/lib/firebase/types';
import { Settings, Save, AlertCircle } from 'lucide-react';

export default function AdminPage() {
    const [fee, setFee] = useState<number>(200); // Default 200 GHS
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'system_settings', 'subscription');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setFee(data.semesterFee);
                } else {
                    // Create default if not exists
                    await setDoc(docRef, {
                        id: 'subscription',
                        semesterFee: 200,
                        currency: 'GHS',
                        durationMonths: 4,
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                setMessage({ type: 'error', text: 'Failed to load settings.' });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const docRef = doc(db, 'system_settings', 'subscription');
            await setDoc(docRef, {
                semesterFee: Number(fee),
                updatedAt: serverTimestamp()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Semester fee updated successfully.' });
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">System Settings</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Subscription Configuration</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Set the global fee for student access.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Semester Fee (GHS)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">GH₵</span>
                                <input
                                    type="number"
                                    value={fee}
                                    onChange={(e) => setFee(Number(e.target.value))}
                                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    min="0"
                                    step="1"
                                    required
                                />
                            </div>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Payment grants 4 months of access to all classes.
                            </p>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success'
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                }`}>
                                {message.type === 'success' ? (
                                    <Save className="w-4 h-4" />
                                ) : (
                                    <AlertCircle className="w-4 h-4" />
                                )}
                                {message.text}
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
