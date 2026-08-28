/**
 * TensorFlow.js Toxicity Model (Google) for Omeglo
 * Detects severe toxicity, insults, threats, identity attacks, and sexually explicit text.
 * Dynamically loaded in the background with zero impact on initial SEO.
 */

let isToxicityLoading = false;
let isToxicityReady = false;
let toxicityModel: any = null;

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
 * Dynamically load TensorFlow.js and Toxicity Model
 */
export async function initToxicityDetector(): Promise<boolean> {
  if (isToxicityReady && toxicityModel) return true;
  if (typeof window === "undefined") return false;

  if (isToxicityLoading) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (isToxicityReady) {
          clearInterval(interval);
          resolve(true);
        }
      }, 150);
    });
  }

  isToxicityLoading = true;

  try {
    // 1. Ensure TensorFlow.js is loaded
    if (!(window as any).tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
    }

    // 2. Load Toxicity Model script
    if (!(window as any).toxicity) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/toxicity@1.2.2/dist/toxicity.min.js");
    }

    const toxicity = (window as any).toxicity;
    if (toxicity) {
      // Threshold for prediction (0.85 = 85% confidence)
      const threshold = 0.85;
      toxicityModel = await toxicity.load(threshold, [
        "identity_attack",
        "insult",
        "obscene",
        "severe_toxicity",
        "sexual_explicit",
        "threat",
        "toxicity",
      ]);
      isToxicityReady = true;
      isToxicityLoading = false;
      console.log("✅ TensorFlow.js Toxicity Model (Google) loaded.");
      return true;
    }

    isToxicityLoading = false;
    return false;
  } catch (err) {
    console.warn("[-] Could not load Toxicity model:", err);
    isToxicityLoading = false;
    return false;
  }
}

export interface ToxicityResult {
  isToxic: boolean;
  flaggedLabels: string[];
  maxScore: number;
}

/**
 * Classify a text message for toxicity and abusive content
 */
export async function checkTextToxicity(text: string): Promise<ToxicityResult> {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { isToxic: false, flaggedLabels: [], maxScore: 0 };
  }

  if (!toxicityModel) {
    initToxicityDetector().catch(() => {});
    return { isToxic: false, flaggedLabels: [], maxScore: 0 };
  }

  try {
    const predictions = await toxicityModel.classify([text]);
    const flaggedLabels: string[] = [];
    let maxScore = 0;

    for (const pred of predictions) {
      const match = pred.results[0]?.match;
      const prob = pred.results[0]?.probabilities[1] || 0;
      if (prob > maxScore) maxScore = prob;

      if (match === true) {
        flaggedLabels.push(pred.label);
      }
    }

    return {
      isToxic: flaggedLabels.length > 0,
      flaggedLabels,
      maxScore,
    };
  } catch (err) {
    console.error("[-] Error classifying text with Toxicity Model:", err);
    return { isToxic: false, flaggedLabels: [], maxScore: 0 };
  }
}
