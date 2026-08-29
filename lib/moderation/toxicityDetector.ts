/**
 * TensorFlow.js Toxicity Model (Google) & Smart Threat/Harassment Shield for Omeglo
 * Detects severe toxicity, death threats, extortion, identity attacks, and abusive language.
 * Two-Tier Architecture:
 *  - Tier 1: Zero-Delay Threat & Blackmail Regex Pattern Engine
 *  - Tier 2: Google TensorFlow.js Toxicity Neural Network
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
      }, 100);
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
      // Sensitive threshold (0.75 for robust threat/insult detection)
      const threshold = 0.75;
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
      console.log("✅ TensorFlow.js Toxicity Model (Google) ready.");
      return true;
    }

    isToxicityLoading = false;
    return false;
  } catch (err) {
    console.warn("[-] Toxicity model fallback active:", err);
    isToxicityLoading = false;
    return false;
  }
}

export interface ToxicityResult {
  isToxic: boolean;
  isSevereThreat: boolean;
  flaggedLabels: string[];
  maxScore: number;
}

// Regex patterns for immediate zero-delay detection of threats & harassment
const SEVERE_THREAT_PATTERNS = [
  /\b(kill|murder|shoot|stab|choke|strangle)\s+(you|u|ur|your)\b/i,
  /\b(i\s*will\s*(kill|hunt|find|destroy|end)\s*(you|u))\b/i,
  /\b(die\s*(bitch|whore|bastard|motherfucker)?)\b/i,
  /\b(leak|expose|post|share)\s*(your|ur)\s*(nudes|pics|video|photos|address|details)\b/i,
  /\b(pay\s*me|send\s*money)\s*or\s*(i\s*will|i'll)\b/i,
  /\b(rape|assault)\s+(you|u)\b/i,
  /\b(doxx|dox)\s*(you|u)\b/i,
  /\b(bomb|terrorist|massacre)\b/i,
  /\b(go\s*die|kill\s*yourself|kys)\b/i,
];

/**
 * Classify a text message for threats, blackmail, and toxicity
 */
export async function checkTextToxicity(text: string): Promise<ToxicityResult> {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { isToxic: false, isSevereThreat: false, flaggedLabels: [], maxScore: 0 };
  }

  const cleanText = text.trim();

  // ==========================================
  // Tier 1: Instant Zero-Delay Threat Regex Check
  // ==========================================
  for (const pattern of SEVERE_THREAT_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isToxic: true,
        isSevereThreat: true,
        flaggedLabels: ["threat", "severe_toxicity"],
        maxScore: 0.99,
      };
    }
  }

  // ==========================================
  // Tier 2: Google TensorFlow.js Toxicity Model
  // ==========================================
  if (toxicityModel) {
    try {
      const predictions = await toxicityModel.classify([cleanText]);
      const flaggedLabels: string[] = [];
      let maxScore = 0;
      let isSevereThreat = false;

      for (const pred of predictions) {
        const match = pred.results[0]?.match;
        const prob = pred.results[0]?.probabilities[1] || 0;
        if (prob > maxScore) maxScore = prob;

        if (match === true || prob > 0.70) {
          flaggedLabels.push(pred.label);
          if (pred.label === "threat" || pred.label === "severe_toxicity") {
            isSevereThreat = true;
          }
        }
      }

      return {
        isToxic: flaggedLabels.length > 0,
        isSevereThreat,
        flaggedLabels,
        maxScore,
      };
    } catch (err) {
      console.error("[-] Error classifying text with Toxicity Model:", err);
    }
  } else {
    // Warmup in background
    initToxicityDetector().catch(() => {});
  }

  return { isToxic: false, isSevereThreat: false, flaggedLabels: [], maxScore: 0 };
}
