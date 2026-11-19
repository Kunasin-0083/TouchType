/**
 * Image upload & compression utility for avatars
 * Automatically keeps base64 output compact (< 24,000 chars) so avatars
 * store reliably in Google Sheets cells (50,000 char limit) and load fast.
 */

const MAX_GOOGLE_SHEETS_AVATAR_CHARS = 24000;

export function processAvatarFile(file: File, maxSize: number = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)'));
      return;
    }

    const targetSize = Math.min(Math.max(maxSize, 96), 180);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
      img.onload = () => {
        try {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          const renderCompressed = (dim: number, quality: number): string => {
            const canvas = document.createElement('canvas');
            canvas.width = dim;
            canvas.height = dim;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reader.result as string;
            // Fill white background for transparent PNGs converted to JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, dim, dim);
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, dim, dim);
            return canvas.toDataURL('image/jpeg', quality);
          };

          let compressed = renderCompressed(targetSize, 0.8);
          if (compressed.length > MAX_GOOGLE_SHEETS_AVATAR_CHARS) {
            compressed = renderCompressed(140, 0.7);
          }
          if (compressed.length > MAX_GOOGLE_SHEETS_AVATAR_CHARS) {
            compressed = renderCompressed(112, 0.6);
          }
          resolve(compressed);
        } catch {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
