import { db, reconnectFirestore } from './config';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Test function to verify Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Try to read from a collection to test the connection
    const testCollection = collection(db, 'profiles'); // Use profiles as it should exist
    const snapshot = await getDocs(testCollection);
    
    console.log(`Successfully connected to Firestore. Found ${snapshot.size} profiles.`);
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    
    // Attempt to reconnect
    const reconnected = await reconnectFirestore(db);
    if (reconnected) {
      try {
        // Try again after reconnection
        const testCollection = collection(db, 'profiles');
        const snapshot = await getDocs(testCollection);
        
        console.log(`Reconnected to Firestore successfully. Found ${snapshot.size} profiles.`);
        return true;
      } catch (retryError) {
        console.error('Firestore connection still failing after reconnection attempt:', retryError);
        return false;
      }
    }
    
    return false;
  }
}