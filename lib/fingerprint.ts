/**
 * Browser & Device Fingerprint Utility for Omeglo
 * Collects persistent hardware and browser characteristics to accurately identify and ban bad actors
 * even if they change peer_id, reload the browser, or switch networks.
 */

export interface DeviceFingerprint {
  deviceId: string;
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  timezoneOffset: number;
  screenResolution: string;
  colorDepth: number;
  pixelRatio: number;
  cpuCores: number;
  deviceMemory: number;
  gpuRenderer: string;
  gpuVendor: string;
  canvasHash: string;
}

/**
 * Generate or retrieve a persistent Device ID from localStorage
 */
function getPersistentDeviceId(): string {
  if (typeof window === "undefined") return "server-side";

  const STORAGE_KEY = "omeglo_device_uuid";
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      deviceId = "dev_" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return "dev_ephemeral_" + Math.random().toString(36).substring(2);
  }
}

/**
 * Extract GPU WebGL Renderer info
 */
function getGpuInfo(): { renderer: string; vendor: string } {
  if (typeof window === "undefined") return { renderer: "unknown", vendor: "unknown" };

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { renderer: "no-webgl", vendor: "no-webgl" };

    const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return { renderer: "generic-webgl", vendor: "generic-webgl" };

    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown";
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "unknown";

    return { renderer, vendor };
  } catch {
    return { renderer: "unknown", vendor: "unknown" };
  }
}

/**
 * Generate lightweight canvas fingerprint hash
 */
function getCanvasFingerprint(): string {
  if (typeof window === "undefined") return "none";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "none";

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Omeglo-FP-2026", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Omeglo-FP-2026", 4, 17);

    const dataUrl = canvas.toDataURL();
    // Simple 32-bit FNV-1a hash
    let hash = 0x811c9dc5;
    for (let i = 0; i < dataUrl.length; i++) {
      hash ^= dataUrl.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
  } catch {
    return "error";
  }
}

/**
 * Collect full browser fingerprint snapshot
 */
export function getBrowserFingerprint(): DeviceFingerprint {
  if (typeof window === "undefined") {
    return {
      deviceId: "server",
      userAgent: "",
      platform: "",
      language: "",
      timezone: "",
      timezoneOffset: 0,
      screenResolution: "",
      colorDepth: 0,
      pixelRatio: 1,
      cpuCores: 0,
      deviceMemory: 0,
      gpuRenderer: "",
      gpuVendor: "",
      canvasHash: "",
    };
  }

  const gpu = getGpuInfo();
  const nav = navigator as any;

  return {
    deviceId: getPersistentDeviceId(),
    userAgent: nav.userAgent || "",
    platform: nav.platform || nav.userAgentData?.platform || "unknown",
    language: nav.language || nav.languages?.[0] || "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    timezoneOffset: new Date().getTimezoneOffset(),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth || 24,
    pixelRatio: window.devicePixelRatio || 1,
    cpuCores: nav.hardwareConcurrency || 0,
    deviceMemory: nav.deviceMemory || 0,
    gpuRenderer: gpu.renderer,
    gpuVendor: gpu.vendor,
    canvasHash: getCanvasFingerprint(),
  };
}
