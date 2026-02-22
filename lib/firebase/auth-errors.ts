/**
 * Utility to map Firebase Auth error codes to friendly user messages
 */

export const getFriendlyAuthErrorMessage = (error: any): string => {
    if (!error) return 'An unexpected error occurred. Please try again.';

    const errorCode = error.code || '';
    const message = error.message || '';

    // Handle common Firebase Auth error codes
    switch (errorCode) {
        case 'auth/user-disabled':
            return 'Your account has been disabled. Please contact the administrator for assistance.';
        case 'auth/user-not-found':
            return 'No account found with this email. Please check the email or register.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try logging in instead.';
        case 'auth/weak-password':
            return 'Your password is too weak. Please use at least 6 characters.';
        case 'auth/operation-not-allowed':
            return 'This login method is currently disabled.';
        case 'auth/too-many-requests':
            return 'Too many failed login attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'A network error occurred. Please check your internet connection.';
        case 'auth/popup-closed-by-user':
            return 'Login was cancelled. Please try again.';
        case 'auth/internal-error':
            return 'An internal error occurred. Please try again later.';
        case 'auth/invalid-credential':
            return 'Invalid login credentials. Please check your email and password.';
    }

    // Fallback for custom messages thrown manually in our code
    if (message.includes('verify your email')) {
        return 'Please verify your email address before logging in.';
    }

    // Log raw error for debugging but return a generic friendly message if unknown
    console.error('Unknown Firebase Auth Error:', error);

    // If we have a readable message that doesn't look like a technical Firebase error, return it
    if (message && !message.startsWith('Firebase:')) {
        return message;
    }

    return 'Failed to sign in. Please check your credentials and try again.';
};
