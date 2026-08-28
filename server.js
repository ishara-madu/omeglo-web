const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5001;

// Ephemeral Matchmaking State
// waitingQueue: Array<{ socketId: string, peerId: string, gender: string, lookingFor: string, mode: "video" | "text" }>
const waitingQueue = [];
// activePairs: Map<socketId, { partnerSocketId: string, partnerPeerId: string, mode: string }>
const activePairs = new Map();

// Helper: Remove user from waiting queue
function removeFromQueue(socketId) {
  const index = waitingQueue.findIndex((u) => u.socketId === socketId);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
  }
}

// Helper: Find a compatible match in the queue
function findCompatibleMatch(user) {
  for (let i = 0; i < waitingQueue.length; i++) {
    const candidate = waitingQueue[i];
    if (candidate.socketId === user.socketId) continue;

    // Strict Mode Isolation: Video matches Video, Text matches Text
    if (candidate.mode !== user.mode) continue;

    // Check user preference vs candidate gender
    const userLikesCandidate =
      user.lookingFor === "any" || user.lookingFor === candidate.gender;
    // Check candidate preference vs user gender
    const candidateLikesUser =
      candidate.lookingFor === "any" || candidate.lookingFor === user.gender;

    if (userLikesCandidate && candidateLikesUser) {
      // Remove candidate from queue and return
      waitingQueue.splice(i, 1);
      return candidate;
    }
  }
  return null;
}

// Helper: Disconnect an active pair
function cleanupActivePair(socketId) {
  if (activePairs.has(socketId)) {
    const pair = activePairs.get(socketId);
    activePairs.delete(socketId);
    activePairs.delete(pair.partnerSocketId);
    // Notify partner that peer has disconnected
    io.to(pair.partnerSocketId).emit("partner-disconnected");
  }
}

// Health check and metrics
app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "Omeglo Matchmaking Backend",
    onlineSockets: io.engine.clientsCount,
    waitingInQueue: waitingQueue.length,
    activeMatches: activePairs.size / 2,
  });
});

io.on("connection", (socket) => {
  console.log(`[+] User connected: ${socket.id}`);

  // Broadcast current online user count
  io.emit("online-count", io.engine.clientsCount);

  // Event: User clicks 'Start' or 'Next' to find a random match
  socket.on("find-match", ({ peerId, gender, lookingFor, mode }) => {
    if (!peerId) {
      return socket.emit("error-msg", "Peer ID is required to match.");
    }

    const chatMode = mode === "text" ? "text" : "video";

    // Clean up any existing state for this user
    removeFromQueue(socket.id);
    cleanupActivePair(socket.id);

    const currentUser = {
      socketId: socket.id,
      peerId,
      gender: gender || "male",
      lookingFor: lookingFor || "any",
      mode: chatMode,
    };

    const match = findCompatibleMatch(currentUser);

    if (match) {
      console.log(`[!] Match found (${chatMode.toUpperCase()}): ${socket.id} (Initiator) <-> ${match.socketId}`);

      // Register active pair
      activePairs.set(socket.id, {
        partnerSocketId: match.socketId,
        partnerPeerId: match.peerId,
        mode: chatMode,
      });
      activePairs.set(match.socketId, {
        partnerSocketId: socket.id,
        partnerPeerId: peerId,
        mode: chatMode,
      });

      // Emit match found to both peers
      // Current user acts as caller (initiator), partner answers
      socket.emit("match-found", {
        partnerPeerId: match.peerId,
        partnerGender: match.gender,
        initiator: true,
        mode: chatMode,
      });

      io.to(match.socketId).emit("match-found", {
        partnerPeerId: peerId,
        partnerGender: currentUser.gender,
        initiator: false,
        mode: chatMode,
      });
    } else {
      // Add to waiting queue
      waitingQueue.push(currentUser);
      socket.emit("waiting-in-queue");
      console.log(`[*] User waiting in [${chatMode}] queue: ${socket.id} (Queue size: ${waitingQueue.length})`);
    }
  });

  // Event: User clicks 'Stop' or leaves chat
  socket.on("leave-chat", () => {
    removeFromQueue(socket.id);
    cleanupActivePair(socket.id);
    socket.emit("chat-stopped");
  });

  // Event: Socket disconnects
  socket.on("disconnect", () => {
    console.log(`[-] User disconnected: ${socket.id}`);
    removeFromQueue(socket.id);
    cleanupActivePair(socket.id);
    io.emit("online-count", io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Omeglo Matchmaking Backend running on http://localhost:${PORT}`);
});
