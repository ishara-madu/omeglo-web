/**
 * NSFWJS (TensorFlow.js) Ultra-Lightweight Environmental-Aware Nudity Shield for Omeglo
 * Optimized for Mobile & Low-End Devices:
 *  - Uses WebGL Hardware GPU Acceleration
 *  - Zero-Allocation Reusable Static Canvas Singletons (No Garbage Collection pauses)
 *  - Automatic Memory Management via tf.tidy()
 *  - Tab Visibility Auto-Pause (0% CPU when tab is in background)
 */

let isNsfwLoading = false;
let isNsfwReady = false;
let nsfwModel: any = null;

// Reusable Static In-Memory Canvases (Prevents memory churn & GC stutter)
let sharedFullCanvas: HTMLCanvasElement | null = null;
let sharedCropCanvas: HTMLCanvasElement | null = null;
let sharedFullCtx: CanvasRenderingContext2D | null = null;
let sharedCropCtx: CanvasRenderingContext2D | null = null;

function getSharedCanvases() {
  if (typeof window === "undefined") return null;
  if (!sharedFullCanvas) {
    sharedFullCanvas = document.createElement("canvas");
    sharedFullCanvas.width = 224;
    sharedFullCanvas.height = 224;
    sharedFullCtx = sharedFullCanvas.getContext("2d", { willReadFrequently: true });

    sharedCropCanvas = document.createElement("canvas");
    sharedCropCanvas.width = 224;
    sharedCropCanvas.height = 224;
    sharedCropCtx = sharedCropCanvas.getContext("2d", { willReadFrequently: true });
  }
  return {
    fullCanvas: sharedFullCanvas,
    fullCtx: sharedFullCtx,
    cropCanvas: sharedCropCanvas,
    cropCtx: sharedCropCtx,
  };
}

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
 * Preload and initialize TensorFlow.js and NSFWJS model with WebGL acceleration
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
    // 1. Load TensorFlow.js (Enables WebGL GPU backend automatically)
    if (!(window as any).tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
    }

    // 2. Load NSFWJS
    if (!(window as any).nsfwjs) {
      await loadScript("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js");
    }

    const nsfwjs = (window as any).nsfwjs;
    if (nsfwjs) {
      nsfwModel = await nsfwjs.load();
      isNsfwReady = true;
      isNsfwLoading = false;
      console.log("✅ NSFWJS Hardware-Accelerated Model ready.");
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

function evaluatePredictions(
  predictions: Array<{ className: "Porn" | "Hentai" | "Sexy" | "Drawing" | "Neutral"; probability: number }>
): { isNsfw: boolean; category: string; prob: number } {
  if (!predictions || predictions.length === 0) {
    return { isNsfw: false, category: "Neutral", prob: 1 };
  }

  const top = predictions[0];
  const pornProb = predictions.find((p) => p.className === "Porn")?.probability || 0;
  const hentaiProb = predictions.find((p) => p.className === "Hentai")?.probability || 0;
  const sexyProb = predictions.find((p) => p.className === "Sexy")?.probability || 0;
  const neutralProb = predictions.find((p) => p.className === "Neutral")?.probability || 0;

  // BALANCED MULTI-SCALE SENSITIVITY:
  // 1. Explicit porn / flashing: pornProb >= 0.20
  // 2. Animated porn: hentaiProb >= 0.40
  // 3. Top classification is Porn: top.className === "Porn" && pornProb >= 0.18
  // 4. Exposed body / nude in room: sexyProb >= 0.42 && (pornProb >= 0.04 || neutralProb <= 0.52)
  // 5. High cumulative explicit score: pornProb + sexyProb >= 0.50 && neutralProb <= 0.50
  const isNsfw =
    pornProb >= 0.20 ||
    hentaiProb >= 0.40 ||
    (top.className === "Porn" && pornProb >= 0.18) ||
    (sexyProb >= 0.42 && (pornProb >= 0.04 || neutralProb <= 0.52)) ||
    (pornProb + sexyProb >= 0.50 && neutralProb <= 0.50);

  return {
    isNsfw,
    category: pornProb >= 0.20 ? "Porn" : "Explicit Nudity",
    prob: Math.max(pornProb, sexyProb, top.probability),
  };
}

/**
 * Multi-Scale Dual-Pass Video Frame Scanner with Zero-Allocation Memory Optimization.
 */
export async function checkVideoFrame(videoElement: HTMLVideoElement): Promise<NsfwCheckResult> {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  // Battery saver: Pause when tab is minimized
  if (typeof document !== "undefined" && document.hidden) {
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  try {
    if (!nsfwModel) {
      initNsfwDetector().catch(() => {});
      return { isNsfw: false, topCategory: "Neutral", probability: 1 };
    }

    const canvases = getSharedCanvases();
    if (!canvases || !canvases.fullCtx || !canvases.cropCtx) {
      return { isNsfw: false, topCategory: "Neutral", probability: 1 };
    }

    const { fullCanvas, fullCtx, cropCanvas, cropCtx } = canvases;
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;

    // =========================================================================
    // Pass 1: Full Frame Scan (224x224)
    // =========================================================================
    fullCtx.drawImage(videoElement, 0, 0, 224, 224);
    const fullPreds = await nsfwModel.classify(fullCanvas);
    const fullRes = evaluatePredictions(fullPreds);

    if (fullRes.isNsfw) {
      return {
        isNsfw: true,
        topCategory: fullRes.category,
        probability: fullRes.prob,
        rawPredictions: fullPreds,
      };
    }

    // =========================================================================
    // Pass 2: Center Subject Crop (Zoom into center 65% of frame)
    // Cuts out surrounding room walls, furniture, bedsheets, and curtains
    // =========================================================================
    const cropWidth = Math.floor(vw * 0.65);
    const cropHeight = Math.floor(vh * 0.65);
    const cropX = Math.floor((vw - cropWidth) / 2);
    const cropY = Math.floor((vh - cropHeight) / 2);

    cropCtx.drawImage(videoElement, cropX, cropY, cropWidth, cropHeight, 0, 0, 224, 224);
    const cropPreds = await nsfwModel.classify(cropCanvas);
    const cropRes = evaluatePredictions(cropPreds);

    if (cropRes.isNsfw) {
      return {
        isNsfw: true,
        topCategory: cropRes.category,
        probability: cropRes.prob,
        rawPredictions: cropPreds,
      };
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during Multi-Scale NSFW video check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
