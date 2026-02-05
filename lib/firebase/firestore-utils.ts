import { 
  Firestore, 
  enableNetwork, 
  disableNetwork, 
  terminate,
  waitForPendingWrites
} from 'firebase/firestore';

/**
 * Utility functions to handle Firestore connection issues
 */

// Track connection status
let isNetworkEnabled = true;

/**
 * Attempts to reconnect to Firestore when network issues occur
 */
export async function reconnectFirestore(db: Firestore): Promise<boolean> {
  try {
    if (!isNetworkEnabled) {
      await enableNetwork(db);
      isNetworkEnabled = true;
      console.log('Firestore network connection re-enabled');
      return true;
    }
    return true;
  } catch (error) {
    console.error('Error enabling Firestore network:', error);
    return false;
  }
}

/**
 * Handles Firestore disconnection gracefully
 */
export async function disconnectFirestore(db: Firestore): Promise<void> {
  try {
    await disableNetwork(db);
    isNetworkEnabled = false;
    console.log('Firestore network connection disabled');
  } catch (error) {
    console.error('Error disabling Firestore network:', error);
  }
}

/**
 * Gracefully terminates Firestore instance
 */
export async function terminateFirestore(db: Firestore): Promise<void> {
  try {
    await waitForPendingWrites(db);
    await terminate(db);
    console.log('Firestore instance terminated');
  } catch (error) {
    console.error('Error terminating Firestore:', error);
  }
}

/**
 * Handles Firestore connection errors and implements retry logic
 */
export async function handleFirestoreError(
  db: Firestore, 
  error: any,
  maxRetries: number = 3
): Promise<boolean> {
  console.error('Firestore error occurred:', error);
  
  // Check if it's a network-related error
  if (
    error.code === 'unavailable' || 
    error.message.includes('backend') ||
    error.message.includes('network') ||
    error.message.includes('timeout')
  ) {
    console.log(`Attempting to reconnect to Firestore (network issue detected)...`);
    
    // Try to reconnect
    const reconnected = await reconnectFirestore(db);
    if (reconnected) {
      return true;
    }
  }
  
  // For other errors, return false to indicate it's not recoverable
  return false;
}