const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const d1 = require("./lib/d1");

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
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "omeglo123";

// Helper: Check Admin Auth
function checkAdminAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const customKey = req.headers["x-admin-key"] || "";
  const token = auth.replace("Bearer ", "").trim() || customKey || req.query.key;

  if (token === ADMIN_SECRET) {
    return next();
  }
  return res.status(401).json({ success: false, error: "Unauthorized" });
}

// 1. Admin Overview
app.get("/api/admin/overview", checkAdminAuth, async (req, res) => {
  try {
    const repCount = await d1.executeD1Query("SELECT COUNT(*) as c FROM reports");
    const guarCount = await d1.executeD1Query("SELECT COUNT(*) as c FROM user_reputation WHERE is_quarantined = 1 AND quarantined_until > datetime('now')");
    const banCount = await d1.executeD1Query("SELECT COUNT(*) as c FROM banned_users WHERE expires_at IS NULL OR expires_at > datetime('now')");
    const todayCount = await d1.executeD1Query("SELECT COUNT(*) as c FROM reports WHERE created_at >= date('now')");

    res.json({
      success: true,
      overview: {
        totalReports: repCount?.[0]?.results?.[0]?.c || 0,
        activeQuarantined: guarCount?.[0]?.results?.[0]?.c || 0,
        totalBanned: banCount?.[0]?.results?.[0]?.c || 0,
        todayReports: todayCount?.[0]?.results?.[0]?.c || 0,
        liveSockets: io.engine.clientsCount || 0,
        activeMatches: activePairs.size / 2,
        cleanVideoQueue: cleanVideoQueue.length,
        cleanTextQueue: cleanTextQueue.length,
        quarantinedVideoQueue: quarantinedVideoQueue.length,
        quarantinedTextQueue: quarantinedTextQueue.length,
      },
    });
  } catch (err) {
    res.json({
      success: true,
      overview: {
        totalReports: 0,
        activeQuarantined: 0,
        totalBanned: 0,
        todayReports: 0,
        liveSockets: io.engine.clientsCount || 0,
        activeMatches: activePairs.size / 2,
        cleanVideoQueue: cleanVideoQueue.length,
        cleanTextQueue: cleanTextQueue.length,
        quarantinedVideoQueue: quarantinedVideoQueue.length,
        quarantinedTextQueue: quarantinedTextQueue.length,
      },
    });
  }
});

// 2. Admin Reports Feed
app.get("/api/admin/reports", checkAdminAuth, async (req, res) => {
  try {
    const data = await d1.executeD1Query("SELECT * FROM reports ORDER BY created_at DESC LIMIT 100");
    res.json({ success: true, reports: data?.[0]?.results || [] });
  } catch (err) {
    res.json({ success: true, reports: [] });
  }
});

// 3. Admin Quarantine Pool
app.get("/api/admin/quarantine", checkAdminAuth, async (req, res) => {
  try {
    const data = await d1.executeD1Query("SELECT * FROM user_reputation WHERE is_quarantined = 1 AND quarantined_until > datetime('now') ORDER BY last_reported_at DESC LIMIT 100");
    res.json({ success: true, quarantinedUsers: data?.[0]?.results || [] });
  } catch (err) {
    res.json({ success: true, quarantinedUsers: [] });
  }
});

// 4. Admin Permanent Bans
app.get("/api/admin/bans", checkAdminAuth, async (req, res) => {
  try {
    const data = await d1.executeD1Query("SELECT * FROM banned_users ORDER BY banned_at DESC LIMIT 100");
    res.json({ success: true, bans: data?.[0]?.results || [] });
  } catch (err) {
    res.json({ success: true, bans: [] });
  }
});

