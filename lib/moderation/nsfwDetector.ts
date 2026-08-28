/**
 * NSFWJS (TensorFlow.js) Nudity & NSFW Content Detector for Omeglo
 * Scans active video streams in real-time to detect nudity, pornographic, or inappropriate exposure.
 * Dynamically loaded in the background only when video chat starts (0 KB initial SEO impact).
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
 * Dynamically load TensorFlow.js and NSFWJS model on-demand
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
      }, 150);
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

    // 3. Load Model weights (MobileNet V2 / Inception)
    const nsfwjs = (window as any).nsfwjs;
    if (nsfwjs) {
      nsfwModel = await nsfwjs.load();
      isNsfwReady = true;
      isNsfwLoading = false;
      console.log("✅ NSFWJS (TensorFlow.js) Realtime Nudity Model loaded.");
      return true;
    }

    isNsfwLoading = false;
    return false;
  } catch (err) {
    console.warn("[-] Could not load NSFWJS model:", err);
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
 * Classify a video element's current frame for nudity / NSFW content
 */
export async function checkVideoFrame(videoElement: HTMLVideoElement): Promise<NsfwCheckResult> {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  if (!nsfwModel) {
    // Attempt background init
    initNsfwDetector().catch(() => {});
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  try {
    // Grab canvas snapshot of frame
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { isNsfw: false, topCategory: "Neutral", probability: 1 };

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Classify using NSFWJS
    const predictions: Array<{ className: "Porn" | "Hentai" | "Sexy" | "Drawing" | "Neutral"; probability: number }> =
      await nsfwModel.classify(canvas);

    if (!predictions || predictions.length === 0) {
      return { isNsfw: false, topCategory: "Neutral", probability: 1 };
    }

    const top = predictions[0];

    // Check if Porn/Hentai/Explicit nudity is detected with high confidence (> 0.70)
    // or Sexy with high confidence (> 0.85)
    const pornProb = predictions.find((p) => p.className === "Porn")?.probability || 0;
    const hentaiProb = predictions.find((p) => p.className === "Hentai")?.probability || 0;
    const sexyProb = predictions.find((p) => p.className === "Sexy")?.probability || 0;

    const isNsfw = pornProb > 0.65 || hentaiProb > 0.75 || (sexyProb > 0.88 && pornProb > 0.3);

    return {
      isNsfw,
      topCategory: top.className,
      probability: top.probability,
      rawPredictions: predictions,
    };
  } catch (err) {
    console.error("[-] Error classifying video frame with NSFWJS:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
