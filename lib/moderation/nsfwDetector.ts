/**
 * NSFWJS (TensorFlow.js) & Hybrid Computer Vision Nudity Shield for Omeglo
 * Real-time active video scanner for nudity, flashing, pornography, and inappropriate exposure.
 * Uses a Two-Tier Hybrid Architecture:
 *  - Tier 1: Instant Zero-Delay Frame Surface & Skin Exposure Analyzer
 *  - Tier 2: Deep Learning NSFWJS (MobileNet V2) Neural Network Classifier
 */

let isNsfwLoading = false;
let isNsfwReady = false;
let nsfwModel: any = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Preload and initialize TensorFlow.js and NSFWJS model
 */
export async function initNsfwDetector(): Promise<boolean> {
  if (isNsfwReady && nsfwModel) return true;
  if (typeof window === "undefined") return false;

  if (isNsfwLoading) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (isNsfwReady) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });
  }

  isNsfwLoading = true;

  try {
    // 1. Dynamically load TensorFlow.js
    if (!(window as any).tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
    }

    // 2. Dynamically load NSFWJS
    if (!(window as any).nsfwjs) {
      await loadScript("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js");
    }

    const nsfwjs = (window as any).nsfwjs;
    if (nsfwjs) {
      nsfwModel = await nsfwjs.load();
      isNsfwReady = true;
      isNsfwLoading = false;
      console.log("✅ NSFWJS Deep Learning Realtime Nudity Model ready.");
      return true;
    }

    isNsfwLoading = false;
    return false;
  } catch (err) {
    console.warn("[-] NSFWJS model load fallback active:", err);
    isNsfwLoading = false;
    return false;
  }
}

export interface NsfwCheckResult {
  isNsfw: boolean;
  topCategory: string;
  probability: number;
  rawPredictions?: Array<{ className: string; probability: number }>;
}

/**
 * Hybrid real-time video frame classifier for nudity & explicit content
 */
export async function checkVideoFrame(videoElement: HTMLVideoElement): Promise<NsfwCheckResult> {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { isNsfw: false, topCategory: "Neutral", probability: 1 };

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // ==========================================
    // Tier 1: Instant Surface Skin Exposure Analysis
    // ==========================================
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const totalPixels = data.length / 4;
    let skinPixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Explicit skin tone & flesh coverage spectrum
      const isFleshTone =
        (r > 50 && g > 30 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 12 && Math.abs(r - g) > 10) ||
        (r > 80 && g > 50 && b > 35 && (r - g) > 12 && (g - b) > 4);

      if (isFleshTone) {
        skinPixelCount++;
      }
    }

    const skinExposureRatio = skinPixelCount / totalPixels;

    // High skin exposure (> 30% of total screen without clothes/covered area)
    const isHeavySkinExposure = skinExposureRatio > 0.28;

    // ==========================================
    // Tier 2: Deep Learning NSFWJS Classification
    // ==========================================
    if (nsfwModel) {
      const predictions: Array<{ className: "Porn" | "Hentai" | "Sexy" | "Drawing" | "Neutral"; probability: number }> =
        await nsfwModel.classify(canvas);

      if (predictions && predictions.length > 0) {
        const top = predictions[0];
        const pornProb = predictions.find((p) => p.className === "Porn")?.probability || 0;
        const hentaiProb = predictions.find((p) => p.className === "Hentai")?.probability || 0;
        const sexyProb = predictions.find((p) => p.className === "Sexy")?.probability || 0;

        // Sensitive & Smart Multi-Class Decision Logic
        const isModelNsfw =
          pornProb > 0.35 ||
          hentaiProb > 0.45 ||
          (sexyProb > 0.60 && skinExposureRatio > 0.15) ||
          (pornProb + sexyProb > 0.50 && skinExposureRatio > 0.12) ||
          (isHeavySkinExposure && (pornProb > 0.20 || sexyProb > 0.30));

        if (isModelNsfw) {
          return {
            isNsfw: true,
            topCategory: pornProb > 0.35 ? "Porn" : top.className,
            probability: Math.max(pornProb, top.probability),
            rawPredictions: predictions,
          };
        }
      }
    } else {
      // Background warmup trigger if not loaded yet
      initNsfwDetector().catch(() => {});
    }

    // Direct High-Confidence Flesh/Nudity Trigger (> 38% surface exposure)
    if (skinExposureRatio > 0.38) {
      return {
        isNsfw: true,
        topCategory: "Explicit Exposure",
        probability: Math.min(0.95, skinExposureRatio * 2),
      };
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during NSFW video check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
