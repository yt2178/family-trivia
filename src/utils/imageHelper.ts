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
 * Checks if an image string is a valid user photo (not null, not empty, and not a 1x1 white dot filter replacement).
 */
export const isValidUserImage = (imgStr: string | null | undefined): boolean => {
  if (!imgStr || typeof imgStr !== 'string') return false;
  const trimmed = imgStr.trim();
  if (trimmed.length < 300) return false; // Too short to be a real photo (likely 1x1 pixel)
  if (trimmed.includes('R0lGODlhAQABA') || trimmed.includes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')) return false; // 1x1 transparent/white pixel
  return true;
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
    if (!isValidUserImage(base64Str)) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      // Protection against Etrog / Kosher Filter 1x1 white dot replacement
      if (img.width <= 10 || img.height <= 10) {
        resolve(base64Str);
        return;
      }
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

/**
 * Prompts the user with a premium circular crop modal.
 * Crops the image to a 1:1 ratio (256x256) inside a circular preview.
 * Resolves with the cropped base64 string.
 */
export const cropImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Create modal overlay element
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'rgba(2, 6, 23, 0.85)';
        overlay.style.backdropFilter = 'blur(8px)';
        overlay.style.zIndex = '300';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '16px';
        overlay.setAttribute('dir', 'rtl');

        overlay.innerHTML = `
          <div style="max-width: 400px; width: 100%; background-color: #0f172a; border: 1px solid #1e293b; padding: 24px; border-radius: 24px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; overflow: hidden; text-align: right; font-family: system-ui, -apple-system, sans-serif;">
            <div style="position: absolute; top: -96px; left: -96px; width: 192px; height: 192px; background-color: rgba(16, 185, 129, 0.1); border-radius: 9999px; filter: blur(48px); pointer-events: none;"></div>
            
            <div style="text-align: center; display: flex; flex-direction: column; gap: 6px;">
              <h2 style="font-size: 20px; font-weight: 900; color: #10b981; margin: 0;">✂️ התאמת תמונה לעיגול</h2>
              <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.6;">
                גרירת התמונה להזזה ↕️↔️<br>
                שינוי זום בעזרת גלגלת העכבר 🖱️ או צביטה בטאץ' 📱
              </p>
            </div>

            <!-- Canvas Viewport -->
            <div style="display: flex; justify-content: center; background-color: rgba(2, 6, 23, 0.4); padding: 16px; border-radius: 16px; border: 1px solid #1e293b; touch-action: none;">
              <canvas id="crop-canvas" width="300" height="300" style="border-radius: 12px; border: 1px solid #334155; background-color: #020617; width: 300px; height: 300px; display: block; margin: 0 auto; cursor: grab;"></canvas>
            </div>

            <div style="text-align: center; font-size: 11px; font-weight: bold; color: #64748b;">
              זום נוכחי: <span id="zoom-text">100%</span>
            </div>

            <!-- Buttons -->
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <button id="btn-cancel" style="flex: 1; padding: 10px; background-color: #1e293b; color: #cbd5e1; border: 1px solid #334155; font-weight: bold; font-size: 13px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                ביטול
              </button>
              <button id="btn-save" style="flex: 2; padding: 10px; background: linear-gradient(to right, #10b981, #14b8a6); color: #020617; font-weight: 900; font-size: 13px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">
                חתוך ושמור תמונה 💾
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        const canvas = overlay.querySelector('#crop-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        const zoomText = overlay.querySelector('#zoom-text') as HTMLSpanElement;

        const btnCancel = overlay.querySelector('#btn-cancel') as HTMLButtonElement;
        const btnSave = overlay.querySelector('#btn-save') as HTMLButtonElement;

        btnCancel.onmouseenter = () => { btnCancel.style.backgroundColor = '#334155'; };
        btnCancel.onmouseleave = () => { btnCancel.style.backgroundColor = '#1e293b'; };

        // Crop viewport settings
        const cropSize = 200;
        const cropRadius = 100;
        const canvasCenter = 150;

        // Fit image minimum dimension to crop container (200px)
        const initScale = cropSize / Math.min(img.width, img.height);
        const baseW = img.width * initScale;
        const baseH = img.height * initScale;

        // Dynamic State
        let zoom = 1.0;
        const minZoom = 1.0;
        const maxZoom = 10.0;
        let dx = 0; // translation X
        let dy = 0; // translation Y

        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let lastTouchDist = 0;

        const limitTranslation = () => {
          const w = baseW * zoom;
          const h = baseH * zoom;
          const maxDx = (w - cropSize) / 2;
          const maxDy = (h - cropSize) / 2;
          dx = Math.max(-maxDx, Math.min(maxDx, dx));
          dy = Math.max(-maxDy, Math.min(maxDy, dy));
        };

        const draw = () => {
          zoomText.innerText = `${Math.round(zoom * 100)}%`;

          const w = baseW * zoom;
          const h = baseH * zoom;
          const x = canvasCenter - w / 2 + dx;
          const y = canvasCenter - h / 2 + dy;

          // Clear
          ctx.clearRect(0, 0, 300, 300);

          // 1. Draw image
          ctx.drawImage(img, x, y, w, h);

          // 2. Draw Donut Mask (leaving the center 100% transparent)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.beginPath();
          // Outer rectangle clockwise
          ctx.rect(0, 0, 300, 300);
          // Inner circle counter-clockwise
          ctx.arc(canvasCenter, canvasCenter, cropRadius, 0, Math.PI * 2, true);
          ctx.fill();

          // 3. Draw border outline
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)'; // emerald glow
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(canvasCenter, canvasCenter, cropRadius, 0, Math.PI * 2);
          ctx.stroke();
        };

        // --- Mouse & Touch Listeners ---

        // Mouse Dragging
        canvas.onmousedown = (e) => {
          isDragging = true;
          dragStartX = e.clientX - dx;
          dragStartY = e.clientY - dy;
          canvas.style.cursor = 'grabbing';
        };

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          dx = e.clientX - dragStartX;
          dy = e.clientY - dragStartY;
          limitTranslation();
          draw();
        });

        window.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
          }
        });

        // Mouse Wheel Zoom
        canvas.onwheel = (e) => {
          e.preventDefault();
          const zoomSpeed = 0.08;
          let newZoom = zoom;
          if (e.deltaY < 0) {
            newZoom = Math.min(zoom + zoomSpeed, maxZoom);
          } else {
            newZoom = Math.max(zoom - zoomSpeed, minZoom);
          }
          zoom = newZoom;
          limitTranslation();
          draw();
        };

        // Touch Interaction (Pan and Pinch Zoom)
        canvas.ontouchstart = (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            dragStartX = e.touches[0].clientX - dx;
            dragStartY = e.touches[0].clientY - dy;
          } else if (e.touches.length === 2) {
            isDragging = false;
            lastTouchDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
          }
        };

        canvas.ontouchmove = (e) => {
          e.preventDefault(); // Prevent scrolling page while cropping
          if (e.touches.length === 1 && isDragging) {
            dx = e.touches[0].clientX - dragStartX;
            dy = e.touches[0].clientY - dragStartY;
            limitTranslation();
            draw();
          } else if (e.touches.length === 2) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastTouchDist > 0) {
              const scaleFactor = dist / lastTouchDist;
              // Smooth pinch zoom
              const nextZoom = zoom * (1 + (scaleFactor - 1) * 0.5);
              zoom = Math.max(minZoom, Math.min(nextZoom, maxZoom));
              limitTranslation();
              draw();
            }
            lastTouchDist = dist;
          }
        };

        canvas.ontouchend = () => {
          isDragging = false;
          lastTouchDist = 0;
        };

        // Draw initial frame
        draw();

        // Handle buttons
        btnCancel.onclick = () => {
          document.body.removeChild(overlay);
          reject(new Error('User cancelled crop'));
        };

        btnSave.onclick = () => {
          const w = baseW * zoom;
          const h = baseH * zoom;
          const x = canvasCenter - w / 2 + dx;
          const y = canvasCenter - h / 2 + dy;

          // Create export canvas at 256x256
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = 256;
          exportCanvas.height = 256;
          const exportCtx = exportCanvas.getContext('2d')!;

          const scaleToExport = 256 / cropSize;
          const ex = (x - (canvasCenter - cropRadius)) * scaleToExport;
          const ey = (y - (canvasCenter - cropRadius)) * scaleToExport;
          const ew = w * scaleToExport;
          const eh = h * scaleToExport;

          exportCtx.imageSmoothingEnabled = true;
          exportCtx.imageSmoothingQuality = 'high';
          exportCtx.drawImage(img, ex, ey, ew, eh);

          const resultBase64 = exportCanvas.toDataURL('image/jpeg', 0.85);

          document.body.removeChild(overlay);
          resolve(resultBase64);
        };
      };
      img.onerror = () => {
        reject(new Error('Failed to load image for cropping'));
      };
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};