// 5. Admin Unban
app.post("/api/admin/unban", checkAdminAuth, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (identifier) {
      await d1.executeD1Query("UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?", [identifier]);
      await d1.executeD1Query("DELETE FROM banned_users WHERE identifier = ?", [identifier]);
    }
    res.json({ success: true, message: `Identifier ${identifier} released to Clean Pool.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Admin Hard Ban
app.post("/api/admin/ban", checkAdminAuth, async (req, res) => {
  try {
    const { identifier, identifierType = "device_id", reason = "Admin Ban", durationHours } = req.body;
    const expiresQuery = durationHours ? `datetime('now', '+${Number(durationHours)} hours')` : "NULL";
    await d1.executeD1Query(
      `INSERT INTO banned_users (id, identifier, identifier_type, reason, banned_at, expires_at)
       VALUES (?, ?, ?, ?, datetime('now'), ${expiresQuery})
       ON CONFLICT(identifier) DO UPDATE SET reason = excluded.reason, banned_at = datetime('now'), expires_at = excluded.expires_at`,
      ["ban_" + Date.now(), identifier, identifierType, reason]
    );
    res.json({ success: true, message: `Identifier ${identifier} hard banned.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Dismiss Report
app.post("/api/admin/dismiss-report", checkAdminAuth, async (req, res) => {
  try {
    const { reportId } = req.body;
    if (reportId) {
      await d1.executeD1Query("UPDATE reports SET status = 'dismissed' WHERE id = ?", [reportId]);
    }
    res.json({ success: true, message: "Report dismissed." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Cleanup
app.post("/api/admin/cleanup", checkAdminAuth, async (req, res) => {
  try {
    const days = req.body.days || 90;
    const del = await d1.executeD1Query(`DELETE FROM reports WHERE created_at < datetime('now', '-${days} days')`);
    res.json({ success: true, message: `Cleanup completed for records older than ${days} days.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. CLEAN Matchmaking Queues (Standard well-behaved users)
const cleanVideoQueue = [];
const cleanTextQueue = [];

// 2. TOXIC SHADOW QUEUES (Quarantine Pool for reported/toxic users)
const quarantinedVideoQueue = [];
const quarantinedTextQueue = [];

// activePairs: Map<socketId, { partnerSocketId: string, partnerPeerId: string, mode: "video" | "text", isQuarantined: boolean }>
const activePairs = new Map();

// userSessions: Map<socketId, { ip: string, peerId: string, fingerprint: object, gender: string, mode: string, isQuarantined: boolean }>
const userSessions = new Map();

// peerSessions: Map<peerId, { socketId, ip, fingerprint, gender, mode, lastActiveAt }>
const peerSessions = new Map();

// Helper: Extract real client IP
function getClientIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return socket.handshake.address || "unknown";
}

// Helper: Remove user from all clean & toxic queues
function removeFromAllQueues(socketId) {
  const cVIdx = cleanVideoQueue.findIndex((u) => u.socketId === socketId);
  if (cVIdx !== -1) cleanVideoQueue.splice(cVIdx, 1);

  const cTIdx = cleanTextQueue.findIndex((u) => u.socketId === socketId);
  if (cTIdx !== -1) cleanTextQueue.splice(cTIdx, 1);

  const qVIdx = quarantinedVideoQueue.findIndex((u) => u.socketId === socketId);
  if (qVIdx !== -1) quarantinedVideoQueue.splice(qVIdx, 1);

  const qTIdx = quarantinedTextQueue.findIndex((u) => u.socketId === socketId);
  if (qTIdx !== -1) quarantinedTextQueue.splice(qTIdx, 1);
}

// Helper: Find a compatible match in the specific isolated queue only
function findCompatibleMatch(user, queue) {
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    if (candidate.socketId === user.socketId) continue;

    const userLikesCandidate =
      user.lookingFor === "any" || user.lookingFor === candidate.gender;
    const candidateLikesUser =
      candidate.lookingFor === "any" || candidate.lookingFor === user.gender;

    if (userLikesCandidate && candidateLikesUser) {
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
    io.to(pair.partnerSocketId).emit("partner-disconnected");
  }
}

// Health check and metrics
app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "Omeglo Toxic Shadow Quarantine Matchmaking Backend",
    d1Configured: d1.isD1Configured,
    onlineSockets: io.engine.clientsCount,
    cleanVideoQueue: cleanVideoQueue.length,
    cleanTextQueue: cleanTextQueue.length,
    quarantinedVideoQueue: quarantinedVideoQueue.length,
    quarantinedTextQueue: quarantinedTextQueue.length,
    activeMatches: activePairs.size / 2,
  });
});

// REST API for Cloudflare D1 Reports (Accessible by Web, Admin Dashboard, and Mobile App)
app.get("/api/reports", async (req, res) => {
  try {
    const { limit, offset, status } = req.query;
    const reports = await d1.getReports({ limit, offset, status });
    res.json({ success: true, count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const { reporterSocketId, reportedSocketId, reportedPeerId, reason, details, mode, ipAddress, fingerprint } = req.body;
    const result = await d1.recordReportAndQuarantine({
      reporterSocketId,
      reportedSocketId,
      reportedPeerId,
      reason,
      details,
      mode,
      ipAddress: ipAddress || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      fingerprint: fingerprint || {},
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ban", async (req, res) => {
  try {
    const { identifier, identifierType, reason, durationHours } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, error: "Identifier (IP, Device UUID, or Fingerprint) is required." });
    }
    const result = await d1.banUser({ identifier, identifierType, reason, durationHours });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual trigger for cleanup (Admin API)
app.post("/api/cleanup", async (req, res) => {
  try {
    const { days = 90 } = req.body;
    await d1.cleanupOldGuestData(days);
    res.json({ success: true, message: `Cleanup executed for records older than ${days} days.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

io.on("connection", (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`[+] User connected: ${socket.id} (IP: ${clientIp})`);

  // Broadcast current online user count
  io.emit("online-count", io.engine.clientsCount);

  // Event: User clicks 'Start' or 'Next' to find a random match
  socket.on("find-match", async ({ peerId, gender, lookingFor, mode, fingerprint }) => {
    if (!peerId) {
      return socket.emit("error-msg", "Peer ID is required to match.");
    }

    const deviceFingerprint = fingerprint || {};

    // 1. Check if user is completely hard-banned
    const isBanned = await d1.isUserBanned(
      clientIp,
      deviceFingerprint.deviceId,
      deviceFingerprint.canvasHash
    );

    if (isBanned) {
      console.warn(`[!] Blocked hard-banned user: IP=${clientIp}, Device=${deviceFingerprint.deviceId}`);
      return socket.emit("error-msg", "Your access has been temporarily restricted due to policy violations.");
    }

    // 2. Check User Reputation & Toxic Shadow Quarantine Status
    const reputation = await d1.getUserReputation(
      clientIp,
      deviceFingerprint.deviceId,
      deviceFingerprint.canvasHash
    );

    const isQuarantined = reputation.isQuarantined;
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
      ip: clientIp,
      fingerprint: deviceFingerprint,
      isQuarantined,
    };

    // Store user session for reporting and moderation lookup
    userSessions.set(socket.id, currentUser);
    peerSessions.set(peerId, currentUser);

    // 3. Isolated Queue Selection
    let targetQueue;
    if (isQuarantined) {
      targetQueue = chatMode === "text" ? quarantinedTextQueue : quarantinedVideoQueue;
      console.log(
        `[☣️ QUARANTINE MATCHMAKING] User ${socket.id} (Reported ${reputation.reportCount}x, until ${reputation.quarantinedUntil?.toISOString()}) -> [${chatMode.toUpperCase()} TOXIC POOL]`
      );
    } else {
      targetQueue = chatMode === "text" ? cleanTextQueue : cleanVideoQueue;
      console.log(
        `[✨ CLEAN MATCHMAKING] User ${socket.id} -> [${chatMode.toUpperCase()} CLEAN POOL]`
      );
    }

    const match = findCompatibleMatch(currentUser, targetQueue);

    if (match) {
      const matchType = isQuarantined ? "☣️ TOXIC-TO-TOXIC" : "✨ CLEAN-TO-CLEAN";
      console.log(`[!] Match found [${matchType}] [${chatMode.toUpperCase()}]: ${socket.id} <-> ${match.socketId}`);

      // Register active pair
      activePairs.set(socket.id, {
        partnerSocketId: match.socketId,
        partnerPeerId: match.peerId,
        mode: chatMode,
        isQuarantined,
      });
      activePairs.set(match.socketId, {
        partnerSocketId: socket.id,
        partnerPeerId: peerId,
        mode: chatMode,
        isQuarantined,
      });

      // Emit match found to both peers
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
    }
  });

  // Event: User reports partner (Locked to specific targetPeerId to prevent reporting newly matched innocents)
  socket.on("report-partner", async ({ targetPeerId, reason, details }) => {
    let targetSocketId = null;
    let targetPeer = targetPeerId;
    let targetSession = null;
    let isCurrentlyActive = false;

    const pair = activePairs.get(socket.id);

    // 1. Check if the report is for the CURRENT active call
    if (pair && (!targetPeerId || pair.partnerPeerId === targetPeerId)) {
      targetSocketId = pair.partnerSocketId;
      targetPeer = pair.partnerPeerId;
      targetSession = userSessions.get(targetSocketId);
      isCurrentlyActive = true;
    } else if (targetPeerId) {
      // 2. Stranger had already skipped or disconnected: look up targetPeer in persistent session registry
      targetSession = peerSessions.get(targetPeerId);
      if (targetSession) {
        targetSocketId = targetSession.socketId;
      }
    }

    if (!targetSession && !targetSocketId && !targetPeer) {
      return console.warn(`[-] Report failed: could not locate target stranger (Peer: ${targetPeerId || "unknown"})`);
    }

    const partnerSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : null;
    const partnerIp = targetSession?.ip || (partnerSocket ? getClientIp(partnerSocket) : "unknown");
    const partnerFingerprint = targetSession?.fingerprint || {};
    const mode = targetSession?.mode || pair?.mode || "video";

    // Save report and accurately quarantine THAT SPECIFIC stranger
    const result = await d1.recordReportAndQuarantine({
      reporterSocketId: socket.id,
      reportedSocketId: targetSocketId || "unknown",
      reportedPeerId: targetPeer || "unknown",
      reason,
      details,
      mode,
      ipAddress: partnerIp,
      fingerprint: partnerFingerprint,
    });

    console.log(
      `[🛡️ ACCURATE REPORT LOCKED] Target: Peer=${targetPeer} Socket=${targetSocketId} (IP: ${partnerIp}) | Quarantine: ${result.durationMinutes} mins`
    );

    // Only sever the active call if we are still connected to THAT SPECIFIC reported partner
    if (isCurrentlyActive && pair) {
      cleanupActivePair(socket.id);
      removeFromAllQueues(socket.id);
      if (targetSocketId) {
        removeFromAllQueues(targetSocketId);
        io.to(targetSocketId).emit("partner-disconnected");
      }
    }

    socket.emit("report-confirmed", { success: true, ...result });
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
    userSessions.delete(socket.id);
    io.emit("online-count", io.engine.clientsCount);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Omeglo Toxic Shadow Quarantine Matchmaking Backend running on http://localhost:${PORT}`);
});
