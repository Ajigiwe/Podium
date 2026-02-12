'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import AlertModal from '@/components/AlertModal';

interface AlertOptions {
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface AlertContextType {
    showAlert: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => Promise<void>;
    showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
    // Advanced usage
    customAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<AlertOptions>({
        message: '',
        type: 'info',
    });
    const [showCancel, setShowCancel] = useState(false);

    const closeAlert = useCallback(() => {
        setIsOpen(false);
    }, []);

    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        return new Promise<void>((resolve) => {
            setConfig({
                message,
                type,
                title: type.charAt(0).toUpperCase() + type.slice(1),
                onConfirm: () => {
                    resolve();
                }
            });
            setShowCancel(false);
            setIsOpen(true);
        });
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void, title: string = 'Confirm Action') => {
        setConfig({
            message,
            title,
            type: 'warning',
            onConfirm,
            confirmText: 'Confirm',
            cancelText: 'Cancel'
        });
        setShowCancel(true);
        setIsOpen(true);
    }, []);

    const customAlert = useCallback((options: AlertOptions) => {
        setConfig(options);
        setShowCancel(!!options.cancelText || !!options.onCancel);
        setIsOpen(true);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm, customAlert }}>
            {children}
            <AlertModal
                isOpen={isOpen}
                onClose={closeAlert}
                title={config.title || 'Notification'}
                message={config.message}
                type={config.type}
                onConfirm={config.onConfirm}
                onCancel={config.onCancel}
                showCancel={showCancel}
                confirmText={config.confirmText}
                cancelText={config.cancelText}
            />
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}
