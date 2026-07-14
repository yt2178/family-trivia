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
          <div style="max-width: 400px; width: 100%; background-color: #0f172a; border: 1px solid #1e293b; padding: 24px; border-radius: 24px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); relative: true; overflow: hidden; text-align: right; font-family: system-ui, -apple-system, sans-serif;">
            <div style="position: absolute; top: -96px; left: -96px; width: 192px; height: 192px; background-color: rgba(16, 185, 129, 0.1); border-radius: 9999px; filter: blur(48px); pointer-events: none;"></div>
            
            <div style="text-align: center; display: flex; flex-direction: column; gap: 8px;">
              <h2 style="font-size: 20px; font-weight: 900; color: #10b981; margin: 0;">✂️ התאמת תמונה לעיגול</h2>
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">הזז את המכוונים מטה כדי למקם את הפנים בתוך העיגול (מה שמוצג בעיגול זה מה שיוצג במשחק)</p>
            </div>

            <!-- Canvas Preview -->
            <div style="display: flex; justify-content: center; background-color: rgba(2, 6, 23, 0.4); padding: 16px; border-radius: 16px; border: 1px solid #1e293b;">
              <canvas id="crop-canvas" width="300" height="300" style="border-radius: 12px; border: 1px solid #334155; background-color: #020617; width: 300px; height: 300px; display: block; margin: 0 auto;"></canvas>
            </div>

            <!-- Sliders -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <!-- Scale Slider -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #94a3b8; margin-bottom: 4px;">
                  <span>🔍 זום (הגדלה):</span>
                  <span id="zoom-val">100%</span>
                </div>
                <input type="range" id="zoom-slider" min="100" max="300" value="100" style="width: 100%; height: 4px; border-radius: 9999px; cursor: pointer; accent-color: #10b981; background-color: #1e293b; outline: none; border: none;">
              </div>

              <!-- X Offset Slider -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #94a3b8; margin-bottom: 4px;">
                  <span>↔️ הזזה אופקית (ימינה / שמאלה):</span>
                </div>
                <input type="range" id="pan-x-slider" min="-100" max="100" value="0" style="width: 100%; height: 4px; border-radius: 9999px; cursor: pointer; accent-color: #10b981; background-color: #1e293b; outline: none; border: none;">
              </div>

              <!-- Y Offset Slider -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #94a3b8; margin-bottom: 4px;">
                  <span>↕️ הזזה אנכית (למעלה / למטה):</span>
                </div>
                <input type="range" id="pan-y-slider" min="-100" max="100" value="0" style="width: 100%; height: 4px; border-radius: 9999px; cursor: pointer; accent-color: #10b981; background-color: #1e293b; outline: none; border: none;">
              </div>
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

        const zoomSlider = overlay.querySelector('#zoom-slider') as HTMLInputElement;
        const panXSlider = overlay.querySelector('#pan-x-slider') as HTMLInputElement;
        const panYSlider = overlay.querySelector('#pan-y-slider') as HTMLInputElement;
        const zoomVal = overlay.querySelector('#zoom-val') as HTMLSpanElement;

        const btnCancel = overlay.querySelector('#btn-cancel') as HTMLButtonElement;
        const btnSave = overlay.querySelector('#btn-save') as HTMLButtonElement;

        // Hover effect helper
        btnCancel.onmouseenter = () => { btnCancel.style.backgroundColor = '#334155'; };
        btnCancel.onmouseleave = () => { btnCancel.style.backgroundColor = '#1e293b'; };

        // Math configurations
        const cropSize = 200;
        const cropRadius = 100;
        const canvasCenter = 150;

        // Initial image fit to cover crop viewport
        const initScale = cropSize / Math.min(img.width, img.height);
        const baseW = img.width * initScale;
        const baseH = img.height * initScale;

        const draw = () => {
          const zoom = parseInt(zoomSlider.value) / 100;
          zoomVal.innerText = `${Math.round(zoom * 100)}%`;

          const w = baseW * zoom;
          const h = baseH * zoom;

          const panXFactor = parseInt(panXSlider.value) / 100;
          const panYFactor = parseInt(panYSlider.value) / 100;

          // Limit offsets to keep the circle covered by image content
          const maxDx = (w - cropSize) / 2;
          const maxDy = (h - cropSize) / 2;
          const dx = panXFactor * maxDx;
          const dy = panYFactor * maxDy;

          const x = canvasCenter - w / 2 + dx;
          const y = canvasCenter - h / 2 + dy;

          // Clear and draw image
          ctx.clearRect(0, 0, 300, 300);
          ctx.drawImage(img, x, y, w, h);

          // Draw mask
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.globalCompositeOperation = 'source-over';
          
          ctx.beginPath();
          ctx.rect(0, 0, 300, 300);
          ctx.fill();

          // Cut circular preview hole
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(canvasCenter, canvasCenter, cropRadius, 0, Math.PI * 2);
          ctx.fill();

          // Reset composite operation to draw the border stroke on top
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)'; // glowing emerald
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(canvasCenter, canvasCenter, cropRadius, 0, Math.PI * 2);
          ctx.stroke();
        };

        zoomSlider.oninput = draw;
        panXSlider.oninput = draw;
        panYSlider.oninput = draw;

        draw();

        btnCancel.onclick = () => {
          document.body.removeChild(overlay);
          reject(new Error('User cancelled crop'));
        };

        btnSave.onclick = () => {
          const zoom = parseInt(zoomSlider.value) / 100;
          const w = baseW * zoom;
          const h = baseH * zoom;
          const panXFactor = parseInt(panXSlider.value) / 100;
          const panYFactor = parseInt(panYSlider.value) / 100;

          const maxDx = (w - cropSize) / 2;
          const maxDy = (h - cropSize) / 2;
          const dx = panXFactor * maxDx;
          const dy = panYFactor * maxDy;

          const x = canvasCenter - w / 2 + dx;
          const y = canvasCenter - h / 2 + dy;

          // Create output canvas at 256x256 (optimized compression size)
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
