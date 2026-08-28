"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
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

// Eye-friendly Multicolor Omeglo Brand Wordmark
function OmegloWordmark({ size = "text-[19px]" }: { size?: string }) {
  return (
    <span className={`font-black tracking-tight select-none inline-flex items-center ${size}`}>
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
  const [onlineCount] = useState("2,418");

  // User Gender State & First-time Visit Modal
  const [userGender, setUserGender] = useState<Gender>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [tempSelectedGender, setTempSelectedGender] = useState<"male" | "female">("male");

  // Match Preference / Looking For Filter (Any / Female / Male)
  const [matchPreference, setMatchPreference] = useState<MatchPreference>("any");

  // Draggable PiP State
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Load saved preferences on client mount
  useEffect(() => {
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
  }, []);

  // Save selected gender
  const handleSaveGender = (gender: "male" | "female") => {
    try {
      localStorage.setItem("omeglo_user_gender", gender);
    } catch {}
    setUserGender(gender);
    setShowGenderModal(false);
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
  }, [messages]);

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
    if (matchPreference === "female") return "Looking for a female match...";
    if (matchPreference === "male") return "Looking for a male match...";
    return "Looking for a stranger (Anyone)...";
  };

  // Handle Start
  const handleStart = useCallback(() => {
    setStatus("searching");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: getSearchTargetText(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setTimeout(() => {
      setStatus("connected");
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now() + 1}`,
          sender: "system",
          text: "You're now chatting with a random stranger. Say hi!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1800);
  }, [matchPreference]);

  // Handle Stop
  const handleStop = useCallback(() => {
    if (status === "idle") return;
    setStatus("disconnected");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: "You have disconnected.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [status]);

  // Handle Next
  const handleNext = useCallback(() => {
    setStatus("searching");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: `Skipping... ${getSearchTargetText()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setTimeout(() => {
      setStatus("connected");
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now() + 1}`,
          sender: "system",
          text: "Connected with a new stranger. Say hi!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1600);
  }, [matchPreference]);

  // Keyboard Shortcuts (Esc to Stop/Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGenderModal) return;
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
  }, [status, handleNext, handleStart, showGenderModal]);

  // Handle Send Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "you",
      text: inputMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    if (status === "connected") {
      setTimeout(() => {
        const replies = [
          "Hey there! Where are you from?",
          "Hello! How are you doing today?",
          "Nice to meet you! 😊",
          "Hey! Cool platform.",
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 2}`,
            sender: "stranger",
            text: randomReply,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }, 1500);
    }
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
      {/* FIRST-TIME GENDER SELECTION MODAL */}
      {showGenderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-zinc-200 shadow-2xl flex flex-col items-center text-center">
            {/* Brand Logo Icon */}
            <div className="w-13 h-13 rounded-2xl bg-zinc-50 border border-zinc-100 p-2 flex items-center justify-center mb-3.5 shadow-xs">
              <Image
                src="/logo.svg"
                alt="Omeglo Icon"
                width={40}
                height={40}
                className="w-full h-full object-contain"
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
            {/* Minimalist Vector Logo Icon (No text in image) */}
            <div className="w-8.5 h-8.5 flex items-center justify-center transition-transform hover:scale-105">
              <Image
                src="/logo.svg"
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

          {/* User Gender Tag & Live Badges */}
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

            {/* Online Counter */}
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
              <span>Anonymous</span>
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
              <span className="text-[11px] font-medium tracking-tight">Stranger</span>
            </div>

            {/* Quality / Status Badge (Top Right) */}
            {status === "connected" && (
              <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md text-[11px] text-zinc-300 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live HD
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
                      Connecting to server...
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

            {/* CONNECTED STATE */}
            {status === "connected" && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-zinc-900 to-zinc-950 p-6 text-center pointer-events-none z-0">
                <div className="w-20 h-20 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
                  <User className="w-10 h-10 text-zinc-500 stroke-[1.5]" />
                </div>
                <p className="text-zinc-300 font-medium text-sm mt-3">Stranger's Video Stream</p>
                <p className="text-zinc-500 text-xs mt-0.5">Connected • Encrypted</p>
              </div>
            )}

            {/* DISCONNECTED STATE */}
            {status === "disconnected" && (
              <div className="flex flex-col items-center gap-3 p-6 text-center select-none pointer-events-none z-0">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Info className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-300 font-medium text-sm">Stranger Disconnected</p>
                  <p className="text-zinc-500 text-xs">Press Next to meet someone else</p>
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
              } z-20 w-32 h-44 sm:w-38 sm:h-50 bg-zinc-900/95 border border-white/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col justify-between p-2.5 transition-shadow ${
                isDragging ? "cursor-grabbing ring-2 ring-zinc-400/40" : "cursor-grab hover:border-white/40"
              }`}
            >
              {/* Drag Handle & Label */}
              <div className="flex items-center justify-between w-full">
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

              {/* Self Video Content */}
              <div className="flex-1 flex flex-col items-center justify-center my-1 pointer-events-none">
                {isVideoOff ? (
                  <div className="flex flex-col items-center gap-1">
                    <VideoOff className="w-5 h-5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">Camera Off</span>
                  </div>
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
                    <span className="text-[10px] text-zinc-400 font-medium">Your Camera</span>
                  </div>
                )}
              </div>

              {/* In-PiP Media Controls */}
              <div className="flex items-center justify-center gap-1 bg-black/60 backdrop-blur-md py-1 px-1.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMicMuted(!isMicMuted);
                  }}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                  className={`p-1.5 rounded-lg transition-colors ${
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
                    setIsVideoOff(!isVideoOff);
                  }}
                  title={isVideoOff ? "Turn Cam On" : "Turn Cam Off"}
                  className={`p-1.5 rounded-lg transition-colors ${
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
                <h2 className="text-xs font-semibold text-zinc-950 leading-none">Text Chat</h2>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {status === "connected"
                    ? "Connected to stranger"
                    : status === "searching"
                    ? "Finding stranger..."
                    : "Idle"}
                </span>
              </div>
            </div>

            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              title="Clear chat"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
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
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Box */}
          <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-zinc-100 flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-50 hover:bg-zinc-100/60 focus:bg-white text-xs text-zinc-900 placeholder:text-zinc-400 px-3 py-2 rounded-xl border border-zinc-200/80 focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 transition-all"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`p-2 rounded-xl transition-all shadow-2xs ${
                inputMessage.trim()
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
