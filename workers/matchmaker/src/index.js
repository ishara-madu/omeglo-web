/**
 * Omeglo - 100% Cloudflare Native Realtime WebSocket Matchmaking & Moderation Backend
 * Runs globally on Cloudflare Edge with zero server cost and zero sleep issues.
 */

export class Matchmaker {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Ephemeral Matchmaking Queues
    this.cleanVideoQueue = [];
    this.cleanTextQueue = [];
    this.quarantinedVideoQueue = [];
    this.quarantinedTextQueue = [];

    // Session Maps
    // activePairs: Map<socketId, { partnerSocketId, partnerPeerId, mode, isQuarantined, ws }>
    this.activePairs = new Map();
    // userSessions: Map<socketId, { ws, ip, peerId, fingerprint, gender, mode, isQuarantined }>
    this.userSessions = new Map();
    // peerSessions: Map<peerId, { socketId, ip, fingerprint, gender, mode, isQuarantined }>
    this.peerSessions = new Map();

    // Sockets Map
    this.sockets = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 1. Health check & status endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify(
          {
            status: "online",
            name: "Omeglo Cloudflare Native Matchmaking Backend",
            onlineUsers: this.sockets.size,
            cleanVideoQueue: this.cleanVideoQueue.length,
            cleanTextQueue: this.cleanTextQueue.length,
            quarantinedVideoQueue: this.quarantinedVideoQueue.length,
            quarantinedTextQueue: this.quarantinedTextQueue.length,
            activeMatches: this.activePairs.size / 2,
          },
          null,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 2. WebSocket Upgrade Request
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const clientIp =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("x-forwarded-for") ||
        "unknown";

      await this.handleWebSocket(server, clientIp);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async handleWebSocket(ws, clientIp) {
    ws.accept();
    const socketId = "sock_" + crypto.randomUUID();
    this.sockets.set(socketId, ws);

    console.log(`[+] User connected: ${socketId} (IP: ${clientIp})`);
    this.broadcastOnlineCount();

    ws.addEventListener("message", async (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        const event = payload.event;
        const data = payload.data || {};

        if (event === "find-match") {
          await this.handleFindMatch(socketId, ws, clientIp, data);
        } else if (event === "report-partner") {
          await this.handleReportPartner(socketId, ws, clientIp, data);
        } else if (event === "leave-chat") {
          this.handleLeaveChat(socketId);
        }
      } catch (err) {
        console.error("[-] Error handling message:", err);
      }
    });

    ws.addEventListener("close", () => {
      console.log(`[-] User disconnected: ${socketId}`);
      this.removeFromAllQueues(socketId);
      this.cleanupActivePair(socketId);
      this.sockets.delete(socketId);
      this.userSessions.delete(socketId);
      this.broadcastOnlineCount();
    });

    ws.addEventListener("error", (err) => {
      console.warn("WebSocket error:", err);
    });
  }

