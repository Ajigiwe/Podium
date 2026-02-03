import { app } from './config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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
        // Get storage instance dynamically to ensure app is initialized
        const storage = getStorage(app);

        // Since we compress to JPEG, we'll force the extension to .jpg
        // This ensures consistency between MIME type and extension
        const fullPath = `profile-pictures/${userId}.jpg`;
        console.log(`[Upload] Attempting to upload to: ${fullPath}`);
        console.log(`[Upload] File size: ${file.size}, Type: ${file.type}`);

        const storageRef = ref(storage, fullPath);

        // Upload file with explicit content type
        await uploadBytes(storageRef, file, {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000'
        });

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
        const storage = getStorage(app);
        // We now enforce .jpg, but check others for backward compatibility
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
                            // Ensure the filename has .jpg extension
                            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                            const compressedFile = new File([blob], fileName, {
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
