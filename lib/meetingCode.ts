/**
 * Meeting Code Utilities
 * Generates Google Meet-style codes from session IDs
 * Format: pod-xxxx-xxxx (e.g., pod-ab3k-9xmz)
 */

// Character set for codes (avoiding confusing characters like 0/O, 1/l)
const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a meeting code from a session ID
 * The code is deterministic - same session ID always produces same code
 */
export function generateMeetingCode(sessionId: string): string {
    // Create a simple hash from the session ID
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
        const char = sessionId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Make hash positive
    hash = Math.abs(hash);
    
    // Generate 8 characters from hash + sessionId chars
    let code = '';
    for (let i = 0; i < 8; i++) {
        const index = (hash + sessionId.charCodeAt(i % sessionId.length)) % CHARS.length;
        code += CHARS[index];
        hash = Math.floor(hash / CHARS.length) + sessionId.charCodeAt((i + 1) % sessionId.length);
    }
    
    // Format as pod-xxxx-xxxx
    return `pod-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/**
 * Extract the code part without prefix for comparison
 */
export function normalizeCode(input: string): string {
    // Remove spaces, dashes, and convert to lowercase
    return input.toLowerCase().replace(/[\s-]/g, '').replace(/^pod/, '');
}

/**
 * Check if a string looks like a meeting code
 */
export function isMeetingCode(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    // Matches: pod-xxxx-xxxx, podxxxxxxxx, xxxx-xxxx, xxxxxxxx
    return /^(pod-?)?[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(normalized);
}

/**
 * Format a code nicely for display
 */
export function formatMeetingCode(code: string): string {
    const normalized = normalizeCode(code);
    if (normalized.length === 8) {
        return `pod-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
    }
    return code;
}
