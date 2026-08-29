"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { io, Socket } from "socket.io-client";
import type { DataConnection, MediaConnection } from "peerjs";
import {
  Play,
  Square,
  SkipForward,
  Mic,
  MicOff,
  Video,
  Send,
  User,
  Users,
  Shield,
  MessageSquare,
  Info,
  RotateCcw,
  GripHorizontal,
  Radio,
  Check,
  Edit2,
  Camera,
  AlertTriangle,
  Lock,
  Settings,
  X,
  Volume2,
  VolumeX,
  SwitchCamera,
  Signal,
  SignalMedium,
  SignalLow,
  WifiOff,
  Activity,
  Flag,
  ShieldAlert,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  Scan,
} from "lucide-react";
import { getBrowserFingerprint } from "@/lib/fingerprint";
import { filterMessage } from "@/lib/moderation/regexFilter";
import { initToxicityDetector, checkTextToxicity } from "@/lib/moderation/toxicityDetector";

type ChatMessage = {
  id: string;
  sender: "you" | "stranger" | "system";
  text: string;
  timestamp: string;
  warning?: string;
  filtered?: boolean;
};

// Helper to convert 2-letter ISO Country Code to Emoji Flag and localized Country Name
function getCountryDetails(countryCode?: string | null): { flag: string; name: string } | null {
  if (!countryCode || countryCode.length !== 2) return null;
  const code = countryCode.toUpperCase();
  if (code === "XX" || code === "T1" || code === "UN" || code === "UNKNOWN") return null;
  try {
    const flag = code
      .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const name = regionNames.of(code) || code;
    return { flag, name };
  } catch {
    return null;
  }
}

type ConnectionStatus = "idle" | "searching" | "connected" | "disconnected";

type UniversalSocket = {
  emit: (event: string, data?: any) => void;
  on: (event: string, fn: (data?: any) => void) => void;
  close: () => void;
  disconnect: () => void;
  id?: string;
};

function createUniversalSocket(rawUrl: string): UniversalSocket {
  const listeners: Record<string, Function[]> = {};

  let wsUrl = rawUrl;
  if (wsUrl.startsWith("http://")) {
    wsUrl = wsUrl.replace("http://", "ws://");
  } else if (wsUrl.startsWith("https://")) {
    wsUrl = wsUrl.replace("https://", "wss://");
  }

  if (!wsUrl.includes("ws://") && !wsUrl.includes("wss://")) {
    wsUrl = "wss://" + wsUrl;
  }

  console.log("Connecting Native WebSocket to Cloudflare Edge:", wsUrl);
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Native WebSocket Connected!");
    (listeners["connect"] || []).forEach((fn) => fn());
  };

  ws.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      const event = parsed.event;
      const data = parsed.data;
      if (event && listeners[event]) {
        listeners[event].forEach((fn) => fn(data));
      }
    } catch (err) {
      console.error("WS Parse error:", err);
    }
  };

  ws.onclose = () => {
    console.log("Native WebSocket Disconnected.");
    (listeners["disconnect"] || []).forEach((fn) => fn());
  };

  ws.onerror = (err) => {
    console.error("Native WebSocket Error:", err);
    (listeners["error"] || []).forEach((fn) => fn(err));
  };

  return {
    emit: (event: string, data?: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      } else {
        const checkInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event, data }));
            clearInterval(checkInterval);
          }
        }, 100);
      }
    },
    on: (event: string, fn: (data?: any) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    close: () => {
      ws.close();
    },
    disconnect: () => {
      ws.close();
    },
  };
}
type Gender = "male" | "female" | null;
type MatchPreference = "any" | "female" | "male";
type NetworkQuality = "good" | "fair" | "poor" | "offline";
type ChatMode = "video" | "text";

// Synthesize pleasant zero-dependency Web Audio SFX (Match chime, Message bubble pop, Disconnect tone)
function playAudioSFX(type: "match" | "message" | "leave", isMuted: boolean) {
  if (isMuted || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "match") {
      // Cheerful Two-Tone Match Chime (E5 659Hz -> B5 987Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (type === "message") {
      // Soft Bubble Pop (880Hz -> 1320Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "leave") {
      // Gentle Disconnect Low Tone (440Hz -> 280Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch { }
}

// Low-Bandwidth & Weak-Signal WebRTC Network Optimizations (Smooth 30fps, No-Freeze Adaptive Bitrate)
function applyLowLatencyNetworkOptimizations(call: MediaConnection | null) {
  if (!call || !(call as any).peerConnection) return;
  const pc: RTCPeerConnection = (call as any).peerConnection;

  const optimizeSenders = () => {
    try {
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        if (!sender.track) return;

        if (sender.track.kind === "video") {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            // Prioritize smooth frame rate over freezing HD frames under low signal
            params.degradationPreference = "maintain-framerate";

            // Adaptive Bitrate: 950kbps high ceiling, fluid 30fps without stutter
            params.encodings[0].maxBitrate = 950000;
            params.encodings[0].maxFramerate = 30;
            params.encodings[0].scaleResolutionDownBy = 1.0;

            sender.setParameters(params).catch(() => { });
          } catch { }
        } else if (sender.track.kind === "audio") {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            // Opus Voice HD: 32kbps is crystal clear and uses minimal bandwidth
            params.encodings[0].maxBitrate = 32000;
            sender.setParameters(params).catch(() => { });
          } catch { }
        }
      });
    } catch { }
  };

  // Run optimization after slight delay to ensure SDP negotiation completes
  setTimeout(optimizeSenders, 400);
  setTimeout(optimizeSenders, 1200);
}

// Eye-friendly Multicolor Omeglo Brand Wordmark
function OmegloWordmark({ size = "text-[19px]" }: { size?: string }) {
  return (
    <span className={`font-bold tracking-[0.03em] select-none inline-flex items-center space-x-[0.6px] font-sans antialiased ${size}`}>
      <span className="text-[#2563eb]">O</span>
      <span className="text-[#f43f5e]">m</span>
      <span className="text-[#f59e0b]">e</span>
      <span className="text-[#10b981]">g</span>
      <span className="text-[#6366f1]">l</span>
      <span className="text-[#0d9488]">o</span>
    </span>
  );
}

