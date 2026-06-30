/**
 * Image Utilities and Compression Helpers
 * Provides protection against LocalStorage QuotaExceededError and Firebase RTDB payload overhead.
 */

/**
 * Converts a File object to a Base64 data URL string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Compresses a Base64 image string to keep payload size minimal (target < 25KB).
 * This protects the application against LocalStorage quota limits and Firebase RTDB overflow.
 */
export const compressImage = (
  base64Str: string,
  maxWidth = 120,
  maxHeight = 120,
  quality = 0.6
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      // Compress as JPEG
      let compressed = canvas.toDataURL('image/jpeg', quality);
      
      // If the image is still too large (> 25KB), compress it more aggressively
      if (compressed.length > 25000) {
        compressed = canvas.toDataURL('image/jpeg', quality - 0.2);
      }
      
      // Final fallback if still too large: shrink dimensions
      if (compressed.length > 35000) {
        canvas.width = Math.round(width * 0.7);
        canvas.height = Math.round(height * 0.7);
        const fallbackCtx = canvas.getContext('2d');
        fallbackCtx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        compressed = canvas.toDataURL('image/jpeg', 0.3);
      }
      
      resolve(compressed);
    };
    img.onerror = () => {
      // Return original if image loading fails
      resolve(base64Str);
    };
  });
};
