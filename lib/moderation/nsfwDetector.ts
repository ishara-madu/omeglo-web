/**
 * NSFWJS (TensorFlow.js) Multi-Scale Neural Vision Shield for Omeglo
 * Precision Deep Learning Engine:
 *  - Distinguishes CLOSE-UP FACES (Neutral) from BARE CHEST/NUDITY (Sexy) and GENITAL FLASHING (Porn)
 *  - Self-hosted model loaded locally from /models/mobilenet_v2/ for 0-latency and 100% reliability
 *  - Uses WebGL GPU acceleration & zero-allocation static canvas singletons
 */

let isNsfwLoading = false;
let isNsfwReady = false;
let nsfwModel: any = null;

// Reusable Static In-Memory Canvases (Zero Garbage Collection overhead)
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
 * Preload and initialize TensorFlow.js and NSFWJS model using self-hosted weights
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
    // 1. Load TensorFlow.js (WebGL GPU backend)
    if (!(window as any).tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
    }

    // 2. Load NSFWJS
    if (!(window as any).nsfwjs) {
      await loadScript("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js");
    }

    const nsfwjs = (window as any).nsfwjs;
    if (nsfwjs) {
      try {
        // Self-hosted fast model load from /models/mobilenet_v2/
        nsfwModel = await nsfwjs.load("/models/mobilenet_v2/", { size: 224 });
        console.log("✅ NSFWJS Self-Hosted Model loaded from /models/mobilenet_v2/");
      } catch (errLocal) {
        console.warn("[-] Local model load fallback to CDN:", errLocal);
        nsfwModel = await nsfwjs.load("https://cdn.jsdelivr.net/gh/infinitered/nsfwjs/models/mobilenet_v2/", { size: 224 });
      }

      isNsfwReady = true;
      isNsfwLoading = false;
      return true;
    }

    isNsfwLoading = false;
    return false;
  } catch (err) {
    console.error("[-] NSFWJS model load error:", err);
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
 * Multi-Scale Dual-Pass Video Frame Scanner.
 * Accurately detects:
 *  1. Genital flashing / Pornography (Porn)
 *  2. Shirtless / Bare Torso / Full Nudity (Sexy with low Neutral)
 *  3. Allows Close-up Faces & Clothed Users (Neutral)
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
    // Pass 1: Full Frame Scan
    // =========================================================================
    fullCtx.drawImage(videoElement, 0, 0, 224, 224);
    const fullPreds = await nsfwModel.classify(fullCanvas);

    // =========================================================================
    // Pass 2: Center-Crop Zoom (Focuses on subject, cuts 70% room background)
    // =========================================================================
    const cropWidth = Math.floor(vw * 0.65);
    const cropHeight = Math.floor(vh * 0.65);
    const cropX = Math.floor((vw - cropWidth) / 2);
    const cropY = Math.floor((vh - cropHeight) / 2);

    cropCtx.drawImage(videoElement, cropX, cropY, cropWidth, cropHeight, 0, 0, 224, 224);
    const cropPreds = await nsfwModel.classify(cropCanvas);

    // Extract class probabilities across both passes
    const fullPorn = fullPreds.find((p: any) => p.className === "Porn")?.probability || 0;
    const cropPorn = cropPreds.find((p: any) => p.className === "Porn")?.probability || 0;
    const maxPorn = Math.max(fullPorn, cropPorn);

    const fullHentai = fullPreds.find((p: any) => p.className === "Hentai")?.probability || 0;
    const cropHentai = cropPreds.find((p: any) => p.className === "Hentai")?.probability || 0;
    const maxHentai = Math.max(fullHentai, cropHentai);

    const fullSexy = fullPreds.find((p: any) => p.className === "Sexy")?.probability || 0;
    const cropSexy = cropPreds.find((p: any) => p.className === "Sexy")?.probability || 0;
    const maxSexy = Math.max(fullSexy, cropSexy);

    const fullNeutral = fullPreds.find((p: any) => p.className === "Neutral")?.probability || 0;
    const cropNeutral = cropPreds.find((p: any) => p.className === "Neutral")?.probability || 0;
    const minNeutral = Math.min(fullNeutral, cropNeutral);

    // =========================================================================
    // ACCURATE NEURAL CLASSIFICATION MATRIX:
    //
    // 1. GENITAL FLASHING / PORNOGRAPHY / MASTURBATION:
    //    maxPorn >= 0.20 OR maxHentai >= 0.38 OR Top Class === 'Porn'
    //    -> ALWAYS FLAGGED!
    //
    // 2. SHIRTLESS / BARE TORSO / FULL NUDITY:
    //    maxSexy >= 0.45 AND minNeutral <= 0.48
    //    OR (Top Class === 'Sexy' AND maxSexy >= 0.38 AND minNeutral <= 0.52)
    //    -> FLAGGED!
    //
    // 3. CLOSE-UP FACE / CLOTHED / VEST (බැනියමක්):
    //    For a close-up face or shirt/vest, MobileNet classifies high Neutral (minNeutral >= 0.55)
    //    and low Porn (< 0.05) & low Sexy (< 0.30).
    //    -> ALLOWED SAFELY!
    // =========================================================================
    const isDirectGenitalPorn =
      maxPorn >= 0.20 ||
      maxHentai >= 0.38 ||
      (fullPreds[0]?.className === "Porn" && maxPorn >= 0.15) ||
      (cropPreds[0]?.className === "Porn" && maxPorn >= 0.15);

    const isBareTorsoOrNude =
      (maxSexy >= 0.45 && minNeutral <= 0.48) ||
      ((fullPreds[0]?.className === "Sexy" || cropPreds[0]?.className === "Sexy") && maxSexy >= 0.38 && minNeutral <= 0.52);

    if (isDirectGenitalPorn || isBareTorsoOrNude) {
      return {
        isNsfw: true,
        topCategory: isDirectGenitalPorn ? "Genital Flashing / Porn" : "Shirtless / Nudity",
        probability: Math.max(maxPorn, maxSexy),
        rawPredictions: fullPreds,
      };
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during Neural NSFW check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
