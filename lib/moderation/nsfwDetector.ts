/**
 * NSFWJS (TensorFlow.js) Intelligent Nudity & NSFW Content Shield for Omeglo
 * Detects genuine pornography, explicit nudity, and flashing while allowing
 * normal clothing variations (sleeveless vests/බැනියම්, singlets, tank tops, and bare shoulders).
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
      console.log("✅ NSFWJS Intelligent Nudity Model loaded.");
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
 * Classify video frames with high precision.
 * Distinguishes explicit pornography from standard casual wear (e.g. vests / singlets / tank tops).
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

    if (nsfwModel) {
      const predictions: Array<{ className: "Porn" | "Hentai" | "Sexy" | "Drawing" | "Neutral"; probability: number }> =
        await nsfwModel.classify(canvas);

      if (predictions && predictions.length > 0) {
        const top = predictions[0];
        const pornProb = predictions.find((p) => p.className === "Porn")?.probability || 0;
        const hentaiProb = predictions.find((p) => p.className === "Hentai")?.probability || 0;
        const sexyProb = predictions.find((p) => p.className === "Sexy")?.probability || 0;
        const neutralProb = predictions.find((p) => p.className === "Neutral")?.probability || 0;

        // ACCURATE DISCRIMINATION LOGIC:
        // 1. Explicit Pornography / Genital Nudity: pornProb >= 0.52
        // 2. Animated Porn: hentaiProb >= 0.65
        // 3. Top classification is Porn with clear confidence: top.className === 'Porn' && pornProb >= 0.42
        // Note: Casual wear, sleeveless vests (බැනියම්), singlets, and bare arms score high in 'Sexy' or 'Neutral', which are fully allowed!
        const isExplicitPorn =
          pornProb >= 0.52 ||
          hentaiProb >= 0.65 ||
          (top.className === "Porn" && pornProb >= 0.42 && pornProb > sexyProb);

        if (isExplicitPorn) {
          return {
            isNsfw: true,
            topCategory: "Porn",
            probability: Math.max(pornProb, top.probability),
            rawPredictions: predictions,
          };
        }
      }
    } else {
      // Warmup model in background
      initNsfwDetector().catch(() => {});
    }

    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  } catch (err) {
    console.error("[-] Error during NSFW video check:", err);
    return { isNsfw: false, topCategory: "Neutral", probability: 1 };
  }
}