  emit(socketId, event, data) {
    const ws = this.sockets.get(socketId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ event, data }));
    }
  }

  broadcastOnlineCount() {
    const count = this.sockets.size;
    for (const [id, ws] of this.sockets.entries()) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ event: "online-count", data: count }));
      }
    }
  }

  removeFromAllQueues(socketId) {
    const filterOut = (q) => {
      const idx = q.findIndex((u) => u.socketId === socketId);
      if (idx !== -1) q.splice(idx, 1);
    };
    filterOut(this.cleanVideoQueue);
    filterOut(this.cleanTextQueue);
    filterOut(this.quarantinedVideoQueue);
    filterOut(this.quarantinedTextQueue);
  }

  findCompatibleMatch(user, queue) {
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

  cleanupActivePair(socketId) {
    if (this.activePairs.has(socketId)) {
      const pair = this.activePairs.get(socketId);
      this.activePairs.delete(socketId);
      this.activePairs.delete(pair.partnerSocketId);
      this.emit(pair.partnerSocketId, "partner-disconnected", {});
    }
  }

  async handleFindMatch(socketId, ws, clientIp, { peerId, gender, lookingFor, mode, fingerprint }) {
    if (!peerId) {
      return this.emit(socketId, "error-msg", "Peer ID is required.");
    }

    const deviceFingerprint = fingerprint || {};

    // 1. Check Hard Bans
    if (this.env.DB) {
      try {
        const bannedCheck = await this.env.DB.prepare(
          "SELECT id FROM banned_users WHERE (identifier = ? OR identifier = ?) AND (expires_at IS NULL OR expires_at > datetime('now')) LIMIT 1"
        )
          .bind(clientIp, deviceFingerprint.deviceId || "")
          .first();

        if (bannedCheck) {
          return this.emit(
            socketId,
            "error-msg",
            "Your access has been temporarily restricted due to policy violations."
          );
        }
      } catch (err) {
        console.error("D1 ban check error:", err);
      }
    }

    // 2. Check Toxic Quarantine Status in D1
    let isQuarantined = false;
    let reportCount = 0;
    if (this.env.DB) {
      try {
        const rep = await this.env.DB.prepare(
          "SELECT report_count, is_quarantined, quarantined_until FROM user_reputation WHERE (identifier = ? OR identifier = ?) AND is_quarantined = 1 AND quarantined_until > datetime('now') ORDER BY report_count DESC LIMIT 1"
        )
          .bind(clientIp, deviceFingerprint.deviceId || "")
          .first();

        if (rep) {
          isQuarantined = true;
          reportCount = rep.report_count;
        }
      } catch (err) {
        console.error("D1 reputation check error:", err);
      }
    }

    const chatMode = mode === "text" ? "text" : "video";

    this.removeFromAllQueues(socketId);
    this.cleanupActivePair(socketId);

    const currentUser = {
      socketId,
      peerId,
      gender: gender || "male",
      lookingFor: lookingFor || "any",
      mode: chatMode,
      ip: clientIp,
      fingerprint: deviceFingerprint,
      isQuarantined,
    };

    this.userSessions.set(socketId, currentUser);
    this.peerSessions.set(peerId, currentUser);

    let targetQueue;
    if (isQuarantined) {
      targetQueue = chatMode === "text" ? this.quarantinedTextQueue : this.quarantinedVideoQueue;
    } else {
      targetQueue = chatMode === "text" ? this.cleanTextQueue : this.cleanVideoQueue;
    }

    const match = this.findCompatibleMatch(currentUser, targetQueue);

    if (match) {
      this.activePairs.set(socketId, {
        partnerSocketId: match.socketId,
        partnerPeerId: match.peerId,
        mode: chatMode,
        isQuarantined,
      });
      this.activePairs.set(match.socketId, {
        partnerSocketId: socketId,
        partnerPeerId: peerId,
        mode: chatMode,
        isQuarantined,
      });

      this.emit(socketId, "match-found", {
        partnerPeerId: match.peerId,
        partnerGender: match.gender,
        initiator: true,
        mode: chatMode,
      });

      this.emit(match.socketId, "match-found", {
        partnerPeerId: peerId,
        partnerGender: currentUser.gender,
        initiator: false,
        mode: chatMode,
      });
    } else {
      targetQueue.push(currentUser);
      this.emit(socketId, "waiting-in-queue", {});
    }
  }

  async handleReportPartner(socketId, ws, clientIp, { targetPeerId, reason, details }) {
    let targetSocketId = null;
    let targetPeer = targetPeerId;
    let targetSession = null;
    let isCurrentlyActive = false;

    const pair = this.activePairs.get(socketId);

    if (pair && (!targetPeerId || pair.partnerPeerId === targetPeerId)) {
      targetSocketId = pair.partnerSocketId;
      targetPeer = pair.partnerPeerId;
      targetSession = this.userSessions.get(targetSocketId);
      isCurrentlyActive = true;
    } else if (targetPeerId) {
      targetSession = this.peerSessions.get(targetPeerId);
      if (targetSession) targetSocketId = targetSession.socketId;
    }

    const partnerIp = targetSession?.ip || "unknown";
    const partnerFingerprint = targetSession?.fingerprint || {};
    const mode = targetSession?.mode || pair?.mode || "video";
    const primaryIdentifier = partnerFingerprint.deviceId || partnerIp;

    // Calculate quarantine duration
    let durationMinutes = 30;
    if (reason === "nudity" || reason === "underage") durationMinutes = 60;

    // Save to Cloudflare D1
    if (this.env.DB) {
      try {
        const reportId = "rep_" + crypto.randomUUID();
        await this.env.DB.prepare(
          `INSERT INTO reports (id, reporter_socket_id, reported_socket_id, reported_peer_id, reported_device_id, reported_user_agent, reported_platform, reported_screen, reported_timezone, reported_language, reported_gpu, reported_metadata, reason, details, mode, ip_address, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', datetime('now'))`
        )
          .bind(
            reportId,
            socketId,
            targetSocketId || "unknown",
            targetPeer || "unknown",
            partnerFingerprint.deviceId || "unknown",
            partnerFingerprint.userAgent || "unknown",
            partnerFingerprint.platform || "unknown",
            partnerFingerprint.screenResolution || "unknown",
            partnerFingerprint.timezone || "unknown",
            partnerFingerprint.language || "unknown",
            partnerFingerprint.gpuRenderer || "unknown",
            JSON.stringify(partnerFingerprint),
            reason || "other",
            details || "",
            mode,
            partnerIp
          )
          .run();

        // Upsert reputation
        await this.env.DB.prepare(
          `INSERT INTO user_reputation (id, identifier, identifier_type, report_count, is_quarantined, quarantined_until, last_reported_at, created_at)
           VALUES (?, ?, ?, 1, 1, datetime('now', '+${durationMinutes} minutes'), datetime('now'), datetime('now'))
           ON CONFLICT(identifier) DO UPDATE SET
             report_count = report_count + 1,
             is_quarantined = 1,
             quarantined_until = datetime('now', '+${durationMinutes} minutes'),
             last_reported_at = datetime('now')`
        )
          .bind("rep_u_" + crypto.randomUUID(), primaryIdentifier, partnerFingerprint.deviceId ? "device_id" : "ip")
          .run();
      } catch (err) {
        console.error("D1 report save error:", err);
      }
    }

    if (isCurrentlyActive && pair) {
      this.cleanupActivePair(socketId);
      this.removeFromAllQueues(socketId);
      if (targetSocketId) {
        this.removeFromAllQueues(targetSocketId);
        this.emit(targetSocketId, "partner-disconnected", {});
      }
    }

    this.emit(socketId, "report-confirmed", { success: true, durationMinutes });
  }

  handleLeaveChat(socketId) {
    this.removeFromAllQueues(socketId);
    this.cleanupActivePair(socketId);
    this.emit(socketId, "chat-stopped", {});
  }
}

export default {
  async fetch(request, env, ctx) {
    // Route to global singleton Durable Object
    const id = env.MATCHMAKER.idFromName("GLOBAL_OMEGLO_LOBBY");
    const obj = env.MATCHMAKER.get(id);
    return obj.fetch(request);
  },
};
