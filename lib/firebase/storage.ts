import { storage } from './config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload profile picture to Firebase Storage
 * @param userId - User ID
 * @param file - Image file
 * @returns Download URL
 */
export async function uploadProfilePicture(userId: string, file: File): Promise<string> {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, or WebP.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 5MB.');
    }

    try {
        // Create storage reference
        const fileExtension = file.name.split('.').pop();
        const storageRef = ref(storage, `profile-pictures/${userId}.${fileExtension}`);

        // Upload file
        await uploadBytes(storageRef, file);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        throw new Error('Failed to upload profile picture');
    }
}

/**
 * Delete profile picture from Firebase Storage
 * @param userId - User ID
 */
export async function deleteProfilePicture(userId: string): Promise<void> {
    try {
        // Try common extensions
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];

        for (const ext of extensions) {
            try {
                const storageRef = ref(storage, `profile-pictures/${userId}.${ext}`);
                await deleteObject(storageRef);
                console.log(`Deleted profile picture: ${userId}.${ext}`);
                return;
            } catch (error) {
                // Continue to next extension
            }
        }
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        // Don't throw error - it's okay if file doesn't exist
    }
}

/**
 * Compress and resize image before upload
 * @param file - Image file
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @param quality - JPEG quality (0-1)
 * @returns Compressed file
 */
export async function compressImage(
    file: File,
    maxWidth: number = 500,
    maxHeight: number = 500,
    quality: number = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Failed to compress image'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
    });
}