// Lightweight Real-time TV Static Noise Canvas (Zero network overhead, 60fps retro noise)
function TvStaticCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;

    const render = () => {
      for (let i = 0; i < len; i++) {
        const gray = Math.floor(Math.random() * 85) + 20;
        buffer32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
      }
      ctx.putImageData(imgData, 0, 0);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover opacity-70 mix-blend-screen pointer-events-none"
    />
  );
}

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  "https://omeglo-backend.pocoma3486.workers.dev";

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [chatMode, setChatMode] = useState<ChatMode>("video");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      sender: "system",
      text: "Welcome to Omeglo! Choose Video or Text mode and click 'Start' to begin chatting.",
      timestamp: "Just now",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isMicMutedRef = useRef(isMicMuted);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const isSoundMutedRef = useRef(isSoundMuted);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState("1");
  const [strangerGender, setStrangerGender] = useState<Gender>(null);
  const [strangerCountry, setStrangerCountry] = useState<string | null>(null);
  const [isStrangerMuted, setIsStrangerMuted] = useState(false);

  // Keep isMicMutedRef and hardware audio tracks always strictly in sync
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  // Keep isSoundMutedRef in sync without triggering re-renders
  useEffect(() => {
    isSoundMutedRef.current = isSoundMuted;
  }, [isSoundMuted]);

  const chatModeRef = useRef(chatMode);
  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);

  // Network & Signal Quality Assessment States
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("good");
  const [networkStats, setNetworkStats] = useState<{ downlink: number; rtt: number; reason?: string }>({
    downlink: 5,
    rtt: 50,
  });
  const [showWeakSignalModal, setShowWeakSignalModal] = useState(false);
  const [weakSignalWarning, setWeakSignalWarning] = useState<string | null>(null);
  const [liveCallQuality, setLiveCallQuality] = useState<"good" | "fair" | "poor">("good");

  // Media Streams, Previews & Permission State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteMicroPreview, setRemoteMicroPreview] = useState<string | null>(null);
  const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);

  // User Gender State & First-time Visit Modal
  const [userGender, setUserGender] = useState<Gender>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [tempSelectedGender, setTempSelectedGender] = useState<"male" | "female">("male");

  // Match Preference / Looking For Filter (Any / Female / Male)
  const [matchPreference, setMatchPreference] = useState<MatchPreference>("any");

  // Next Button Spam Protection & Search Lock State
  const [isNextDisabled, setIsNextDisabled] = useState(false);
  const nextCooldownRef = useRef<number>(0);

  // Draggable PiP State, Dynamic Edge/Corner Resizing & WhatsApp-Style Feed Swapping
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const [pipWidth, setPipWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showPipControls, setShowPipControls] = useState(false);
  const [isSwappedFeeds, setIsSwappedFeeds] = useState<boolean>(false);
  const pipControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasDraggedFarRef = useRef(false);

  // Report Modal & Notification State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>("nudity");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportToast, setReportToast] = useState<{ show: boolean; message: string } | null>(null);

  // AI Moderation & Safety States (Face Detection & NSFW Shield)
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [aiModerationToast, setAiModerationToast] = useState<{
    show: boolean;
    message: string;
    type: "warning" | "error" | "info";
  } | null>(null);

  const showModerationAlert = useCallback(
    (message: string, type: "warning" | "error" | "info" = "warning") => {
      setAiModerationToast({ show: true, message, type });
      setTimeout(() => {
        setAiModerationToast(null);
      }, 4500);
    },
    []
  );

  // Video & WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const currentPartnerPeerIdRef = useRef<string | null>(null);
  const targetReportPeerIdRef = useRef<string | null>(null);
  const hasAutoReportedRef = useRef<boolean>(false);
  const socketRef = useRef<any>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    initialWidth: number;
  }>({ startX: 0, startY: 0, initialWidth: 130 });

  // Add system message
  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        sender: "system",
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  // Network Quality Assessor (Evaluates downlink, latency, and effective connection speed)
  const assessNetworkQuality = useCallback(async (): Promise<{
    quality: NetworkQuality;
    downlink: number;
    rtt: number;
    reason?: string;
  }> => {
    if (typeof navigator === "undefined") {
      return { quality: "good", downlink: 10, rtt: 50 };
    }

    if (!navigator.onLine) {
      const res = {
        quality: "offline" as NetworkQuality,
        downlink: 0,
        rtt: 9999,
        reason: "No internet connection detected (අන්තර්ජාල සම්බන්ධතාවයක් නොමැත).",
      };
      setNetworkQuality("offline");
      setNetworkStats(res);
      return res;
    }

    // 1. Check Network Information API (Chrome / Android / Edge)
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (conn) {
      const effectiveType = conn.effectiveType;
      const downlink = typeof conn.downlink === "number" ? conn.downlink : 5;
      const rtt = typeof conn.rtt === "number" ? conn.rtt : 60;

      if (effectiveType === "slow-2g" || (downlink < 0.25 && rtt > 1500)) {
        const res = {
          quality: "poor" as NetworkQuality,
          downlink,
          rtt,
          reason: "Internet speed is too slow (< 0.25 Mbps) for video streaming. (සිග්නල් ප්‍රමාණවත් නොවේ)",
        };
        setNetworkQuality("poor");
        setNetworkStats(res);
        return res;
      }

      if (effectiveType === "2g" || downlink < 0.7 || rtt > 600) {
        const res = {
          quality: "fair" as NetworkQuality,
          downlink,
          rtt,
          reason: "Weak connection detected. Minimum speed reached — video quality auto-adjusted.",
        };
        setNetworkQuality("fair");
        setNetworkStats(res);
        return res;
      }

      const res = { quality: "good" as NetworkQuality, downlink, rtt };
      setNetworkQuality("good");
      setNetworkStats(res);
      return res;
    }

    // 2. Default browser online state (zero HTTP requests)
    const res = { quality: "good" as NetworkQuality, downlink: 10, rtt: 50 };
    setNetworkQuality("good");
    setNetworkStats(res);
    return res;
  }, []);

  // Monitor network connection changes in background (Event-driven, 0 HTTP overhead)
  useEffect(() => {
    assessNetworkQuality();

    const handleOnline = () => assessNetworkQuality();
    const handleOffline = () => {
      setNetworkQuality("offline");
      setNetworkStats({ downlink: 0, rtt: 9999, reason: "You are offline." });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (conn && conn.addEventListener) {
      conn.addEventListener("change", handleOnline);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener("change", handleOnline);
      }
    };
  }, [assessNetworkQuality]);

  // Real-time In-Call WebRTC Connection Quality & Packet Loss Monitoring
  useEffect(() => {
    if (status !== "connected" || !activeCallRef.current) return;

    const interval = setInterval(async () => {
      const pc: RTCPeerConnection = (activeCallRef.current as any)?.peerConnection;
      if (!pc) return;

      try {
        const stats = await pc.getStats();
        let highPacketLoss = false;
        let highRtt = false;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 1;
            const lossRate = packetsLost / (packetsLost + packetsReceived);
            if (lossRate > 0.2) highPacketLoss = true;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rtt = report.currentRoundTripTime || 0;
            if (rtt > 1.2) highRtt = true;
          }
        });

        if (highPacketLoss || highRtt) {
          setLiveCallQuality("poor");
        } else {
          setLiveCallQuality("good");
        }
      } catch { }
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream && chatMode === "video") {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch((err) => {
          console.warn("Local video play warning:", err);
        });
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, chatMode, isSwappedFeeds]);

  // Bind remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteStream && chatMode === "video") {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn("Remote video play warning:", err);
        });
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream, chatMode, isSwappedFeeds]);

  // Ultra-Lightweight P2P Micro-Snapshot (16x12 px ~ 200 Bytes) to show instant ambient colors before video frames arrive
  const captureMicroThumbnail = useCallback((): string | null => {
    if (!localVideoRef.current || !localStreamRef.current) return null;
    try {
      const video = localVideoRef.current;
      if (!video.videoWidth || !video.videoHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 12;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, 16, 12);
      return canvas.toDataURL("image/webp", 0.1) || canvas.toDataURL("image/jpeg", 0.15);
    } catch {
      return null;
    }
  }, []);

  const sendMicroThumbnail = useCallback((conn: DataConnection) => {
    if (chatModeRef.current !== "video" || !conn.open) return;
    const tryCapture = (attempt = 0) => {
      const thumb = captureMicroThumbnail();
      if (thumb && conn.open) {
        try {
          conn.send(JSON.stringify({ type: "micro-preview", preview: thumb }));
        } catch { }
      } else if (attempt < 8 && conn.open) {
        setTimeout(() => tryCapture(attempt + 1), 100);
      }
    };
    tryCapture();
  }, [captureMicroThumbnail]);

  // Setup PeerJS P2P DataChannel Connection for direct peer-to-peer live text chat & typing indicators
  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;

    conn.on("open", () => {
      console.log("🟢 PeerJS P2P DataChannel connected and ready for live chat.");
      sendMicroThumbnail(conn);
      try {
        conn.send(JSON.stringify({ type: "mic-status", isMuted: isMicMutedRef.current }));
      } catch { }
    });

    conn.on("data", (data: unknown) => {
      if (typeof data === "string") {
        // 1. Check if packet is JSON control message
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.type === "mic-status") {
            setIsStrangerMuted(Boolean(parsed.isMuted));
            return;
          }
          if (parsed && parsed.type === "typing") {
            setIsStrangerTyping(parsed.isTyping);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (parsed.isTyping) {
              typingTimerRef.current = setTimeout(() => {
                setIsStrangerTyping(false);
              }, 2500);
            }
            return;
          }
          if (parsed && parsed.type === "micro-preview" && parsed.preview) {
            setRemoteMicroPreview(parsed.preview);
            return;
          }
        } catch { }

        // 2. Regular Text Message (Filter & Sanitize)
        setIsStrangerTyping(false);
        playAudioSFX("message", isSoundMutedRef.current);

        const filterRes = filterMessage(data);
        const cleanIncomingText = filterRes.cleanText;

        // Background Toxicity & Severe Threat check on incoming text
        checkTextToxicity(data).then((toxRes) => {
          if (toxRes.isSevereThreat) {
            showModerationAlert("⚠️ Threat detected! Stranger auto-reported and quarantined.", "error");
            socketRef.current?.emit("report-partner", {
              targetPeerId: currentPartnerPeerIdRef.current,
              reason: "harassment",
              details: `AI Auto-Detected Threat/Extortion in text: "${data.slice(0, 80)}"`,
            });
            setTimeout(() => {
              handleNext();
            }, 1400);
          } else if (toxRes.isToxic) {
            showModerationAlert("⚠️ Warning: Inappropriate language detected from stranger.", "warning");
          }
        }).catch(() => { });

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: "stranger",
            text: cleanIncomingText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Auto-scroll whole page down to chat & focus input ONLY when a real message arrives from stranger
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          inputRef.current?.focus();
        }, 60);
      }
    });

    conn.on("close", () => {
      console.log("🔴 PeerJS P2P Data connection closed.");
      setIsStrangerTyping(false);
    });

    conn.on("error", (err) => {
      console.warn("PeerJS DataConnection error:", err);
    });
  }, [sendMicroThumbnail]);

  const activeStreamsRef = useRef<Set<MediaStream>>(new Set());

  // Completely stop and release local Camera and Microphone hardware
  const stopLocalStream = useCallback(() => {
    // 1. Stop all registered MediaStreams in activeStreamsRef
    activeStreamsRef.current.forEach((stream) => {
      try {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch { }
        });
      } catch { }
    });
    activeStreamsRef.current.clear();

    // 2. Stop all tracks in localStreamRef
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch { }
        });
      } catch { }
      localStreamRef.current = null;
    }

    // 3. Stop all tracks in localVideoRef srcObject & pause element
    if (localVideoRef.current) {
      try {
        if (localVideoRef.current.srcObject) {
          const stream = localVideoRef.current.srcObject as MediaStream;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
                track.enabled = false;
              } catch { }
            });
          }
        }
        localVideoRef.current.pause();
        localVideoRef.current.srcObject = null;
        localVideoRef.current.src = "";
      } catch { }
    }

    // 4. Stop all tracks in remoteVideoRef srcObject & pause element
    if (remoteVideoRef.current) {
      try {
        if (remoteVideoRef.current.srcObject) {
          const rStream = remoteVideoRef.current.srcObject as MediaStream;
          if (rStream && rStream.getTracks) {
            rStream.getTracks().forEach((track) => {
              try {
                track.stop();
                track.enabled = false;
              } catch { }
            });
          }
        }
        remoteVideoRef.current.pause();
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.src = "";
      } catch { }
    }

    // 5. Stop all tracks on active WebRTC RTCRtpSenders & close media calls
    if (activeCallRef.current) {
      try {
        const pc: RTCPeerConnection = (activeCallRef.current as any).peerConnection;
        if (pc && pc.getSenders) {
          pc.getSenders().forEach((sender) => {
            if (sender.track) {
              try {
                sender.track.stop();
                sender.track.enabled = false;
              } catch { }
            }
          });
        }
        activeCallRef.current.close();
      } catch { }
      activeCallRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // Request & Initialize Local Real Camera and Microphone (MANDATORY IN VIDEO MODE ONLY)
  const initLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    // 0. Strict Guard: If in Text mode, NEVER touch or access Camera/Mic
    if (chatModeRef.current === "text") {
      stopLocalStream();
      return null;
    }

    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHasCameraPermission(false);
      return null;
    }

    // 1. Primary Attempt: High-performance 30fps video + Audio DSP (Echo Cancellation, Noise Suppression, AGC)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Strict race condition check: if user switched to text mode while waiting for getUserMedia
      if ((chatModeRef.current as string) === "text") {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch { }
        });
        return null;
      }

      activeStreamsRef.current.add(stream);

      // Strictly apply current mute preference to newly acquired audio tracks
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMutedRef.current;
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setHasCameraPermission(true);
      setShowPermissionModal(false);
      return stream;
    } catch (err1) {
      console.warn("Attempt 1 (high-performance video+audio) failed:", err1);

      // 2. Secondary Attempt: Standard constraints with audio processing
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        if ((chatModeRef.current as string) === "text") {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
              track.enabled = false;
            } catch { }
          });
          return null;
        }

        activeStreamsRef.current.add(stream);

        // Strictly apply current mute preference
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMicMutedRef.current;
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasCameraPermission(true);
        setShowPermissionModal(false);
        return stream;
      } catch (err2) {
        console.warn("Attempt 2 (standard video+audio) failed:", err2);

        // 3. Tertiary Attempt: Video Only
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
            audio: false,
          });

          if ((chatModeRef.current as string) === "text") {
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
                track.enabled = false;
              } catch { }
            });
            return null;
          }

          activeStreamsRef.current.add(stream);

          localStreamRef.current = stream;
          setLocalStream(stream);
          setHasCameraPermission(true);
          setShowPermissionModal(false);
          setIsMicMuted(true);
          return stream;
        } catch (err3) {
          console.warn("Attempt 3 (video-only) failed:", err3);
          setHasCameraPermission(false);
          return null;
        }
      }
    }
  }, [stopLocalStream]);

  // Clean up current active call and remote streams
  const cleanupCall = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.close();
      activeCallRef.current = null;
    }
    if (dataConnRef.current) {
      dataConnRef.current.close();
      dataConnRef.current = null;
    }
    setIsStrangerTyping(false);
    setIsStrangerMuted(false);
    setLiveCallQuality("good");
    setRemoteStream(null);
    setRemoteMicroPreview(null);
    setIsRemoteVideoPlaying(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setStrangerGender(null);
    setStrangerCountry(null);
    hasAutoReportedRef.current = false;
  }, []);

  // Initialize Socket.io and PeerJS
  useEffect(() => {
    // Pre-warm text toxicity AI moderation model in background
    initToxicityDetector().catch(() => { });

    // 1. Check localStorage for preferences
    try {
      const savedGender = localStorage.getItem("omeglo_user_gender") as Gender;
      if (savedGender === "male" || savedGender === "female") {
        setUserGender(savedGender);
        setTempSelectedGender(savedGender);
      } else {
        setShowGenderModal(true);
      }

      const savedPref = localStorage.getItem("omeglo_match_pref") as MatchPreference;
      if (savedPref === "any" || savedPref === "female" || savedPref === "male") {
        setMatchPreference(savedPref);
      }

      const savedMode = localStorage.getItem("omeglo_chat_mode") as ChatMode;
      if (savedMode === "video" || savedMode === "text") {
        setChatMode(savedMode);
        chatModeRef.current = savedMode;
        if (savedMode === "text") {
          stopLocalStream();
        }
      }

      const savedSoundMuted = localStorage.getItem("omeglo_sound_muted");
      if (savedSoundMuted !== null) {
        const isMuted = savedSoundMuted === "true";
        setIsSoundMuted(isMuted);
        isSoundMutedRef.current = isMuted;
      }
    } catch {
      setShowGenderModal(true);
    }

    // 2. Initialize Native Cloudflare Edge WebSocket Connection
    const socket = createUniversalSocket(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to Cloudflare Edge Matchmaking Server!");
    });

    socket.on("online-count", (count: number) => {
      setOnlineCount(count.toLocaleString());
    });

    socket.on("waiting-in-queue", () => {
      setStatus("searching");
    });

    // 3. Initialize PeerJS (WebRTC with Google STUN)
    let peerInstance: any = null;

    const initPeer = async () => {
      const { default: Peer } = await import("peerjs");

      const peer = new Peer({
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        },
      });

      peer.on("open", (id) => {
        console.log("My PeerJS ID:", id);
        myPeerIdRef.current = id;
      });

      // Handle Incoming Call from Stranger (In Video Mode Only)
      peer.on("call", async (incomingCall) => {
        // Strictly reject incoming video calls if current user is in Text Mode
        if (chatModeRef.current === "text") {
          console.warn("Rejected incoming video call: current mode is Text Only");
          incomingCall.close();
          return;
        }

        const stream = localStreamRef.current || (await initLocalStream());
        if (stream) {
          incomingCall.answer(stream);
        } else {
          incomingCall.answer();
        }

        incomingCall.on("stream", (incomingRemoteStream) => {
          setRemoteStream(incomingRemoteStream);
        });

        applyLowLatencyNetworkOptimizations(incomingCall);
        activeCallRef.current = incomingCall;
      });

      // Handle Incoming Text Chat DataConnection
      peer.on("connection", (conn) => {
        setupDataConnection(conn);
      });

      peer.on("error", (err) => {
        console.error("PeerJS Error:", err);
      });

      peerRef.current = peer;
      peerInstance = peer;
    };

    initPeer();

    // 4. Socket Matchmaking Events
    socket.on("match-found", async ({ partnerPeerId, partnerGender, partnerCountry, initiator, mode }: any) => {
      console.log(`Match Found with Peer: ${partnerPeerId}, Initiator: ${initiator}, Mode: ${mode}, Country: ${partnerCountry}`);
      currentPartnerPeerIdRef.current = partnerPeerId;
      cleanupCall();
      setStatus("connected");
      setStrangerGender(partnerGender);
      setStrangerCountry(partnerCountry || null);
      setRemoteMicroPreview(null);
      setIsRemoteVideoPlaying(false);
      setInputMessage("");
      setIsStrangerTyping(false);
      playAudioSFX("match", isSoundMutedRef.current);

      const geo = getCountryDetails(partnerCountry);
      const countrySnippet = geo ? ` from ${geo.flag} ${geo.name}` : "";

      // Clear previous chats on new connection in both Video & Text modes
      const connectMsg: ChatMessage = {
        id: "sys-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        sender: "system",
        text: `Connected with a stranger${countrySnippet} in ${mode === "text" ? "Text" : "Video"} Chat! Say hi.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([connectMsg]);

      // In Video Mode: Establish WebRTC Video Stream
      if (mode !== "text" && chatModeRef.current === "video") {
        const stream = localStreamRef.current || (await initLocalStream());

        if (initiator && peerRef.current && partnerPeerId) {
          if (stream) {
            const call = peerRef.current.call(partnerPeerId, stream);
            call?.on("stream", (partnerStream: MediaStream) => {
              setRemoteStream(partnerStream);
            });
            applyLowLatencyNetworkOptimizations(call);
            activeCallRef.current = call;
          }
        }
      }

      // In Both Modes: Establish P2P DataChannel for Instant Text Chat
      if (initiator && peerRef.current && partnerPeerId) {
        const conn = peerRef.current.connect(partnerPeerId);
        if (conn) {
          setupDataConnection(conn);
        }
      }
    });

    socket.on("partner-disconnected", () => {
      cleanupCall();
      setStatus("disconnected");
      setAutoNextCountdown(3);
      playAudioSFX("leave", isSoundMutedRef.current);
      addSystemMessage("Stranger has disconnected. Finding next stranger in 3s...");
    });

    socket.on("chat-stopped", () => {
      cleanupCall();
      setAutoNextCountdown(null);
      setStatus("disconnected");
      addSystemMessage("You have stopped the chat.");
    });

    return () => {
      socket.disconnect();
      if (peerInstance) {
        peerInstance.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [addSystemMessage, cleanupCall, initLocalStream, setupDataConnection]);

  // Manage Camera hardware lifecycle strictly based on chatMode
  useEffect(() => {
    if (chatMode === "text") {
      stopLocalStream();
    } else if (chatMode === "video" && !showGenderModal) {
      initLocalStream();
    }
  }, [showGenderModal, chatMode, initLocalStream, stopLocalStream]);

  // Save selected gender & trigger camera access
  const handleSaveGender = (gender: "male" | "female") => {
    try {
      localStorage.setItem("omeglo_user_gender", gender);
    } catch { }
    setUserGender(gender);
    setShowGenderModal(false);
    if (chatMode === "video") {
      initLocalStream();
    }
  };

  // Change match preference
  const handleMatchPreferenceChange = (pref: MatchPreference) => {
    setMatchPreference(pref);
    try {
      localStorage.setItem("omeglo_match_pref", pref);
    } catch { }
  };

  // Switch Chat Mode (Video Chat vs Text Only)
  const handleModeChange = (mode: ChatMode) => {
    if (status !== "idle") {
      handleStop();
    }
    setChatMode(mode);
    chatModeRef.current = mode;
    try {
      localStorage.setItem("omeglo_chat_mode", mode);
    } catch { }

    if (mode === "video") {
      initLocalStream();
    } else if (mode === "text") {
      // Completely release camera and microphone hardware tracks in Text mode
      stopLocalStream();
      cleanupCall();
    }
  };

  // Auto-scroll chat internally (only inside the chat box container, preventing whole-page scrolling)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isStrangerTyping]);

  // Handle Dragging and Corner Resizing Events for Floating PiP Box
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (isResizing) {
        // Calculate screen-adaptive min and max width constraints
        const isMobile = window.innerWidth < 640;
        const minW = isMobile ? 80 : 130;
        const maxW = isMobile ? 220 : 360;

        // Dragging top-left corner resize handle outwards increases width
        const deltaX = resizeStartRef.current.startX - clientX;
        const deltaY = resizeStartRef.current.startY - clientY;
        const delta = Math.max(deltaX, deltaY);
        const newWidth = Math.max(minW, Math.min(maxW, resizeStartRef.current.initialWidth + delta));
        setPipWidth(newWidth);
        return;
      }

      if (isDragging) {
        if (!containerRef.current || !pipRef.current) return;

        const deltaX = clientX - dragStartRef.current.startX;
        const deltaY = clientY - dragStartRef.current.startY;

        if (Math.hypot(deltaX, deltaY) > 6) {
          hasDraggedFarRef.current = true;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const pipRect = pipRef.current.getBoundingClientRect();

        const maxX = Math.max(0, containerRect.width - pipRect.width - 12);
        const maxY = Math.max(0, containerRect.height - pipRect.height - 12);

        const newX = Math.max(12, Math.min(maxX, dragStartRef.current.initialX + deltaX));
        const newY = Math.max(12, Math.min(maxY, dragStartRef.current.initialY + deltaY));

        setPipPos({ x: newX, y: newY });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDragging, isResizing]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current || !pipRef.current) return;
    hasDraggedFarRef.current = false;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pipRect = pipRef.current.getBoundingClientRect();

    const currentX = pipPos ? pipPos.x : pipRect.left - containerRect.left;
    const currentY = pipPos ? pipPos.y : pipRect.top - containerRect.top;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
    };
    setIsDragging(true);
  };

  const startResize = (clientX: number, clientY: number) => {
    if (!pipRef.current) return;
    const pipRect = pipRef.current.getBoundingClientRect();
    resizeStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialWidth: pipWidth || pipRect.width,
    };
    setIsResizing(true);
  };

  const togglePipControls = () => {
    setShowPipControls((prev) => {
      const next = !prev;
      if (pipControlsTimeoutRef.current) {
        clearTimeout(pipControlsTimeoutRef.current);
        pipControlsTimeoutRef.current = null;
      }
      if (next) {
        pipControlsTimeoutRef.current = setTimeout(() => {
          setShowPipControls(false);
        }, 4000);
      }
      return next;
    });
  };

  // Auto-dismiss PiP controls when clicking/tapping anywhere outside the PiP container
  useEffect(() => {
    if (!showPipControls) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (pipRef.current && !pipRef.current.contains(e.target as Node)) {
        setShowPipControls(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [showPipControls]);

  // Get matching text for search
  const getSearchTargetText = () => {
    const modeText = chatMode === "text" ? "text partner" : "video stranger";
    if (matchPreference === "female") return `Looking for a female ${modeText}...`;
    if (matchPreference === "male") return `Looking for a male ${modeText}...`;
    return `Looking for a random ${modeText}...`;
  };

  // Handle Start Matchmaking (MODE-AWARE ENFORCEMENT)
  const handleStart = useCallback(async () => {
    // 1. Network Signal Pre-flight Check (In Video Mode)
    if (chatMode === "video") {
      const net = await assessNetworkQuality();
      if (net.quality === "poor" || net.quality === "offline") {
        setShowWeakSignalModal(true);
        return;
      }

      if (net.quality === "fair") {
        setWeakSignalWarning("Weak signal detected. Video optimized to prevent lag.");
      } else {
        setWeakSignalWarning(null);
      }

      // 2. Camera Check in Video Mode
      const stream = await initLocalStream();
      if (!stream || stream.getVideoTracks().length === 0) {
        setShowPermissionModal(true);
        return;
      }
    }

    if (!myPeerIdRef.current) {
      addSystemMessage("Connecting to peer network... Please wait.");
      return;
    }

    cleanupCall();
    setStatus("searching");
    addSystemMessage(getSearchTargetText());

    socketRef.current?.emit("find-match", {
      peerId: myPeerIdRef.current,
      gender: userGender || "male",
      lookingFor: matchPreference,
      mode: chatMode,
      fingerprint: getBrowserFingerprint(),
    });
  }, [addSystemMessage, assessNetworkQuality, chatMode, cleanupCall, initLocalStream, matchPreference, userGender]);

  // Handle Stop Matchmaking
  const handleStop = useCallback(() => {
    setAutoNextCountdown(null);
    if (status === "idle") return;
    socketRef.current?.emit("leave-chat");
    cleanupCall();
    setStatus("disconnected");
  }, [cleanupCall, status]);

  // Handle Next (Skip Stranger & Find New Match with 1.2s Spam Protection)
  const handleNext = useCallback(async () => {
    // 1. Prevent clicking if already searching
    if (status === "searching") return;

    // 2. Continuous Click Rate-Limit / Cooldown (1.2s debounce)
    const now = Date.now();
    if (now - nextCooldownRef.current < 1200) return;
    nextCooldownRef.current = now;

    setIsNextDisabled(true);
    setTimeout(() => {
      setIsNextDisabled(false);
    }, 1200);

    setAutoNextCountdown(null);

    // 3. Video Mode Checks
    if (chatMode === "video") {
      const net = await assessNetworkQuality();
      if (net.quality === "poor" || net.quality === "offline") {
        setShowWeakSignalModal(true);
        return;
      }

      const stream = await initLocalStream();
      if (!stream || stream.getVideoTracks().length === 0) {
        setShowPermissionModal(true);
        return;
      }
    }

    cleanupCall();
    setStatus("searching");
    addSystemMessage(`Skipping... ${getSearchTargetText()}`);

    if (myPeerIdRef.current) {
      socketRef.current?.emit("find-match", {
        peerId: myPeerIdRef.current,
        gender: userGender || "male",
        lookingFor: matchPreference,
        mode: chatMode,
        fingerprint: getBrowserFingerprint(),
      });
    }
  }, [addSystemMessage, assessNetworkQuality, chatMode, cleanupCall, initLocalStream, matchPreference, status, userGender]);

  // Open Report Modal (Locks target to the currently active stranger snapshot)
  const handleOpenReportModal = useCallback(() => {
    if (status !== "connected" || !currentPartnerPeerIdRef.current) return;
    targetReportPeerIdRef.current = currentPartnerPeerIdRef.current;
    setReportReason("nudity");
    setReportDetails("");
    setShowReportModal(true);
  }, [status]);

  // Handle Report Submission (Accurately reports the locked stranger snapshot)
  const handleSubmitReport = useCallback(() => {
    setIsSubmittingReport(true);
    const targetPeerId = targetReportPeerIdRef.current || currentPartnerPeerIdRef.current;

    // 1. Emit report event with explicit targetPeerId to backend
    socketRef.current?.emit("report-partner", {
      targetPeerId,
      reason: reportReason,
      details: reportDetails.trim(),
      timestamp: new Date().toISOString(),
    });

    setShowReportModal(false);
    setIsSubmittingReport(false);

    // 2. Show floating confirmation toast
    setReportToast({
      show: true,
      message: "Stranger has been reported and disconnected. Finding next match...",
    });

    setTimeout(() => {
      setReportToast(null);
    }, 4000);

    // 3. Add system message in chat
    addSystemMessage("You reported this stranger. Looking for a new match...");

    // 4. Only skip if we are still connected to THAT same reported stranger
    if (currentPartnerPeerIdRef.current === targetPeerId) {
      handleNext();
    }
  }, [addSystemMessage, handleNext, reportDetails, reportReason]);

  // Auto-Next Countdown Effect on Disconnect
  useEffect(() => {
    if (status !== "disconnected" || autoNextCountdown === null) return;

    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      handleNext();
      return;
    }

    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, autoNextCountdown, handleNext]);



  // Handle Mic Mute Toggle (Ensures complete hardware sync with state & notifies partner in real-time)
  const toggleMic = () => {
    setIsMicMuted((prev) => {
      const nextMuted = !prev;
      isMicMutedRef.current = nextMuted;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !nextMuted;
        });
      }
      if (dataConnRef.current && dataConnRef.current.open) {
        try {
          dataConnRef.current.send(JSON.stringify({ type: "mic-status", isMuted: nextMuted }));
        } catch { }
      }
      return nextMuted;
    });
  };

  // Handle Sound Effects Mute Toggle (Persists to localStorage)
  const toggleSoundMute = () => {
    setIsSoundMuted((prev) => {
      const nextMuted = !prev;
      isSoundMutedRef.current = nextMuted;
      try {
        localStorage.setItem("omeglo_sound_muted", String(nextMuted));
      } catch { }
      return nextMuted;
    });
  };

  // Handle Mobile / Desktop Camera Flip (Switch Front & Back Camera)
  const toggleCameraFacing = async () => {
    if (isFlippingCamera) return;
    setIsFlippingCamera(true);

    const nextFacing = facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // 1. Seamlessly replace track in live WebRTC Call sender
        if (activeCallRef.current && (activeCallRef.current as any).peerConnection) {
          const senders = (activeCallRef.current as any).peerConnection.getSenders();
          const videoSender = senders.find(
            (s: RTCRtpSender) => s.track && s.track.kind === "video"
          );
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack).catch((err: any) => {
              console.warn("Could not replace track on peer sender:", err);
            });
          }
        }

        // 2. Replace track in localStreamRef & update local stream state
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        setFacingMode(nextFacing);
      }
    } catch (err) {
      console.warn("Could not flip camera facing mode:", err);
    } finally {
      setIsFlippingCamera(false);
    }
  };

  // Focus Management: Auto-focus in Text Mode; keep video focused in Video Mode
  useEffect(() => {
    if (status === "connected" && chatMode === "text") {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 150);
      return () => clearTimeout(timer);
    } else if (status !== "connected") {
      inputRef.current?.blur();
    }
  }, [status, chatMode]);

  // Keyboard Shortcuts (Esc to Stop/Next, Enter/T to quickly focus chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showReportModal) {
        if (e.key === "Escape") {
          setShowReportModal(false);
        }
        return;
      }
      if (showGenderModal || showPermissionModal || showWeakSignalModal) return;
      if (document.activeElement === inputRef.current) {
        if (e.key === "Escape") {
          inputRef.current?.blur();
        }
        return;
      }

      // In Video Mode: Pressing Enter or 'T' focuses chat input quickly
      if (status === "connected" && (e.key === "Enter" || e.key === "t" || e.key === "T")) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (status === "connected") {
          handleNext();
        } else if (status === "disconnected") {
          handleStart();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, handleNext, handleStart, showGenderModal, showPermissionModal, showWeakSignalModal, showReportModal]);

  // Handle Input Change with Real-Time Typing Indicator Transmission
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    // Send typing broadcast to partner via PeerJS DataConnection
    if (dataConnRef.current && dataConnRef.current.open && status === "connected") {
      try {
        dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: val.length > 0 }));
      } catch { }

      if (myTypingDebounceRef.current) clearTimeout(myTypingDebounceRef.current);
      myTypingDebounceRef.current = setTimeout(() => {
        if (dataConnRef.current && dataConnRef.current.open) {
          try {
            dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: false }));
          } catch { }
        }
      }, 2000);
    }
  };

  // Handle Send Message via P2P DataChannel (with Smart Regex & AI Toxicity Moderation)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const rawText = inputMessage.trim();

    // 1. Smart Regex & Anti-Spam / Anti-Scam Filter
    const filterRes = filterMessage(rawText);
    if (filterRes.isBlocked) {
      showModerationAlert(
        filterRes.warningMessage || "Sharing external links and phone numbers is restricted.",
        "warning"
      );
      return;
    }

    // 2. Strict Threat, Blackmail & Harassment Auto-Report & Quarantine
    const toxCheck = await checkTextToxicity(rawText);
    if (toxCheck.isSevereThreat) {
      showModerationAlert(
        "⚠️ Account Quarantined: Sending violent threats or blackmail is strictly prohibited.",
        "error"
      );
      setInputMessage("");

      // Auto-report violator directly to D1 for immediate quarantine
      socketRef.current?.emit("report-self", {
        reason: "harassment",
        details: `Violent threat/extortion attempted in text: "${rawText.slice(0, 80)}"`,
      });

      // Disconnect violator from chat
      setTimeout(() => {
        handleStop();
      }, 1200);
      return;
    }

    if (toxCheck.isToxic) {
      showModerationAlert("⚠️ Warning: Inappropriate or abusive language is restricted.", "warning");
    }

    const msgToSend = filterRes.cleanText;

    // Reset typing status and send clean message
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: false }));
        dataConnRef.current.send(msgToSend);
      } catch { }
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "you",
      text: msgToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");
  };

  // Clear Chat
  const handleClearChat = () => {
    setMessages([
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: "Chat cleared.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white select-none sm:select-auto">
      {/* INSUFFICIENT / WEAK NETWORK SIGNAL MODAL */}
      {showWeakSignalModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-zinc-200 shadow-2xl flex flex-col items-center text-center relative">
            {/* Close Button */}
            <button
              onClick={() => setShowWeakSignalModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Red Weak Signal Icon */}
            <div className="flex items-center justify-center mb-3 text-red-500">
              <WifiOff className="w-11 h-11 stroke-[1.5]" />
            </div>

            <h2 className="text-lg font-bold tracking-tight text-zinc-950 mb-1">
              Internet Signal Too Weak
            </h2>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed max-w-xs">
              A minimum stable connection is required for live video chat. Your current speed is too low to maintain video streaming without lag.
            </p>

            {/* Network Diagnostic Info Box */}
            <div className="w-full bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-zinc-700 pb-1.5 border-b border-zinc-200/60">
                <span className="font-medium text-zinc-500">Connection Status:</span>
                <span className="font-semibold text-red-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  {networkQuality === "offline" ? "Offline" : "Critical (Below 0.25 Mbps)"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Estimated Latency (RTT):</span>
                <span className="font-mono font-medium">{networkStats.rtt} ms</span>
              </div>
              <div className="text-[11px] text-zinc-400 pt-1 leading-normal">
                💡 <strong>Tip:</strong> Move closer to your Wi-Fi router, turn off downloads, or switch to <strong>Text Only Mode</strong> for zero video requirements.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={async () => {
                  const net = await assessNetworkQuality();
                  if (net.quality === "good" || net.quality === "fair") {
                    setShowWeakSignalModal(false);
                    handleStart();
                  }
                }}
                className="w-full h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Test Signal & Retry</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWeakSignalModal(false);
                  handleModeChange("text");
                }}
                className="w-full sm:w-auto h-11 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Switch to Text Mode
              </button>
            </div>
          </div>
        </div>
      )}


      {/* FLOATING AI & MODERATION ALERT TOAST */}
      {aiModerationToast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full backdrop-blur-md border shadow-2xl flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-3 ${aiModerationToast.type === "error"
            ? "bg-red-950/90 text-red-200 border-red-500/40"
            : aiModerationToast.type === "warning"
              ? "bg-amber-950/90 text-amber-200 border-amber-500/40"
              : "bg-zinc-950/90 text-white border-white/20"
            }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{aiModerationToast.message}</span>
        </div>
      )}

      {/* CAMERA & MIC PERMISSION MANDATORY MODAL (VIDEO MODE ONLY) */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-zinc-200 shadow-2xl flex flex-col items-center text-center relative">
            {/* Close Button */}
            <button
              onClick={() => setShowPermissionModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>


            <h2 className="text-xl font-bold tracking-tight text-zinc-950 mb-1.5 mx-3">
              Camera & Microphone Access Required
            </h2>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              Omeglo Video Chat is a genuine face-to-face platform. You must enable your camera and microphone to start video chatting.
            </p>

            {/* macOS & Browser Troubleshooting Guide Box */}
            <div className="w-full bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-2.5">
              <div className="flex items-start gap-2 text-zinc-700">
                <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>1. Browser Address Bar:</strong> Click the lock/camera icon next to the URL and set Camera to <strong>&ldquo;Allow&rdquo;</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2 text-zinc-700">
                <Settings className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>2. On macOS:</strong> Open <strong>System Settings ➡️ Privacy & Security ➡️ Camera</strong> and toggle your browser <strong>ON</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2 text-zinc-500 text-[11px]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>No camera? Switch to <strong>Text Only Mode</strong> for text chat without camera permissions.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={async () => {
                  const stream = await initLocalStream();
                  if (stream && stream.getVideoTracks().length > 0) {
                    setShowPermissionModal(false);
                    handleStart();
                  }
                }}
                className="w-full h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Grant Access & Start Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPermissionModal(false);
                  handleModeChange("text");
                }}
                className="w-full sm:w-auto h-11 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Use Text Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIRST-TIME GENDER SELECTION MODAL */}
      {showGenderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-zinc-200 shadow-2xl flex flex-col items-center text-center">
            {/* Brand Logo Icon */}
            <div className="w-14 h-14 flex items-center justify-center mb-3.5">
              <Image
                src="/logo.webp"
                alt="Omeglo Icon"
                width={56}
                height={56}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 mb-1 flex items-center justify-center gap-1.5 flex-wrap">
              <span>Welcome to</span>
              <OmegloWordmark size="text-[22px]" />
            </h2>
            <p className="text-xs text-zinc-500 mb-6 max-w-[250px] leading-relaxed">
              Select your gender to personalize your random chat experience. Saved in your browser.
            </p>

            {/* Custom SVG Gender Option Cards */}
            <div className="grid grid-cols-2 gap-3.5 w-full mb-6">
              {/* Male SVG Card */}
              <button
                type="button"
                onClick={() => setTempSelectedGender("male")}
                className={`group relative p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-150 cursor-pointer ${tempSelectedGender === "male"
                  ? "border-zinc-950 bg-zinc-50/80 ring-2 ring-zinc-950 shadow-xs"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                  }`}
              >
                {tempSelectedGender === "male" && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <div className="w-18 h-18 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Image
                    src="/male.svg"
                    alt="Male Avatar"
                    width={68}
                    height={68}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <span className="text-xs font-semibold text-zinc-900 tracking-tight">
                  Male
                </span>
              </button>

              {/* Female SVG Card */}
              <button
                type="button"
                onClick={() => setTempSelectedGender("female")}
                className={`group relative p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-150 cursor-pointer ${tempSelectedGender === "female"
                  ? "border-zinc-950 bg-zinc-50/80 ring-2 ring-zinc-950 shadow-xs"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                  }`}
              >
                {tempSelectedGender === "female" && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <div className="w-18 h-18 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Image
                    src="/female.svg"
                    alt="Female Avatar"
                    width={68}
                    height={68}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <span className="text-xs font-semibold text-zinc-900 tracking-tight">
                  Female
                </span>
              </button>
            </div>

            {/* Confirm & Continue Button */}
            <button
              type="button"
              onClick={() => handleSaveGender(tempSelectedGender)}
              className="w-full h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue to Omeglo</span>
            </button>
          </div>
        </div>
      )}

      {/* REPORT STRANGER MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-zinc-200 shadow-2xl flex flex-col relative text-left">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="mb-4 pr-6">
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                Report Stranger
              </h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Reports are anonymous. Select a reason below to disconnect and submit a report.
              </p>
            </div>

            {/* Reason Selection Radio List */}
            <div className="space-y-2 mb-4">
              {[
                { id: "nudity", label: "Nudity or Sexual Content", desc: "Explicit acts, nudity, or inappropriate NSFW behavior" },
                { id: "harassment", label: "Harassment or Hate Speech", desc: "Bullying, abusive words, threats, or discrimination" },
                { id: "underage", label: "Underage User", desc: "Stranger appears to be a minor" },
                { id: "spam", label: "Spam or Advertising", desc: "Recorded video, automated bots, or promotions" },
                { id: "other", label: "Other Violation", desc: "Other disruptive or rule-breaking behavior" },
              ].map((item) => {
                const isSelected = reportReason === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReportReason(item.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${isSelected
                      ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950 shadow-2xs"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 leading-snug">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-300 bg-white"
                        }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Details Input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Additional Details <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Briefly describe what happened..."
                className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-zinc-950 focus:bg-white text-zinc-900 placeholder:text-zinc-400 transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 text-xs font-medium transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReport}
                onClick={handleSubmitReport}
                className="flex-1 h-10 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Report Toast Notification */}
      {reportToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/90 backdrop-blur-md text-white text-xs font-medium px-4 py-2.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{reportToast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/70 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-2">
          {/* Brand Logo & Multicolor Wordmark */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Minimalist Logo Icon */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-transform hover:scale-105 shrink-0">
              <Image
                src="/logo.webp"
                alt="Omeglo Logo Mark"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                priority
              />
            </div>

            {/* Eye-Friendly Multicolor Typography */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <OmegloWordmark size="text-[17px] sm:text-[19px]" />
              </div>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide leading-none mt-0.5 hidden sm:block">
                {chatMode === "video" ? "Random Video Chat" : "Random Text Chat"}
              </span>
            </div>
          </div>

          {/* Desktop Central Segmented Chat Mode Switcher (Video vs Text) (>= md) */}
          <div className="hidden md:flex items-center bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/60 shadow-2xs">
            <button
              type="button"
              onClick={() => handleModeChange("video")}
              className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${chatMode === "video"
                ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Chat</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("text")}
              className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${chatMode === "text"
                ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Text Only</span>
            </button>
          </div>

          {/* User Gender Tag & Live Online Badges */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-xs shrink-0">
            {/* Real-time Network Signal Health Indicator */}
            {chatMode === "video" && (
              <div
                title={`Network Signal: ${networkQuality === "good"
                  ? "Strong (Smooth HD)"
                  : networkQuality === "fair"
                    ? "Fair (Low Bandwidth - optimized)"
                    : "Critical / Weak Signal"
                  }`}
                className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${networkQuality === "good"
                  ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-700"
                  : networkQuality === "fair"
                    ? "bg-amber-50/80 border-amber-200/60 text-amber-700"
                    : "bg-red-50/80 border-red-200/60 text-red-700 animate-pulse"
                  }`}
              >
                {networkQuality === "good" ? (
                  <Signal className="w-3.5 h-3.5" />
                ) : networkQuality === "fair" ? (
                  <SignalMedium className="w-3.5 h-3.5" />
                ) : (
                  <SignalLow className="w-3.5 h-3.5" />
                )}
                <span className="text-[10px] font-semibold capitalize">
                  {networkQuality === "good" ? "Fast" : networkQuality === "fair" ? "Low" : "No Signal"}
                </span>
              </div>
            )}

            {/* Clickable User Gender SVG Badge */}
            {userGender && (
              <button
                onClick={() => {
                  setTempSelectedGender(userGender);
                  setShowGenderModal(true);
                }}
                title="Click to change your gender"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-800 border border-zinc-200/60 transition-colors cursor-pointer"
              >
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                  <Image
                    src={userGender === "male" ? "/male.svg" : "/female.svg"}
                    alt={userGender}
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="capitalize font-medium text-[11px]">{userGender}</span>
                <Edit2 className="w-2.5 h-2.5 text-zinc-400 ml-0.5 hidden sm:inline" />
              </button>
            )}

            {/* Real-time Online Counter from Socket Server */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-zinc-100/90 text-zinc-700 border border-zinc-200/50">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <Users className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="font-bold text-xs">{onlineCount}</span>
              <span className="text-zinc-400 hidden sm:inline text-[11px]">online</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-zinc-400">
              <Shield className="w-3.5 h-3.5" />
              <span>P2P Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      {/* Dedicated Mobile Chat Mode Switcher Sub-Bar (< md) - 100% Fits Any Small Screen */}
      <div className="md:hidden w-full bg-white/90 border-b border-zinc-200/60 px-3 py-1.5 flex items-center justify-center sticky top-14 z-25 backdrop-blur-sm">
        <div className="w-full max-w-xs flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => handleModeChange("video")}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${chatMode === "video"
              ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200/70"
              : "text-zinc-500 hover:text-zinc-900"
              }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Chat</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("text")}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${chatMode === "text"
              ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200/70"
              : "text-zinc-500 hover:text-zinc-900"
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Text Only</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Section: Main Stage + Sleek Dock (8 Cols on Desktop) */}
        <section className="lg:col-span-8 flex flex-col gap-3 sm:gap-4">
          {/* Main Visual Stage (Video Feed in Video Mode, Interactive Dashboard in Text Mode) */}
          <div
            ref={containerRef}
            className="relative w-full aspect-4/3 sm:aspect-16/10 lg:aspect-auto flex-1 min-h-[380px] sm:min-h-[480px] lg:min-h-[540px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-xs flex flex-col items-center justify-center text-zinc-400"
          >
            {/* VIDEO MODE: Instant Micro-Preview & Stranger Live WebRTC Video Element */}
            {chatMode === "video" && (
              <>
                {/* 1. Instant 0ms Fallback: Dummy Blurred Person Silhouette Placeholder (Before Micro-Snapshot arrives) */}
                {!isSwappedFeeds && !remoteMicroPreview && !isRemoteVideoPlaying && status === "connected" && (
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden pointer-events-none">
                    {/* Soft ambient background glow */}
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black animate-pulse" />

                    {/* Dummy blurred person silhouette */}
                    <div className="relative flex flex-col items-center justify-center filter blur-xl scale-125 opacity-30 animate-pulse">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-zinc-600 to-zinc-400 mb-2" />
                      <div className="w-52 h-32 rounded-t-[60px] bg-gradient-to-t from-zinc-600 to-zinc-500" />
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Connecting Video...</span>
                    </div>
                  </div>
                )}

                {/* 2. Real Micro-Snapshot Preview (16x12 px ambient colors with heavy blur) */}
                {!isSwappedFeeds && remoteMicroPreview && !isRemoteVideoPlaying && status === "connected" && (
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none animate-in fade-in duration-300">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={remoteMicroPreview}
                      alt="Stranger Preview"
                      className="w-full h-full object-cover filter blur-3xl scale-125 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Loading HD Video...</span>
                    </div>
                  </div>
                )}

                {/* 3. Main Stage Feed (Stranger when normal, Your camera when swapped) */}
                {!isSwappedFeeds ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    onPlaying={() => setIsRemoteVideoPlaying(true)}
                    onLoadedData={() => setIsRemoteVideoPlaying(true)}
                    className={`absolute inset-0 w-full h-full object-cover z-0 transition-all duration-500 ${status === "connected" && remoteStream
                      ? isNsfwBlurred
                        ? "opacity-100 filter blur-3xl brightness-50"
                        : isRemoteVideoPlaying
                          ? "opacity-100 filter-none"
                          : "opacity-0 filter blur-xl"
                      : "opacity-0 hidden"
                      }`}
                  />
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover z-0 ${facingMode === "user" ? "scale-x-[-1]" : ""
                      } transition-opacity duration-300 ${!localStream || hasCameraPermission === false ? "opacity-0" : "opacity-100"
                      }`}
                  />
                )}
              </>
            )}

            {/* Stage Identity Badge (Top Left) */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-xs font-medium pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${status === "connected"
                  ? "bg-emerald-500"
                  : status === "searching"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-zinc-600"
                  }`}
              />
              <span className="text-[11px] font-medium tracking-tight">
                {isSwappedFeeds
                  ? "You (Full Camera View)"
                  : status === "connected" && strangerGender
                    ? `Stranger (${strangerGender === "female" ? "Female" : "Male"})${getCountryDetails(strangerCountry) ? ` ${getCountryDetails(strangerCountry)?.flag}` : ""}`
                    : `Stranger (${chatMode === "text" ? "Text Mode" : "Video Mode"})`}
              </span>
            </div>

            {/* Quality, Remote Mute, Report & Swap Back Badges (Top Right) */}
            {status === "connected" && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                {/* Stranger Mute Indicator (Shows when the partner has muted their microphone) */}
                {chatMode === "video" && !isSwappedFeeds && isStrangerMuted && (
                  <div className="bg-red-950/80 backdrop-blur-md text-red-300 px-2.5 py-1 rounded-full border border-red-500/40 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm animate-in fade-in duration-200">
                    <MicOff className="w-3 h-3 text-red-400" />
                    <span>Stranger Muted</span>
                  </div>
                )}

                {isSwappedFeeds && (
                  <button
                    type="button"
                    onClick={() => setIsSwappedFeeds(false)}
                    title="Switch main view back to stranger"
                    className="bg-black/60 hover:bg-white/20 backdrop-blur-md text-zinc-300 hover:text-white px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline">Swap View</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenReportModal}
                  title="Report this stranger"
                  aria-label="Report stranger"
                  className="bg-black/60 hover:bg-red-950/40 hover:border-red-500/30 backdrop-blur-md text-zinc-400 hover:text-red-400 p-1.5 rounded-full border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Flag className="w-3 h-3 text-red-400/80" />
                </button>
                <div className="bg-black/60 backdrop-blur-md text-[11px] text-zinc-300 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 pointer-events-none">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveCallQuality === "good" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                  <span className="hidden sm:inline">{chatMode === "text" ? "P2P Text Active" : liveCallQuality === "good" ? "Live HD Video" : "Weak P2P Link"}</span>
                </div>
              </div>
            )}

            {/* WEAK SIGNAL WARNING BANNER OVER VIDEO */}
            {chatMode === "video" && (weakSignalWarning || (status === "connected" && liveCallQuality === "poor")) && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 backdrop-blur-md text-zinc-950 font-semibold text-[11px] px-3.5 py-1 rounded-full border border-amber-300/60 shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="w-3.5 h-3.5 text-zinc-950 shrink-0" />
                <span>
                  {liveCallQuality === "poor"
                    ? "Network lagging: Motion prioritized over resolution"
                    : "Low signal: Video optimized for weak connection"}
                </span>
              </div>
            )}

            {/* SEARCHING STATE: Retro TV Static & Scanlines */}
            {status === "searching" && (
              <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden">
                <TvStaticCanvas />
                <div className="absolute inset-0 crt-scanlines" />
                <div className="absolute left-0 right-0 h-24 bg-linear-to-b from-transparent via-white/10 to-transparent animate-scan-beam pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center gap-3.5 p-5 text-center bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl max-w-xs animate-static-flicker">
                  <div className="relative flex items-center justify-center p-2">
                    <Radio className="w-10 h-10 text-zinc-200 animate-spin" style={{ animationDuration: "3s" }} />
                    <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-30" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-zinc-100 font-medium text-sm">
                      {chatMode === "text" ? "Finding random text partner..." : "Connecting to video match..."}
                    </p>
                    <p className="text-zinc-400 text-xs font-mono">
                      {matchPreference === "female"
                        ? "Looking for female match"
                        : matchPreference === "male"
                          ? "Looking for male match"
                          : "Looking for anyone"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TEXT MODE CONNECTED STAGE: Sleek Visualizer & Identity Card */}
            {chatMode === "text" && status === "connected" && (
              <div className="flex flex-col items-center gap-4 p-6 text-center select-none z-10 animate-in fade-in">
                <div className="relative">
                  <div className="w-24 h-24 flex items-center justify-center">
                    <Image
                      src={strangerGender === "female" ? "/female.svg" : "/male.svg"}
                      alt="Stranger Avatar"
                      width={96}
                      height={96}
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center shadow-xs text-white" title="Connected">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-100 font-bold text-base tracking-tight">
                    Chatting with {strangerGender ? (strangerGender === "female" ? "Female Stranger" : "Male Stranger") : "Stranger"}
                    {getCountryDetails(strangerCountry) ? ` ${getCountryDetails(strangerCountry)?.flag} (${getCountryDetails(strangerCountry)?.name})` : ""}
                  </p>
                  <p className="text-zinc-400 text-xs max-w-xs">
                    You are connected via P2P Encrypted Text. Type in the chat box on the right to talk!
                  </p>
                </div>
              </div>
            )}

            {/* IDLE STATE */}
            {status === "idle" && (
              <div className="flex flex-col items-center gap-3.5 p-6 text-center select-none pointer-events-none z-0">
                <div className="flex items-center justify-center text-zinc-500 mb-1">
                  {chatMode === "text" ? <MessageSquare className="w-12 h-12 stroke-[1.5]" /> : <User className="w-12 h-12 stroke-[1.5]" />}
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-200 font-semibold text-sm">
                    {chatMode === "text" ? "Ready for Random Text Chat" : "Ready for Video Chat"}
                  </p>
                  <p className="text-zinc-500 text-xs max-w-xs">
                    {chatMode === "text"
                      ? "Zero camera needed. Click Start to match with text chatters."
                      : "Face-to-face video chat. Click Start to connect with strangers."}
                  </p>
                </div>
              </div>
            )}

            {/* DISCONNECTED STATE WITH AUTO-NEXT COUNTDOWN */}
            {status === "disconnected" && (
              <div className="flex flex-col items-center gap-3.5 p-6 text-center select-none z-10 max-w-xs animate-in fade-in">
                <div className="flex items-center justify-center mb-1">
                  <Image
                    src="/call-disconnected.svg"
                    alt="Stranger Disconnected"
                    width={48}
                    height={48}
                    className="w-12 h-12 object-contain drop-shadow-md"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-200 font-semibold text-sm">Stranger Disconnected</p>
                  {autoNextCountdown !== null ? (
                    <div className="flex flex-col items-center gap-2.5 mt-2">
                      <p className="text-xs text-indigo-400 font-medium flex items-center justify-center gap-1.5">
                        <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                        <span>Finding next in <strong>{autoNextCountdown}s</strong>...</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleNext()}
                          disabled={isNextDisabled}
                          className={`h-8 px-3.5 rounded-lg text-white text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs ${isNextDisabled
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60"
                            : "bg-zinc-800 hover:bg-zinc-700 active:scale-95 cursor-pointer"
                            }`}
                        >
                          <SkipForward className="w-3 h-3" />
                          <span>Next Now</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoNextCountdown(null)}
                          className="h-8 px-3 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs font-medium transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-xs">Press Next to meet someone else</p>
                  )}
                </div>
              </div>
            )}

            {/* VIDEO MODE: WhatsApp-Style Clean Floating PiP Video with Pull-to-Resize & Tap-to-Show Controls */}
            {chatMode === "video" && (
              <div
                ref={pipRef}
                style={{
                  ...(pipPos
                    ? {
                        left: `${pipPos.x}px`,
                        top: `${pipPos.y}px`,
                        right: "auto",
                        bottom: "auto",
                      }
                    : {}),
                  ...(pipWidth ? { width: `${pipWidth}px`, height: `${Math.round(pipWidth * 1.35)}px` } : {}),
                }}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".resize-handle")) return;
                  startDrag(e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                  if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".resize-handle")) return;
                  startDrag(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".resize-handle")) return;
                  if (!hasDraggedFarRef.current) {
                    togglePipControls();
                  }
                }}
                className={`absolute ${!pipPos ? "bottom-3 right-3 sm:bottom-4 sm:right-4" : ""} z-20 ${
                  !pipWidth ? "w-24 h-32 sm:w-32 sm:h-44 md:w-36 md:h-48 lg:w-40 lg:h-54" : ""
                } bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md transition-shadow select-none group ${
                  isDragging ? "cursor-grabbing ring-2 ring-zinc-400/40" : "cursor-pointer hover:border-white/40"
                }`}
              >
                {/* Corner Pull-to-Resize Handle (Drag corner to resize camera size smoothly) */}
                <div
                  title="Drag corner to resize camera"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize(e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    startResize(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="resize-handle absolute top-0 left-0 w-6 h-6 sm:w-7 sm:h-7 z-30 flex items-center justify-center cursor-nwse-resize text-white/50 hover:text-white transition-colors group-hover:opacity-100 opacity-60 touch-none p-1 sm:p-1.5"
                >
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 border-t-2 border-l-2 border-white/70 rounded-tl-xs" />
                </div>

                {/* Floating Video Stream: Local webcam if normal, Stranger feed if swapped */}
                {!isSwappedFeeds ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover z-0 ${
                      facingMode === "user" ? "scale-x-[-1]" : ""
                    } pointer-events-none transition-opacity duration-200 ${
                      !localStream || hasCameraPermission === false ? "opacity-0" : "opacity-100"
                    }`}
                  />
                ) : (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    onPlaying={() => setIsRemoteVideoPlaying(true)}
                    onLoadedData={() => setIsRemoteVideoPlaying(true)}
                    className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
                      status === "connected" && remoteStream ? "opacity-100" : "opacity-0 hidden"
                    }`}
                  />
                )}

                {/* Subtle Mini Top-Right Tag */}
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 pointer-events-none">
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-white/10 text-white text-[8px] sm:text-[9px] font-medium shadow-xs">
                    {!isSwappedFeeds ? (
                      <>
                        {userGender ? (
                          <div className="w-2.5 h-2.5 rounded-full overflow-hidden flex items-center justify-center">
                            <Image
                              src={userGender === "male" ? "/male.svg" : "/female.svg"}
                              alt={userGender}
                              width={10}
                              height={10}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <span className="w-1 h-1 rounded-full bg-zinc-300" />
                        )}
                        <span>You</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Stranger</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Fallback View if Permission Pending on Local Cam (Clean White Centered Button, Zero Icon) */}
                {!isSwappedFeeds && (!localStream || hasCameraPermission === false) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-2">
                    <button
                      type="button"
                      onClick={() => setShowPermissionModal(true)}
                      className="pointer-events-auto px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-[10px] sm:text-xs tracking-tight shadow-md backdrop-blur-md hover:scale-105 active:scale-95 transition-all cursor-pointer select-none text-center"
                    >
                      Enable Cam
                    </button>
                  </div>
                )}

                {/* Tap-to-Show Full Action Overlay (Scan / Swap Icon in Center, Bottom Mic & Flip Cam) */}
                {showPipControls && (
                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".resize-handle")) return;
                      setShowPipControls(false);
                    }}
                    className="absolute inset-0 bg-black/45 backdrop-blur-[1px] z-20 flex flex-col justify-between p-1.5 sm:p-2 animate-in fade-in duration-150 cursor-pointer"
                  >
                    {/* Top Spacer */}
                    <div className="w-full h-3 sm:h-4 pointer-events-none" />

                    {/* Center Scan / Swap Feed Action Icon (Pure Borderless Clean Icon) */}
                    <div className="flex items-center justify-center my-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSwappedFeeds((prev) => !prev);
                          setShowPipControls(false);
                        }}
                        title={isSwappedFeeds ? "Return Stranger to Full Screen" : "Make Your Camera Full Screen (WhatsApp Style)"}
                        className="p-1 sm:p-2 text-white/90 hover:text-white active:scale-90 transition-all cursor-pointer group"
                      >
                        <Scan className="w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] group-hover:scale-110 transition-transform stroke-[0.75]" />
                      </button>
                    </div>

                    {/* Bottom Action Controls (Flip Camera + Mute Mic / Report) */}
                    <div className="flex items-center justify-center gap-1 sm:gap-2 bg-black/65 backdrop-blur-md py-0.5 sm:py-1 px-1.5 sm:px-2 rounded-xl border border-white/10 mx-auto">
                      {!isSwappedFeeds ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleCameraFacing()}
                            disabled={isFlippingCamera || !localStream}
                            title={`Flip Camera (Currently: ${facingMode === "user" ? "Front" : "Back"})`}
                            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isFlippingCamera
                                ? "text-indigo-400 animate-spin"
                                : "text-zinc-200 hover:bg-white/15 hover:text-white"
                            }`}
                          >
                            <SwitchCamera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMic()}
                            title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                            className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isMicMuted ? "bg-red-500/30 text-red-400" : "text-zinc-200 hover:bg-white/15 hover:text-white"
                            }`}
                          >
                            {isMicMuted ? <MicOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenReportModal();
                            setShowPipControls(false);
                          }}
                          title="Report Stranger"
                          className="p-1 rounded-lg text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold"
                        >
                          <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>Report</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ULTRA-SLEEK MINIMALIST CONTROL DOCK */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shadow-xs">
            {/* Left/Main Action Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {status === "idle" ? (
                /* Sleek Start Button */
                <button
                  onClick={handleStart}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start {chatMode === "text" ? "Text Chat" : "Video Chat"}</span>
                  <span className="hidden sm:inline-flex text-[10px] font-mono opacity-50 bg-white/15 px-1.5 py-0.5 rounded ml-1">
                    Space
                  </span>
                </button>
              ) : (
                /* Connected / Searching / Disconnected Actions */
                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  {/* Stop / Leave Button */}
                  <button
                    onClick={handleStop}
                    disabled={status === "disconnected"}
                    title="Stop / Disconnect"
                    className={`h-11 px-3.5 sm:px-5 rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${status === "disconnected"
                      ? "bg-zinc-100 text-zinc-300 border border-zinc-200/50 cursor-not-allowed"
                      : "bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700 border border-zinc-200/70 active:scale-[0.98]"
                      }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>

                  {/* Report Button (Active when connected) */}
                  {status === "connected" && (
                    <button
                      type="button"
                      onClick={handleOpenReportModal}
                      title="Report Stranger"
                      className="h-11 px-3 sm:px-3.5 rounded-xl text-xs font-semibold bg-red-50/80 hover:bg-red-100/90 text-red-600 border border-red-200/70 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                    >
                      <Flag className="w-3.5 h-3.5 fill-red-500/20" />
                      <span className="hidden sm:inline">Report</span>
                    </button>
                  )}

                  {/* Next / Skip Button */}
                  <button
                    onClick={handleNext}
                    disabled={status === "searching" || isNextDisabled}
                    title={status === "searching" ? "Finding next stranger..." : "Next Stranger (Esc)"}
                    className={`flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 shadow-xs ${status === "searching" || isNextDisabled
                      ? "bg-zinc-800 text-zinc-400 opacity-60 cursor-not-allowed"
                      : "bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white cursor-pointer"
                      }`}
                  >
                    {status === "searching" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <SkipForward className="w-4 h-4" />
                        <span>Next Stranger</span>
                        <span className="hidden sm:inline-flex text-[10px] font-mono opacity-50 bg-white/15 px-1.5 py-0.5 rounded ml-1">
                          Esc
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Middle: Gender Match Preference Selector (Using Custom Symbol SVGs) */}
            <div className="flex items-center justify-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/60 w-full sm:w-auto">
              <span className="text-[10px] text-zinc-400 font-medium px-1.5 hidden md:inline">
                Looking for:
              </span>

              {/* Both / Any */}
              <button
                type="button"
                onClick={() => handleMatchPreferenceChange("any")}
                title="Match with anyone"
                className={`flex-1 sm:flex-none h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${matchPreference === "any"
                  ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                  }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                  <Image
                    src="/gender-both.svg"
                    alt="Both"
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span>Both</span>
              </button>

              {/* Female Match */}
              <button
                type="button"
                onClick={() => handleMatchPreferenceChange("female")}
                title="Filter for female strangers"
                className={`flex-1 sm:flex-none h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${matchPreference === "female"
                  ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                  }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                  <Image
                    src="/gender-female.svg"
                    alt="Female Symbol"
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span>Female</span>
              </button>

              {/* Male Match */}
              <button
                type="button"
                onClick={() => handleMatchPreferenceChange("male")}
                title="Filter for male strangers"
                className={`flex-1 sm:flex-none h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${matchPreference === "male"
                  ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                  }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                  <Image
                    src="/gender-male.svg"
                    alt="Male Symbol"
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span>Male</span>
              </button>
            </div>

            {/* Right Helper Shortcut Hint */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 pr-1">
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <kbd className="bg-zinc-100 border border-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded text-[10px]">
                  Esc
                </kbd>
                <span>to skip</span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Section: Text Chat Area (4 Cols on Desktop) */}
        <section className="lg:col-span-4 flex flex-col bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-xs h-[420px] lg:h-auto min-h-[420px]">
          {/* Chat Panel Header */}
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-zinc-700 shrink-0" />
              <div>
                <h2 className="text-xs font-semibold text-zinc-950 leading-none">
                  {chatMode === "text" ? "P2P Text Chat" : "Live Video Chat"}
                </h2>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {status === "connected"
                    ? "Direct Encrypted Connection"
                    : status === "searching"
                      ? "Finding stranger..."
                      : "Idle"}
                </span>
              </div>
            </div>

            {/* Header Controls: Sound Toggle, Report & Clear Chat */}
            <div className="flex items-center gap-1">
              {status === "connected" && (
                <button
                  type="button"
                  onClick={handleOpenReportModal}
                  title="Report stranger for inappropriate behavior"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleSoundMute}
                title={isSoundMuted ? "Unmute Sound Effects" : "Mute Sound Effects"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isSoundMuted
                  ? "text-red-400 hover:bg-red-50"
                  : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                  }`}
              >
                {isSoundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClearChat}
                title="Clear chat"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages List */}
          <div
            ref={messagesContainerRef}
            className="flex-1 p-3.5 overflow-y-auto space-y-2.5 custom-scrollbar bg-zinc-50/30"
          >
            {messages.map((msg) => {
              if (msg.sender === "system") {
                return (
                  <div key={msg.id} className="flex justify-center my-1">
                    <div className="text-[11px] text-zinc-400 font-medium bg-zinc-100/70 border border-zinc-200/40 px-2.5 py-0.5 rounded-full max-w-[90%] text-center">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const isYou = msg.sender === "you";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isYou ? "items-end" : "items-start"}`}
                >
                  <span className="text-[9px] text-zinc-400 font-medium px-1 mb-0.5">
                    {isYou ? "You" : "Stranger"} • {msg.timestamp}
                  </span>
                  <div
                    className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${isYou
                      ? "bg-zinc-950 text-white rounded-tr-2xs shadow-2xs"
                      : "bg-white text-zinc-800 border border-zinc-200/70 rounded-tl-2xs shadow-2xs"
                      }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Live Stranger Typing Indicator Bubble */}
            {isStrangerTyping && status === "connected" && (
              <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-1 duration-150">
                <span className="text-[9px] text-indigo-500 font-medium px-1 mb-0.5">
                  Stranger is typing...
                </span>
                <div className="bg-white border border-zinc-200/80 px-3 py-2 rounded-xl rounded-tl-2xs shadow-2xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Box */}
          <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-zinc-100 flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={
                status === "connected"
                  ? "Type a message to stranger..."
                  : "Connect to start chatting..."
              }
              disabled={status !== "connected"}
              className="flex-1 bg-zinc-50 hover:bg-zinc-100/60 focus:bg-white text-xs text-zinc-900 placeholder:text-zinc-400 px-3 py-2 rounded-xl border border-zinc-200/80 focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || status !== "connected"}
              className={`p-2 rounded-xl transition-all shadow-2xs ${inputMessage.trim() && status === "connected"
                ? "bg-zinc-950 text-white hover:bg-zinc-800 active:scale-95 cursor-pointer"
                : "bg-zinc-100 text-zinc-300 border border-zinc-200/40 cursor-not-allowed"
                }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
