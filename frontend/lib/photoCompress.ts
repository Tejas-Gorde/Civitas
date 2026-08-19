/**
 * Client-side photo compression for voter verification photos.
 * Resizes to a max dimension of 1280px and compresses as JPEG (quality 0.72-0.80).
 * Target file size: 50–200 KB.
 * Strips all EXIF/GPS metadata (canvas re-encode removes metadata).
 */

const MAX_DIMENSION = 1280;
const TARGET_QUALITY = 0.75;
const MAX_SIZE_BYTES = 200 * 1024; // 200 KB
const MIN_QUALITY = 0.60;

export async function compressPhotoBlob(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Resize if either dimension exceeds max
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context for compression"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // First pass at target quality
      canvas.toBlob(
        (compressed) => {
          if (!compressed) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // If already small enough, use it directly
          if (compressed.size <= MAX_SIZE_BYTES) {
            resolve(compressed);
            return;
          }

          // Second pass: reduce quality if still too large
          const reducedQuality = Math.max(
            MIN_QUALITY,
            TARGET_QUALITY * (MAX_SIZE_BYTES / compressed.size)
          );

          canvas.toBlob(
            (final) => {
              if (!final) {
                reject(new Error("Failed second-pass compression"));
                return;
              }
              resolve(final);
            },
            "image/jpeg",
            reducedQuality
          );
        },
        "image/jpeg",
        TARGET_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}
