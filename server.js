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

// Completely Separated Ephemeral Matchmaking Queues
// Video Queue: users wanting Video + Audio + Text
const videoQueue = [];
// Text Queue: users wanting Text Only
const textQueue = [];

// activePairs: Map<socketId, { partnerSocketId: string, partnerPeerId: string, mode: "video" | "text" }>
const activePairs = new Map();

// Helper: Remove user from all queues
function removeFromAllQueues(socketId) {
  const vIdx = videoQueue.findIndex((u) => u.socketId === socketId);
  if (vIdx !== -1) videoQueue.splice(vIdx, 1);

  const tIdx = textQueue.findIndex((u) => u.socketId === socketId);
  if (tIdx !== -1) textQueue.splice(tIdx, 1);
}

// Helper: Find a compatible match in the specific mode queue only
function findCompatibleMatch(user, queue) {
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    if (candidate.socketId === user.socketId) continue;

    // Check user preference vs candidate gender
    const userLikesCandidate =
      user.lookingFor === "any" || user.lookingFor === candidate.gender;
    // Check candidate preference vs user gender
    const candidateLikesUser =
      candidate.lookingFor === "any" || candidate.lookingFor === user.gender;

    if (userLikesCandidate && candidateLikesUser) {
      // Remove candidate from queue and return
      queue.splice(i, 1);
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
    videoQueueSize: videoQueue.length,
    textQueueSize: textQueue.length,
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
    removeFromAllQueues(socket.id);
    cleanupActivePair(socket.id);

    const currentUser = {
      socketId: socket.id,
      peerId,
      gender: gender || "male",
      lookingFor: lookingFor || "any",
      mode: chatMode,
    };

    // Strict Mode Isolation: Text users go to textQueue only; Video users go to videoQueue only
    const targetQueue = chatMode === "text" ? textQueue : videoQueue;
    const match = findCompatibleMatch(currentUser, targetQueue);

    if (match) {
      console.log(`[!] Match found [${chatMode.toUpperCase()} ONLY]: ${socket.id} (Initiator) <-> ${match.socketId}`);

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
      // Add to isolated mode queue
      targetQueue.push(currentUser);
      socket.emit("waiting-in-queue");
      console.log(`[*] User waiting in [${chatMode.toUpperCase()}] queue: ${socket.id} (Queue size: ${targetQueue.length})`);
    }
  });

  // Event: User clicks 'Stop' or leaves chat
  socket.on("leave-chat", () => {
    removeFromAllQueues(socket.id);
    cleanupActivePair(socket.id);
    socket.emit("chat-stopped");
  });

  // Event: Socket disconnects
  socket.on("disconnect", () => {
    console.log(`[-] User disconnected: ${socket.id}`);
    removeFromAllQueues(socket.id);
    cleanupActivePair(socket.id);
    io.emit("online-count", io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Omeglo Matchmaking Backend running on http://localhost:${PORT}`);
});
