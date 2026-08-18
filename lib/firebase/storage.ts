import { getAuthHeaders } from './api-client';

const STORAGE_PRESIGN_ENDPOINT = '/api/storage/presign';
const STORAGE_DELETE_ENDPOINT = '/api/storage/delete';

/**
 * Upload a file body to a presigned MinIO PUT URL.
 */
async function putFile(uploadUrl: string, file: Blob | File, contentType?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = contentType;
    const response = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
    if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
    }
}

/**
 * Upload profile picture to MinIO (public read).
 * @param userId - User ID
 * @param file - Image file
 * @returns Public URL
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
        const headers = await getAuthHeaders();
        const response = await fetch(STORAGE_PRESIGN_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ kind: 'profile', size: file.size }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to create upload');
        }

        const { uploadUrl, url } = await response.json();
        await putFile(uploadUrl, file, 'image/jpeg');

        return url;
    } catch (error: any) {
        console.error('[Storage:Upload] Error uploading profile picture:', error);
        throw new Error(error.message || 'Failed to upload profile picture');
    }
}

/**
 * Delete profile picture from MinIO.
 * @param userId - User ID
 */
export async function deleteProfilePicture(userId: string): Promise<void> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(STORAGE_DELETE_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ kind: 'profile' }),
        });
        if (!response.ok) {
            console.error('[Storage:Delete] Failed to delete profile picture');
        }
    } catch (error) {
        console.error('[Storage:Delete] Error deleting profile picture:', error);
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

/**
 * Upload learning material to MinIO (public read).
 * @param sessionId - Current session ID
 * @param file - The file to upload
 * @returns Metadata about the uploaded file
 */
export async function uploadLearningMaterial(sessionId: string, file: File): Promise<{ url: string; name: string; type: string; size: number }> {
    // 50MB max for materials
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 50MB.');
    }

    try {
        const headers = await getAuthHeaders();
        const response = await fetch(STORAGE_PRESIGN_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ kind: 'material', sessionId, fileName: file.name, size: file.size }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to create upload');
        }

        const { uploadUrl, url } = await response.json();
        await putFile(uploadUrl, file);

        return {
            url,
            name: file.name,
            type: file.type,
            size: file.size,
        };
    } catch (error) {
        console.error('[Storage:Materials] Upload failed:', error);
        throw new Error('Failed to upload material');
    }
}