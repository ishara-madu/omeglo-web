"use client";

import { useState, useRef, useEffect } from "react";
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
  Sparkles,
  Info,
  RotateCcw,
  GripHorizontal,
  Radio,
} from "lucide-react";

type ChatMessage = {
  id: string;
  sender: "you" | "stranger" | "system";
  text: string;
  timestamp: string;
};

type ConnectionStatus = "idle" | "searching" | "connected" | "disconnected";

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
        // Random grayscale noise pixel for authentic analog static
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

  // Draggable PiP State
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

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

  // Handle Start
  const handleStart = () => {
    setStatus("searching");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: "Looking for a stranger...",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    // Simulated quick connect for UI testing
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
    }, 2000);
  };

  // Handle Stop
  const handleStop = () => {
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
  };

  // Handle Next
  const handleNext = () => {
    setStatus("searching");
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: "Skipping... Looking for another stranger...",
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
    }, 1800);
  };

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
      {/* Top Header */}
      <header className="w-full bg-white border-b border-zinc-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-bold text-lg shadow-xs">
              <span className="tracking-tighter">O</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 leading-none">
                Omeglo
              </h1>
              <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
                RANDOM VIDEO CHAT
              </p>
            </div>
          </div>

          {/* Live Online & Safety Badges */}
          <div className="flex items-center gap-3 sm:gap-5 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100/80 border border-zinc-200/60 text-zinc-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold">{onlineCount}</span>
              <span className="text-xs text-zinc-500 hidden sm:inline">Online</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              <span>Safe & Anonymous</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Section: Main Video Stage + Controls (8 Cols on Desktop) */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Main Stranger Video Stage with Analog Scanlines & WhatsApp PiP */}
          <div
            ref={containerRef}
            className="relative w-full aspect-4/3 sm:aspect-16/10 lg:aspect-auto flex-1 min-h-[380px] sm:min-h-[480px] lg:min-h-[540px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-sm flex flex-col items-center justify-center text-zinc-400"
          >
            {/* Stranger Badge (Top Left) */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-xs font-medium pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "connected"
                    ? "bg-emerald-500"
                    : status === "searching"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-zinc-500"
                }`}
              />
              Stranger
            </div>

            {/* Quality / Status Badge (Top Right) */}
            {status === "connected" && (
              <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md text-[11px] text-zinc-300 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live HD
              </div>
            )}

            {/* SEARCHING STATE: Omegle-Style Retro TV Static & Scanlines */}
            {status === "searching" && (
              <div className="absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden">
                {/* 1. Real-time Canvas White Noise / Static Fuzz */}
                <TvStaticCanvas />

                {/* 2. CRT Horizontal Scanlines Overlay */}
                <div className="absolute inset-0 crt-scanlines" />

                {/* 3. Moving Vertical Scan Beam */}
                <div className="absolute left-0 right-0 h-24 bg-linear-to-b from-transparent via-white/10 to-transparent animate-scan-beam pointer-events-none" />

                {/* 4. Central Searching Radar / Info Card */}
                <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl max-w-xs animate-static-flicker">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200">
                      <Radio className="w-6 h-6 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-100 font-semibold text-sm tracking-wide">
                      Connecting to server...
                    </p>
                    <p className="text-zinc-400 text-xs font-mono">
                      Searching for a stranger
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* IDLE STATE */}
            {status === "idle" && (
              <div className="flex flex-col items-center gap-3 p-6 text-center select-none pointer-events-none z-0">
                <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <User className="w-10 h-10 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-200 font-medium text-base">No Stranger Connected</p>
                  <p className="text-zinc-500 text-xs max-w-xs">
                    Press <span className="text-zinc-300 font-semibold">Start</span> below to connect with someone new.
                  </p>
                </div>
              </div>
            )}

            {/* CONNECTED STATE */}
            {status === "connected" && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-zinc-900 to-zinc-950 p-6 text-center pointer-events-none z-0">
                <div className="w-24 h-24 rounded-full bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
                  <User className="w-12 h-12 text-zinc-500 stroke-[1.5]" />
                </div>
                <p className="text-zinc-300 font-medium text-base mt-4">Stranger's Video Stream</p>
                <p className="text-zinc-500 text-xs mt-1">Live Feed Active</p>
              </div>
            )}

            {/* DISCONNECTED STATE */}
            {status === "disconnected" && (
              <div className="flex flex-col items-center gap-3 p-6 text-center select-none pointer-events-none z-0">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Info className="w-7 h-7 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-300 font-medium text-base">Stranger Disconnected</p>
                  <p className="text-zinc-500 text-xs">Press Next to start chatting with another stranger</p>
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
              } z-20 w-32 h-44 sm:w-40 sm:h-52 bg-zinc-900/95 border-2 border-white/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col justify-between p-2.5 transition-shadow ${
                isDragging ? "cursor-grabbing shadow-white/10 ring-2 ring-blue-500/50" : "cursor-grab hover:border-white/40"
              }`}
            >
              {/* Drag Handle & Label */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-white text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  You
                </div>
                <div className="text-zinc-400 hover:text-white transition-colors p-0.5">
                  <GripHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Self Video Placeholder Content */}
              <div className="flex-1 flex flex-col items-center justify-center my-1 pointer-events-none">
                {isVideoOff ? (
                  <div className="flex flex-col items-center gap-1">
                    <VideoOff className="w-6 h-6 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">Camera Off</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                      <User className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">Your Camera</span>
                  </div>
                )}
              </div>

              {/* Bottom Quick Controls in PiP */}
              <div className="flex items-center justify-center gap-1.5 bg-black/60 backdrop-blur-md py-1 px-1.5 rounded-xl border border-white/10">
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

          {/* Bottom Action Controls Bar */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            {/* Primary Action Buttons: Start, Stop, Next */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={status === "searching" || status === "connected"}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs ${
                  status === "searching" || status === "connected"
                    ? "bg-zinc-100 text-zinc-400 border border-zinc-200/60 cursor-not-allowed"
                    : "bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white cursor-pointer"
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start</span>
              </button>

              {/* Stop Button */}
              <button
                onClick={handleStop}
                disabled={status === "idle" || status === "disconnected"}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  status === "idle" || status === "disconnected"
                    ? "bg-zinc-50 text-zinc-300 border-zinc-200/60 cursor-not-allowed"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-[0.98] cursor-pointer"
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs transition-all duration-200 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
                <span>Next</span>
              </button>
            </div>

            {/* Quick Helper Tips */}
            <div className="hidden md:flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="font-mono bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-1.5 py-0.5 rounded text-[10px]">
                  Drag PiP
                </span>
                Move preview
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-1.5 py-0.5 rounded text-[10px]">
                  Esc
                </span>
                Stop / Next
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-1.5 py-0.5 rounded text-[10px]">
                  Enter
                </span>
                Send Message
              </span>
            </div>
          </div>
        </section>

        {/* Right Section: Text Chat Area (4 Cols on Desktop) */}
        <section className="lg:col-span-4 flex flex-col bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs h-[420px] lg:h-auto min-h-[420px]">
          {/* Chat Panel Header */}
          <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 leading-none">Text Chat</h2>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {status === "connected"
                    ? "Chatting with stranger"
                    : status === "searching"
                    ? "Waiting for connection..."
                    : "Not connected"}
                </span>
              </div>
            </div>

            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              title="Clear messages"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chat Messages List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-zinc-50/40">
            {messages.map((msg) => {
              if (msg.sender === "system") {
                return (
                  <div key={msg.id} className="flex justify-center my-1.5">
                    <div className="text-[11px] text-zinc-500 font-medium bg-zinc-100/90 border border-zinc-200/60 px-3 py-1 rounded-full max-w-[85%] text-center">
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
                  <span className="text-[10px] text-zinc-400 font-medium px-1 mb-1">
                    {isYou ? "You" : "Stranger"} • {msg.timestamp}
                  </span>
                  <div
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      isYou
                        ? "bg-zinc-900 text-white rounded-tr-xs shadow-xs"
                        : "bg-white text-zinc-800 border border-zinc-200/80 rounded-tl-xs shadow-xs"
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
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-100 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-sm text-zinc-900 placeholder:text-zinc-400 px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`p-2.5 rounded-xl transition-all shadow-xs ${
                inputMessage.trim()
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 cursor-pointer"
                  : "bg-zinc-100 text-zinc-300 border border-zinc-200/60 cursor-not-allowed"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
