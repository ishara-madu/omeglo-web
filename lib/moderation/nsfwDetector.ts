/**
 * NSFWJS (TensorFlow.js) & Multi-Layer Anatomical Analyzer for Omeglo
 * Comprehensive Multi-Vector Protection:
 *  1. Genital Flashing & Explicit Lower Body Exposure: Caught instantly via Deep Learning Porn classification (pornProb >= 0.18)
 *  2. Shirtless / Bare Torso / No Shirt: Caught via Upper Body & Chest Fabric Analyzer (chestSkin >= 0.58)
 *  3. Wearing a Vest (බැනියමක්) / T-shirt: Safely ALLOWED via Chest Fabric Verification (chestSkin < 0.42)
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
      nsfwModel = await nsfwjs.load();
      isNsfwReady = true;
      isNsfwLoading = false;
      console.log("✅ NSFWJS Genital & Torso Protection Engine ready.");
      return true;
    }

    isNsfwLoading = false;
    return false;
  } catch (err) {
    console.warn("[-] NSFWJS model fallback active:", err);
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
 * Measures the ratio of bare skin vs. clothing fabric across the upper body / chest.
 */
function getChestSkinCoverage(ctx: CanvasRenderingContext2D): number {
  const x = Math.floor(224 * 0.20);
  const y = Math.floor(224 * 0.38);
  const w = Math.floor(224 * 0.60);
  const h = Math.floor(224 * 0.44);

  try {
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;
    let skinCount = 0;
    const total = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

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

/**
 * Multi-Scale Video Frame Scanner with Genital Flashing & Torso Coverage Analyzers.
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
    const fullChestSkin = getChestSkinCoverage(fullCtx);
    const fullPreds = await nsfwModel.classify(fullCanvas);

    // =========================================================================
    // Pass 2: Center-Crop Zoom (Focuses on central body / subject)
    // =========================================================================
    const cropWidth = Math.floor(vw * 0.65);
    const cropHeight = Math.floor(vh * 0.65);
    const cropX = Math.floor((vw - cropWidth) / 2);
    const cropY = Math.floor((vh - cropHeight) / 2);

    cropCtx.drawImage(videoElement, cropX, cropY, cropWidth, cropHeight, 0, 0, 224, 224);
    const cropChestSkin = getChestSkinCoverage(cropCtx);
    const cropPreds = await nsfwModel.classify(cropCanvas);

    const maxChestSkin = Math.max(fullChestSkin, cropChestSkin);

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
    // MULTI-VECTOR DECISION LOGIC:
    //
    // VECTOR 1: Direct Genital Flashing / Lower Pelvic Focus / Masturbation / Porn
    // (Porn score >= 0.18 OR Hentai >= 0.35 OR Top Class === 'Porn')
    // -> ALWAYS FLAGGED IMMEDIATELY regardless of chest coverage!
    //
    // VECTOR 2: Shirtless / Bare Chest / No Shirt
    // (maxChestSkin >= 0.58 AND (maxSexy >= 0.20 || maxPorn >= 0.04 || maxChestSkin >= 0.68))
    // -> FLAGGED!
    //
    // VECTOR 3: Extreme Body Exposure
    // (maxSexy >= 0.35 AND minNeutral <= 0.55 AND maxChestSkin >= 0.42)
    // -> FLAGGED!
    //
    // VECTOR 4: Wearing a Vest (බැනියමක්) / T-shirt with fabric on chest
    // (maxChestSkin <= 0.40 AND maxPorn < 0.18)
    // -> ALLOWED!
    // =========================================================================
    const isDirectGenitalPorn =
      maxPorn >= 0.18 ||
      maxHentai >= 0.35 ||
      (fullPreds[0]?.className === "Porn" && maxPorn >= 0.15) ||
      (cropPreds[0]?.className === "Porn" && maxPorn >= 0.15);

    const isShirtless = maxChestSkin >= 0.58 && (maxSexy >= 0.20 || maxPorn >= 0.04 || maxChestSkin >= 0.68);
    const isExtremeExposure = maxSexy >= 0.35 && minNeutral <= 0.55 && maxChestSkin >= 0.42;

    if (isDirectGenitalPorn || isShirtless || isExtremeExposure) {
      return {
        isNsfw: true,
        topCategory: isDirectGenitalPorn
          ? "Genital Flashing / Porn"
          : isShirtless
          ? "Shirtless / Bare Torso"
          : "Explicit Nudity",
        probability: Math.max(maxPorn, maxSexy, maxChestSkin),
        rawPredictions: fullPreds,
      };
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during Multi-Vector NSFW check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
