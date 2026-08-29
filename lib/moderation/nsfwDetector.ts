/**
 * NSFWJS (TensorFlow.js) Intelligent Nudity & NSFW Content Shield for Omeglo
 * Detects genuine nudity, flashing, and pornography while allowing
 * normal clothing (sleeveless vests/බැනියම්, singlets, tank tops, and bare arms).
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
 * Classify video frames with balanced precision.
 * Distinguishes explicit nudity from standard casual wear (e.g. vests / singlets / tank tops).
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

        // SMART BALANCED DECISION MATRIX:
        // 1. Direct Pornography / Explicit Genital Nudity: pornProb >= 0.28
        // 2. Animated Porn: hentaiProb >= 0.45
        // 3. Completely Nude Body (no clothes / bare body): sexyProb >= 0.55 AND neutralProb <= 0.32 AND pornProb >= 0.08
        // 4. Heavy Exposure: pornProb + sexyProb >= 0.70 AND neutralProb <= 0.28
        // 5. Top Class is Porn: top.className === 'Porn' && pornProb >= 0.25
        //
        // NOTE ON VESTS (බැනියම්):
        // Wearing a vest/singlet gives high 'Neutral' score (neutralProb > 0.40) with very low porn (pornProb < 0.12),
        // so it safely PASSES without false alarm!
        const isNsfw =
          pornProb >= 0.28 ||
          hentaiProb >= 0.45 ||
          (top.className === "Porn" && pornProb >= 0.25) ||
          (sexyProb >= 0.55 && neutralProb <= 0.32 && pornProb >= 0.08) ||
          (pornProb + sexyProb >= 0.70 && neutralProb <= 0.28);

        if (isNsfw) {
          return {
            isNsfw: true,
            topCategory: pornProb >= 0.25 ? "Porn" : "Explicit Nudity",
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
