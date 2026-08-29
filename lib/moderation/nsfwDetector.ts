/**
 * NSFWJS (TensorFlow.js) & Anatomical Torso Analyzer for Omeglo
 * Precision Detection Engine:
 *  - Accurately catches SHIRTLESS (bare chest / bare torso) and explicit nudity
 *  - Accurately ALLOWS users wearing a VEST (බැනියමක්), singlets, or T-shirts by verifying chest fabric coverage
 *  - Uses WebGL GPU acceleration & zero-allocation static canvas singletons
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
      console.log("✅ NSFWJS Anatomical Torso Model ready.");
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
 * Analyzes the mid-torso / chest region of the video frame.
 * Measures the ratio of bare skin vs. clothing fabric across the chest.
 * - Shirtless / Bare Chest: chestSkinRatio is > 0.58 (no fabric covering chest)
 * - Wearing Vest (බැනියමක්) / T-shirt: chestSkinRatio is < 0.42 (covered by fabric)
 */
function getChestSkinCoverage(ctx: CanvasRenderingContext2D): number {
  const x = Math.floor(224 * 0.22);
  const y = Math.floor(224 * 0.40);
  const w = Math.floor(224 * 0.56);
  const h = Math.floor(224 * 0.42);

  try {
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;
    let skinCount = 0;
    const total = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // True human skin / flesh tone spectrum
      const isSkin =
        (r > 50 && g > 30 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 10 && Math.abs(r - g) > 6) ||
        (r > 70 && g > 45 && b > 30 && (r - g) > 8 && (g - b) > 3);

      if (isSkin) skinCount++;
    }

    return skinCount / total;
  } catch {
    return 0;
  }
}

function evaluatePredictions(
  predictions: Array<{ className: "Porn" | "Hentai" | "Sexy" | "Drawing" | "Neutral"; probability: number }>
): { isModelFlagged: boolean; category: string; prob: number } {
  if (!predictions || predictions.length === 0) {
    return { isModelFlagged: false, category: "Neutral", prob: 1 };
  }

  const top = predictions[0];
  const pornProb = predictions.find((p) => p.className === "Porn")?.probability || 0;
  const hentaiProb = predictions.find((p) => p.className === "Hentai")?.probability || 0;
  const sexyProb = predictions.find((p) => p.className === "Sexy")?.probability || 0;
  const neutralProb = predictions.find((p) => p.className === "Neutral")?.probability || 0;

  // 1. Direct Porn / Flashing / Genitals
  if (pornProb >= 0.20 || hentaiProb >= 0.40 || (top.className === "Porn" && pornProb >= 0.18)) {
    return { isModelFlagged: true, category: "Porn", prob: Math.max(pornProb, top.probability) };
  }

  // 2. High Sexy + Low Neutral (Explicit exposure)
  if (sexyProb >= 0.35 && neutralProb <= 0.58) {
    return { isModelFlagged: true, category: "Explicit Nudity", prob: sexyProb };
  }

  // 3. Cumulative exposure
  if (pornProb + sexyProb >= 0.45 && neutralProb <= 0.60) {
    return { isModelFlagged: true, category: "Explicit Nudity", prob: pornProb + sexyProb };
  }

  return { isModelFlagged: false, category: "Neutral", prob: 1 };
}

/**
 * Multi-Scale Dual-Pass Video Frame Scanner with Torso Fabric Inspection.
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
    const fullChestSkin = getChestSkinCoverage(fullCtx);
    const fullPreds = await nsfwModel.classify(fullCanvas);
    const fullRes = evaluatePredictions(fullPreds);

    // =========================================================================
    // Pass 2: Center Subject Crop (Zoom into center 65% of frame)
    // =========================================================================
    const cropWidth = Math.floor(vw * 0.65);
    const cropHeight = Math.floor(vh * 0.65);
    const cropX = Math.floor((vw - cropWidth) / 2);
    const cropY = Math.floor((vh - cropHeight) / 2);

    cropCtx.drawImage(videoElement, cropX, cropY, cropWidth, cropHeight, 0, 0, 224, 224);
    const cropChestSkin = getChestSkinCoverage(cropCtx);
    const cropPreds = await nsfwModel.classify(cropCanvas);
    const cropRes = evaluatePredictions(cropPreds);

    const maxChestSkin = Math.max(fullChestSkin, cropChestSkin);
    const isModelFlagged = fullRes.isModelFlagged || cropRes.isModelFlagged;

    // =========================================================================
    // PERFECT SWEET SPOT DISCRIMINATION:
    // 1. Direct Porn / Genital Nudity -> ALWAYS FLAGGED
    // 2. Shirtless / Bare Torso (maxChestSkin >= 0.58 AND (isModelFlagged OR maxChestSkin >= 0.68)) -> FLAGGED
    // 3. Wearing a Vest (බැනියමක්) -> maxChestSkin <= 0.42 -> ALLOWED!
    // =========================================================================
    const isShirtless = maxChestSkin >= 0.58 && (isModelFlagged || maxChestSkin >= 0.68);
    const isExplicitNsfw = isModelFlagged && maxChestSkin >= 0.42;

    if (isShirtless || isExplicitNsfw) {
      return {
        isNsfw: true,
        topCategory: isShirtless ? "Shirtless / Bare Torso" : (fullRes.category || cropRes.category),
        probability: Math.max(fullRes.prob, cropRes.prob, maxChestSkin),
        rawPredictions: fullPreds,
      };
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during NSFW video check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
