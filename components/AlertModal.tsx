'use client';

import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
}

export default function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    onConfirm,
    onCancel,
    showCancel = false,
    confirmText = 'OK',
    cancelText = 'Cancel'
}: AlertModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 200); // Wait for animation
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-10 h-10 text-green-500" />;
            case 'error':
                return <AlertOctagon className="w-10 h-10 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-10 h-10 text-amber-500" />;
            default:
                return <Info className="w-10 h-10 text-blue-500" />;
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return 'bg-green-600 hover:bg-green-700';
            case 'error': return 'bg-red-600 hover:bg-red-700';
            case 'warning': return 'bg-amber-600 hover:bg-amber-700';
            default: return 'bg-blue-600 hover:bg-blue-700';
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'
                }`}
            onClick={(e) => {
                if (e.target === e.currentTarget && !showCancel) onClose();
            }}
        >
            <div
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-200 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                    }`}
            >
                <div className="p-6">
                    <div className="flex flex-col items-center text-center">
                        <div className={`mb-4 p-3 rounded-full bg-gray-50 dark:bg-gray-700/50`}>
                            {getIcon()}
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {title}
                        </h3>

                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            {message}
                        </p>

                        <div className="flex gap-3 w-full">
                            {showCancel && (
                                <button
                                    onClick={() => {
                                        if (onCancel) onCancel();
                                        onClose();
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (onConfirm) onConfirm();
                                    onClose();
                                }}
                                className={`flex-1 px-4 py-2.5 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95 ${getColor()}`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
