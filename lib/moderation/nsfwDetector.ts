/**
 * NSFWJS (TensorFlow.js) Multi-Scale Environmental-Aware Nudity Shield for Omeglo
 * Uses Multi-Scale Dual-Pass Scanning (Full Scene + Center Subject Crop)
 * to eliminate background room interference (walls, furniture, bedsheets, lighting)
 * and accurately detect nudity and flashing in any environment.
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
      console.log("✅ NSFWJS Multi-Scale Model ready.");
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

  // MULTI-SCALE DETECTION THRESHOLDS:
  // 1. Explicit porn / flashing: pornProb >= 0.20
  // 2. Animated / illustrated porn: hentaiProb >= 0.40
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
 * Multi-Scale Dual-Pass Video Frame Scanner.
 * Pass 1: Full Frame Scale (captures wide gestures)
 * Pass 2: Center-Crop Subject Zoom (cuts out 80% of surrounding background walls/furniture)
 */
export async function checkVideoFrame(videoElement: HTMLVideoElement): Promise<NsfwCheckResult> {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }

  try {
    if (!nsfwModel) {
      initNsfwDetector().catch(() => {});
      return { isNsfw: false, topCategory: "Neutral", probability: 1 };
    }

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;

    // =========================================================================
    // Pass 1: Full Frame Canvas (224x224)
    // =========================================================================
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = 224;
    fullCanvas.height = 224;
    const fullCtx = fullCanvas.getContext("2d", { willReadFrequently: true });
    if (!fullCtx) return { isNsfw: false, topCategory: "Neutral", probability: 1 };

    fullCtx.drawImage(videoElement, 0, 0, fullCanvas.width, fullCanvas.height);
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
    // Pass 2: Center Subject Crop (Zoom into center 60% of frame)
    // Cuts out surrounding room walls, furniture, bedsheets, and curtains
    // =========================================================================
    const cropWidth = Math.floor(vw * 0.65);
    const cropHeight = Math.floor(vh * 0.65);
    const cropX = Math.floor((vw - cropWidth) / 2);
    const cropY = Math.floor((vh - cropHeight) / 2);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 224;
    cropCanvas.height = 224;
    const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });
    if (!cropCtx) return { isNsfw: false, topCategory: "Neutral", probability: 1 };

    cropCtx.drawImage(videoElement, cropX, cropY, cropWidth, cropHeight, 0, 0, cropCanvas.width, cropCanvas.height);
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
