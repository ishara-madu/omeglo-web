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
  VideoOff,
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
} from "lucide-react";

type ChatMessage = {
  id: string;
  sender: "you" | "stranger" | "system";
  text: string;
  timestamp: string;
};

type ConnectionStatus = "idle" | "searching" | "connected" | "disconnected";
type Gender = "male" | "female" | null;
type MatchPreference = "any" | "female" | "male";

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
  } catch {}
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
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "sys-1",
      sender: "system",
      text: "Welcome to Omeglo! Click 'Start' to begin chatting with random strangers.",
      timestamp: "Just now",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState("1");
  const [strangerGender, setStrangerGender] = useState<Gender>(null);

  // Media Streams & Permission State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // User Gender State & First-time Visit Modal
  const [userGender, setUserGender] = useState<Gender>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [tempSelectedGender, setTempSelectedGender] = useState<"male" | "female">("male");

  // Match Preference / Looking For Filter (Any / Female / Male)
  const [matchPreference, setMatchPreference] = useState<MatchPreference>("any");

  // Draggable PiP State
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Video & WebRTC Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

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

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => {
        console.warn("Local video play warning:", err);
      });
    }
  }, [localStream]);

  // Bind remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Remote video play warning:", err);
      });
    }
  }, [remoteStream]);

  // Setup PeerJS P2P DataChannel Connection for direct peer-to-peer live text chat & typing indicators
  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;

    conn.on("open", () => {
      console.log("🟢 PeerJS P2P DataChannel connected and ready for live chat.");
    });

    conn.on("data", (data: unknown) => {
      if (typeof data === "string") {
        // 1. Check if packet is typing status
        try {
          const parsed = JSON.parse(data);
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
        } catch {}

        // 2. Regular Text Message
        setIsStrangerTyping(false);
        playAudioSFX("message", isSoundMuted);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: "stranger",
            text: data,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    });

    conn.on("close", () => {
      console.log("🔴 PeerJS P2P Data connection closed.");
      setIsStrangerTyping(false);
    });

    conn.on("error", (err) => {
      console.warn("PeerJS DataConnection error:", err);
    });
  }, [isSoundMuted]);

  // Request & Initialize Local Real Camera and Microphone
  const initLocalStream = useCallback(async (): Promise<MediaStream | null> => {
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
        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasCameraPermission(true);
        setShowPermissionModal(false);
        return stream;
      } catch (err2) {
        console.warn("Attempt 2 (standard video+audio) failed:", err2);

        // 3. Tertiary Attempt: Video Only (in case no mic exists)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
            audio: false,
          });
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
  }, []);

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
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setStrangerGender(null);
  }, []);

  // Initialize Socket.io and PeerJS
  useEffect(() => {
    // 1. Check localStorage for gender preference
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
    } catch {
      setShowGenderModal(true);
    }

    // 2. Initialize Socket.io Connection
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to Matchmaking server:", socket.id);
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

      // Handle Incoming Call from Stranger
      peer.on("call", async (incomingCall) => {
        const stream = localStreamRef.current || (await initLocalStream());
        if (stream) {
          incomingCall.answer(stream);
        } else {
          incomingCall.answer();
        }

        incomingCall.on("stream", (incomingRemoteStream) => {
          setRemoteStream(incomingRemoteStream);
        });

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
    socket.on("match-found", async ({ partnerPeerId, partnerGender, initiator }) => {
      console.log("Match Found with Peer:", partnerPeerId, "Initiator:", initiator);
      cleanupCall();
      setStatus("connected");
      setStrangerGender(partnerGender);
      playAudioSFX("match", isSoundMuted);
      addSystemMessage("Connected with a stranger! Say hi.");

      // Ensure local camera is streaming
      const stream = localStreamRef.current || (await initLocalStream());

      if (initiator && peerRef.current && partnerPeerId) {
        // Initiator calls partner
        if (stream) {
          const call = peerRef.current.call(partnerPeerId, stream);
          call?.on("stream", (partnerStream: MediaStream) => {
            setRemoteStream(partnerStream);
          });
          activeCallRef.current = call;
        }

        // Initiator connects DataChannel for text chat
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
      playAudioSFX("leave", isSoundMuted);
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
  }, [addSystemMessage, cleanupCall, initLocalStream, isSoundMuted, setupDataConnection]);

  // Request Camera automatically after onboarding / on mount
  useEffect(() => {
    if (!showGenderModal) {
      initLocalStream();
    }
  }, [showGenderModal, initLocalStream]);

  // Save selected gender & trigger camera access
  const handleSaveGender = (gender: "male" | "female") => {
    try {
      localStorage.setItem("omeglo_user_gender", gender);
    } catch {}
    setUserGender(gender);
    setShowGenderModal(false);
    initLocalStream();
  };

  // Change match preference
  const handleMatchPreferenceChange = (pref: MatchPreference) => {
    setMatchPreference(pref);
    try {
      localStorage.setItem("omeglo_match_pref", pref);
    } catch {}
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStrangerTyping]);

  // Handle Dragging Events for Floating Self View (WhatsApp style)
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !pipRef.current) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const containerRect = containerRef.current.getBoundingClientRect();
      const pipRect = pipRef.current.getBoundingClientRect();

      const maxX = Math.max(0, containerRect.width - pipRect.width - 16);
      const maxY = Math.max(0, containerRect.height - pipRect.height - 16);

      const newX = Math.max(16, Math.min(maxX, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(16, Math.min(maxY, dragStartRef.current.initialY + deltaY));

      setPipPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
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
  }, [isDragging]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current || !pipRef.current) return;
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

  // Get matching text for search
  const getSearchTargetText = () => {
    if (matchPreference === "female") return "Looking for a female stranger...";
    if (matchPreference === "male") return "Looking for a male stranger...";
    return "Looking for a stranger...";
  };

  // Handle Start Matchmaking (STRICT CAMERA ENFORCEMENT)
  const handleStart = useCallback(async () => {
    // 1. Mandatory camera stream check
    const stream = await initLocalStream();
    if (!stream || stream.getVideoTracks().length === 0) {
      setShowPermissionModal(true);
      return;
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
    });
  }, [addSystemMessage, cleanupCall, initLocalStream, matchPreference, userGender]);

  // Handle Stop Matchmaking
  const handleStop = useCallback(() => {
    setAutoNextCountdown(null);
    if (status === "idle") return;
    socketRef.current?.emit("leave-chat");
    cleanupCall();
    setStatus("disconnected");
  }, [cleanupCall, status]);

  // Handle Next (Skip Stranger & Find New Match - STRICT CAMERA ENFORCEMENT)
  const handleNext = useCallback(async () => {
    setAutoNextCountdown(null);
    const stream = await initLocalStream();
    if (!stream || stream.getVideoTracks().length === 0) {
      setShowPermissionModal(true);
      return;
    }

    cleanupCall();
    setStatus("searching");
    addSystemMessage(`Skipping... ${getSearchTargetText()}`);

    if (myPeerIdRef.current) {
      socketRef.current?.emit("find-match", {
        peerId: myPeerIdRef.current,
        gender: userGender || "male",
        lookingFor: matchPreference,
      });
    }
  }, [addSystemMessage, cleanupCall, initLocalStream, matchPreference, userGender]);

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

  // Handle Mic Mute Toggle
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMicMuted;
        setIsMicMuted(!isMicMuted);
      }
    } else {
      setIsMicMuted(!isMicMuted);
    }
  };

  // Handle Video Turn On/Off Toggle
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    } else {
      setIsVideoOff(!isVideoOff);
    }
  };

  // Keyboard Shortcuts (Esc to Stop/Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGenderModal || showPermissionModal) return;
      if (document.activeElement === inputRef.current) {
        if (e.key === "Escape") {
          inputRef.current?.blur();
        }
        return;
      }

      if (e.key === "Escape") {
        if (status === "connected" || status === "searching") {
          handleNext();
        } else if (status === "disconnected") {
          handleStart();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, handleNext, handleStart, showGenderModal, showPermissionModal]);

  // Handle Input Change with Real-Time Typing Indicator Transmission
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    // Send typing broadcast to partner via PeerJS DataConnection
    if (dataConnRef.current && dataConnRef.current.open && status === "connected") {
      try {
        dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: val.length > 0 }));
      } catch {}

      if (myTypingDebounceRef.current) clearTimeout(myTypingDebounceRef.current);
      myTypingDebounceRef.current = setTimeout(() => {
        if (dataConnRef.current && dataConnRef.current.open) {
          try {
            dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: false }));
          } catch {}
        }
      }, 2000);
    }
  };

  // Handle Send Message via P2P DataChannel
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const msgText = inputMessage.trim();

    // Reset typing status and send message
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(JSON.stringify({ type: "typing", isTyping: false }));
        dataConnRef.current.send(msgText);
      } catch {}
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "you",
      text: msgText,
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
      {/* CAMERA & MIC PERMISSION MANDATORY MODAL */}
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

            {/* Warning Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-center mb-3.5 text-amber-600 shadow-xs">
              <Camera className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold tracking-tight text-zinc-950 mb-1.5">
              Camera & Microphone Access Required
            </h2>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              Omeglo is a live random video chat. You must enable your camera and microphone to start chatting with strangers.
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
                <span>Make sure your MacBook lid is open and FaceTime camera is not in use by another app.</span>
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
                <span>Grant Access & Start Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="w-full sm:w-auto h-11 px-5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
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
            <div className="w-13 h-13 rounded-2xl bg-zinc-50 border border-zinc-100 p-2 flex items-center justify-center mb-3.5 shadow-xs">
              <Image
                src="/logo.webp"
                alt="Omeglo Icon"
                width={40}
                height={40}
                className="w-full h-full object-contain rounded-xl"
                priority
              />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 mb-1 flex items-center justify-center gap-1.5 flex-wrap">
              <span>Welcome to</span>
              <OmegloWordmark size="text-[22px]" />
            </h2>
            <p className="text-xs text-zinc-500 mb-6 max-w-[250px] leading-relaxed">
              Select your gender to personalize your random video chat experience. Saved in your browser.
            </p>

            {/* Custom SVG Gender Option Cards */}
            <div className="grid grid-cols-2 gap-3.5 w-full mb-6">
              {/* Male SVG Card */}
              <button
                type="button"
                onClick={() => setTempSelectedGender("male")}
                className={`group relative p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-150 cursor-pointer ${
                  tempSelectedGender === "male"
                    ? "border-zinc-950 bg-zinc-50/80 ring-2 ring-zinc-950 shadow-xs"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                }`}
              >
                {tempSelectedGender === "male" && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-100 p-2 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Image
                    src="/male.svg"
                    alt="Male Avatar"
                    width={56}
                    height={56}
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
                className={`group relative p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-150 cursor-pointer ${
                  tempSelectedGender === "female"
                    ? "border-zinc-950 bg-zinc-50/80 ring-2 ring-zinc-950 shadow-xs"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                }`}
              >
                {tempSelectedGender === "female" && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-100 p-2 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Image
                    src="/female.svg"
                    alt="Female Avatar"
                    width={56}
                    height={56}
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

      {/* Top Header */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/70 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          {/* Brand Logo & Multicolor Wordmark */}
          <div className="flex items-center gap-2.5">
            {/* Minimalist Logo Icon */}
            <div className="w-8.5 h-8.5 rounded-lg overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
              <Image
                src="/logo.webp"
                alt="Omeglo Logo Mark"
                width={34}
                height={34}
                className="w-full h-full object-contain"
                priority
              />
            </div>

            {/* Eye-Friendly Multicolor Typography */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <OmegloWordmark size="text-[19px]" />
              </div>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide leading-none mt-0.5">
                Random Video Chat
              </span>
            </div>
          </div>

          {/* User Gender Tag & Live Online Badges */}
          <div className="flex items-center gap-2.5 sm:gap-4 text-xs">
            {/* Clickable User Gender SVG Badge */}
            {userGender && (
              <button
                onClick={() => {
                  setTempSelectedGender(userGender);
                  setShowGenderModal(true);
                }}
                title="Click to change your gender"
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-800 border border-zinc-200/60 transition-colors cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                  <Image
                    src={userGender === "male" ? "/male.svg" : "/female.svg"}
                    alt={userGender}
                    width={16}
                    height={16}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="capitalize font-medium text-[11px]">{userGender}</span>
                <Edit2 className="w-2.5 h-2.5 text-zinc-400 ml-0.5" />
              </button>
            )}

            {/* Real-time Online Counter from Socket Server */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100/90 text-zinc-700 border border-zinc-200/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <Users className="w-3 h-3 text-zinc-500" />
              <span className="font-medium">{onlineCount}</span>
              <span className="text-zinc-400 hidden sm:inline">online</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
              <Shield className="w-3.5 h-3.5" />
              <span>P2P Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Section: Main Video Stage + Sleek Dock (8 Cols on Desktop) */}
        <section className="lg:col-span-8 flex flex-col gap-3 sm:gap-4">
          {/* Main Video Stage with Analog Scanlines & WhatsApp PiP */}
          <div
            ref={containerRef}
            className="relative w-full aspect-4/3 sm:aspect-16/10 lg:aspect-auto flex-1 min-h-[380px] sm:min-h-[480px] lg:min-h-[540px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-xs flex flex-col items-center justify-center text-zinc-400"
          >
            {/* Stranger Live WebRTC Video Element */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
                status === "connected" && remoteStream ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            />

            {/* Stranger Badge (Top Left) */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-xs font-medium pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  status === "connected"
                    ? "bg-emerald-500"
                    : status === "searching"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-zinc-600"
                }`}
              />
              <span className="text-[11px] font-medium tracking-tight">
                {status === "connected" && strangerGender
                  ? `Stranger (${strangerGender === "female" ? "♀ Female" : "♂ Male"})`
                  : "Stranger"}
              </span>
            </div>

            {/* Quality / Status Badge (Top Right) */}
            {status === "connected" && (
              <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md text-[11px] text-zinc-300 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live P2P
              </div>
            )}

            {/* SEARCHING STATE: Retro TV Static & Scanlines */}
            {status === "searching" && (
              <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden">
                <TvStaticCanvas />
                <div className="absolute inset-0 crt-scanlines" />
                <div className="absolute left-0 right-0 h-24 bg-linear-to-b from-transparent via-white/10 to-transparent animate-scan-beam pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center gap-3.5 p-5 text-center bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl max-w-xs animate-static-flicker">
                  <div className="relative flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200">
                      <Radio className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-white/30 animate-ping opacity-40" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-zinc-100 font-medium text-sm">
                      Connecting to matchmaking...
                    </p>
                    <p className="text-zinc-400 text-xs font-mono">
                      {matchPreference === "female"
                        ? "Looking for female match"
                        : matchPreference === "male"
                        ? "Looking for male match"
                        : "Looking for stranger"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* IDLE STATE */}
            {status === "idle" && (
              <div className="flex flex-col items-center gap-3 p-6 text-center select-none pointer-events-none z-0">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <User className="w-8 h-8 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-200 font-medium text-sm">Ready to chat</p>
                  <p className="text-zinc-500 text-xs max-w-xs">
                    Press Start below to connect with a random stranger.
                  </p>
                </div>
              </div>
            )}

            {/* DISCONNECTED STATE WITH AUTO-NEXT COUNTDOWN */}
            {status === "disconnected" && (
              <div className="flex flex-col items-center gap-3.5 p-6 text-center select-none z-10 max-w-xs animate-in fade-in">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
                  <Info className="w-6 h-6 stroke-[1.5]" />
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
                          className="h-8 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
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

            {/* WhatsApp-Style Floating Draggable 'You' Camera Preview */}
            <div
              ref={pipRef}
              style={
                pipPos
                  ? {
                      left: `${pipPos.x}px`,
                      top: `${pipPos.y}px`,
                      right: "auto",
                      bottom: "auto",
                    }
                  : undefined
              }
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                startDrag(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              className={`absolute ${
                !pipPos ? "bottom-4 right-4" : ""
              } z-20 w-32 h-44 sm:w-38 sm:h-50 bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col justify-between p-2.5 transition-shadow ${
                isDragging ? "cursor-grabbing ring-2 ring-zinc-400/40" : "cursor-grab hover:border-white/40"
              }`}
            >
              {/* Local Webcam Video Stream (Mirrored, z-0) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1] pointer-events-none transition-opacity duration-200 ${
                  isVideoOff || !localStream || hasCameraPermission === false ? "opacity-0" : "opacity-100"
                }`}
              />

              {/* Drag Handle & Label (z-10 above video) */}
              <div className="relative z-10 flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-white text-[10px] font-medium">
                  {userGender ? (
                    <div className="w-3 h-3 rounded-full overflow-hidden flex items-center justify-center">
                      <Image
                        src={userGender === "male" ? "/male.svg" : "/female.svg"}
                        alt={userGender}
                        width={12}
                        height={12}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                  )}
                  <span>You</span>
                </div>
                <div className="text-zinc-400 hover:text-white transition-colors p-0.5">
                  <GripHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Fallback View if Video is Off or Permission Pending */}
              {(isVideoOff || !localStream || hasCameraPermission === false) && (
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-1 pointer-events-none">
                  {hasCameraPermission === false ? (
                    <button
                      type="button"
                      onClick={() => setShowPermissionModal(true)}
                      className="pointer-events-auto p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex flex-col items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition-colors"
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span className="text-[9px] font-medium text-amber-200">Enable Cam</span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 p-1.5 flex items-center justify-center shadow-inner">
                        {userGender ? (
                          <Image
                            src={userGender === "male" ? "/male.svg" : "/female.svg"}
                            alt="Self Avatar"
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <User className="w-5 h-5 stroke-[1.5] text-zinc-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {isVideoOff ? "Camera Off" : "Your Camera"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Spacer when video is live */}
              {!isVideoOff && localStream && hasCameraPermission !== false && (
                <div className="flex-1 pointer-events-none" />
              )}

              {/* In-PiP Media Controls (z-10 above video) */}
              <div className="relative z-10 flex items-center justify-center gap-1 bg-black/60 backdrop-blur-md py-1 px-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMic();
                  }}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isMicMuted
                      ? "bg-red-500/20 text-red-400"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!localStream) {
                      initLocalStream();
                    } else {
                      toggleVideo();
                    }
                  }}
                  title={isVideoOff ? "Turn Cam On" : "Turn Cam Off"}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isVideoOff
                      ? "bg-red-500/20 text-red-400"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* ULTRA-SLEEK MINIMALIST CONTROL DOCK */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
            {/* Left/Main Action Controls */}
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              {status === "idle" ? (
                /* Sleek Start Button */
                <button
                  onClick={handleStart}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Chat</span>
                  <span className="hidden sm:inline-flex text-[10px] font-mono opacity-50 bg-white/15 px-1.5 py-0.5 rounded ml-1">
                    Space
                  </span>
                </button>
              ) : (
                /* Connected / Searching / Disconnected Actions */
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Stop / Leave Button */}
                  <button
                    onClick={handleStop}
                    disabled={status === "disconnected"}
                    title="Stop / Disconnect"
                    className={`h-11 px-4 sm:px-5 rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                      status === "disconnected"
                        ? "bg-zinc-100 text-zinc-300 border border-zinc-200/50 cursor-not-allowed"
                        : "bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-700 border border-zinc-200/70 active:scale-[0.98]"
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>

                  {/* Next / Skip Button */}
                  <button
                    onClick={handleNext}
                    className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Next Stranger</span>
                    <span className="hidden sm:inline-flex text-[10px] font-mono opacity-50 bg-white/15 px-1.5 py-0.5 rounded ml-1">
                      Esc
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Middle: Gender Match Preference Selector (Using Custom Symbol SVGs) */}
            <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/60">
              <span className="text-[10px] text-zinc-400 font-medium px-1.5 hidden md:inline">
                Looking for:
              </span>

              {/* Both / Any */}
              <button
                type="button"
                onClick={() => handleMatchPreferenceChange("any")}
                title="Match with anyone"
                className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                  matchPreference === "any"
                    ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center">
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
                className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                  matchPreference === "female"
                    ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center">
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
                className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                  matchPreference === "male"
                    ? "bg-white text-zinc-950 shadow-2xs font-semibold ring-1 ring-zinc-200/80"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-white/50"
                }`}
              >
                <div className="w-4 h-4 rounded-full flex items-center justify-center">
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
              <div className="p-1 rounded-lg bg-zinc-100 text-zinc-600">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-zinc-950 leading-none">P2P Text Chat</h2>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {status === "connected"
                    ? "Direct Encrypted Connection"
                    : status === "searching"
                    ? "Finding stranger..."
                    : "Idle"}
                </span>
              </div>
            </div>

            {/* Header Controls: Sound Toggle & Clear Chat */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSoundMuted(!isSoundMuted)}
                title={isSoundMuted ? "Unmute Sound Effects" : "Mute Sound Effects"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSoundMuted
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
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 custom-scrollbar bg-zinc-50/30">
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
                    className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${
                      isYou
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
              className={`p-2 rounded-xl transition-all shadow-2xs ${
                inputMessage.trim() && status === "connected"
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
