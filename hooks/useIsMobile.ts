'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_UA = /iPhone|iPad|iPod|Android/i;

// The user agent never changes for the lifetime of the page, so there is nothing to
// subscribe to. useSyncExternalStore is used here purely to read a browser-only value
// in an SSR-safe way: the server snapshot is false and the client re-reads the real
// value after hydration, which avoids both a hydration mismatch and the extra render
// pass caused by assigning this in an effect.
const subscribe = () => () => { };
const getSnapshot = () => MOBILE_UA.test(navigator.userAgent);
const getServerSnapshot = () => false;

/**
 * Returns true when the current user agent looks like a mobile device.
 */
export const useIsMobile = () =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
