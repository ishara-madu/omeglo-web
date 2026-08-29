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

    // Sockets & Geo Map
    this.sockets = new Map();
    this.socketGeo = new Map();

    // In-memory Traffic & Duration Analytics Buffer (flushed periodically to D1)
    this.pendingAnalytics = new Map();
    this.lastFlushTs = Date.now();
  }

  recordVisitor(country) {
    const c = (country || "LK").toUpperCase();
    if (!this.pendingAnalytics.has(c)) {
      this.pendingAnalytics.set(c, { visitors: 0, calls: 0, duration: 0 });
    }
    this.pendingAnalytics.get(c).visitors += 1;
  }

  recordCallDuration(country, durationSecs = 0) {
    const c = (country || "LK").toUpperCase();
    if (!this.pendingAnalytics.has(c)) {
      this.pendingAnalytics.set(c, { visitors: 0, calls: 0, duration: 0 });
    }
    const entry = this.pendingAnalytics.get(c);
    entry.calls += 1;
    entry.duration += Math.max(1, durationSecs);

    // If 3+ minutes passed or 20+ records queued, flush asynchronously
    if (Date.now() - this.lastFlushTs > 180000 || this.pendingAnalytics.size >= 20) {
      this.flushAnalytics();
    }
  }

  async flushAnalytics() {
    if (!this.env.DB || this.pendingAnalytics.size === 0) return;
    this.lastFlushTs = Date.now();
    const entries = Array.from(this.pendingAnalytics.entries());
    this.pendingAnalytics.clear();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const countryNames = {
      LK: "Sri Lanka", US: "United States", IN: "India", GB: "United Kingdom",
      CA: "Canada", AU: "Australia", DE: "Germany", FR: "France", AE: "UAE",
      SA: "Saudi Arabia", SG: "Singapore", MY: "Malaysia", IT: "Italy", ES: "Spain",
      NL: "Netherlands", BR: "Brazil", JP: "Japan", KR: "South Korea", RU: "Russia",
      PK: "Pakistan", BD: "Bangladesh", QA: "Qatar", KW: "Kuwait", OM: "Oman",
      ID: "Indonesia", PH: "Philippines", TH: "Thailand", VN: "Vietnam", NZ: "New Zealand"
    };

    for (const [country, stats] of entries) {
      try {
        const name = countryNames[country] || country;
        await this.env.DB.prepare(
          `INSERT INTO daily_traffic_stats (date, country, country_name, total_visitors, total_calls, total_duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(date, country) DO UPDATE SET
             total_visitors = total_visitors + excluded.total_visitors,
             total_calls = total_calls + excluded.total_calls,
             total_duration_seconds = total_duration_seconds + excluded.total_duration_seconds`
        )
          .bind(today, country, name, stats.visitors, stats.calls, stats.duration)
          .run();
      } catch (err) {
        console.error("Flush analytics error for", country, err);
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade Request (Must be checked first)
    const upgradeHeader = (request.headers.get("Upgrade") || request.headers.get("upgrade") || "").toLowerCase();
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const clientIp =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("x-forwarded-for") ||
        "unknown";

      const geo = {
        country: request.cf?.country || "LK",
        city: request.cf?.city || "Colombo",
        region: request.cf?.region || "",
        continent: request.cf?.continent || "AS",
      };

      await this.handleWebSocket(server, clientIp, geo);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
        },
      });
    }

    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    };

    // Helper: Check Admin Authentication strictly against Cloudflare Environment Variable / Secret
    const authHeader = request.headers.get("Authorization") || "";
    const customKeyHeader = request.headers.get("X-Admin-Key") || "";
    const adminKey = (this.env.ADMIN_SECRET_KEY || this.env.ADMIN_KEY || "").trim();

    const isAuthorized =
      Boolean(adminKey) &&
      (authHeader === `Bearer ${adminKey}` ||
        customKeyHeader === adminKey ||
        url.searchParams.get("key") === adminKey);

    // ==========================================
    // Admin API Routes
    // ==========================================
    if (url.pathname.startsWith("/api/admin/")) {
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized: Invalid or missing Admin Passcode." }),
          { status: 401, headers: corsHeaders }
        );
      }

      // 1. Admin Overview & Live Metrics
      if (url.pathname === "/api/admin/overview") {
        let totalReports = 0;
        let activeQuarantined = 0;
        let totalBanned = 0;
        let todayReports = 0;

        if (this.env.DB) {
          try {
            const repCount = await this.env.DB.prepare("SELECT COUNT(*) as c FROM reports").first();
            totalReports = repCount?.c || 0;

            const guarCount = await this.env.DB.prepare(
              "SELECT COUNT(*) as c FROM user_reputation WHERE is_quarantined = 1 AND quarantined_until > datetime('now')"
            ).first();
            activeQuarantined = guarCount?.c || 0;

            const banCount = await this.env.DB.prepare(
              "SELECT COUNT(*) as c FROM banned_users WHERE expires_at IS NULL OR expires_at > datetime('now')"
            ).first();
            totalBanned = banCount?.c || 0;

            const todayCount = await this.env.DB.prepare(
              "SELECT COUNT(*) as c FROM reports WHERE created_at >= date('now')"
            ).first();
            todayReports = todayCount?.c || 0;
          } catch (err) {
            console.error("Overview metrics error:", err);
          }
        }

        // Aggregate Real-time Live Country Distribution
        const countryCounts = {};
        let totalGeoUsers = 0;
        for (const [sId, g] of this.socketGeo.entries()) {
          const c = (g.country || "LK").toUpperCase();
          countryCounts[c] = (countryCounts[c] || 0) + 1;
          totalGeoUsers++;
        }

        const countryNames = {
          LK: "Sri Lanka", US: "United States", IN: "India", GB: "United Kingdom",
          CA: "Canada", AU: "Australia", DE: "Germany", FR: "France", AE: "UAE",
          SA: "Saudi Arabia", SG: "Singapore", MY: "Malaysia", IT: "Italy", ES: "Spain",
          NL: "Netherlands", BR: "Brazil", JP: "Japan", KR: "South Korea", RU: "Russia",
          PK: "Pakistan", BD: "Bangladesh", QA: "Qatar", KW: "Kuwait", OM: "Oman",
          ID: "Indonesia", PH: "Philippines", TH: "Thailand", VN: "Vietnam", NZ: "New Zealand"
        };

        const getFlag = (code) =>
          code && code.length === 2
            ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
            : "🌐";

        let geoStats = Object.entries(countryCounts)
          .map(([code, count]) => ({
            country: code,
            name: countryNames[code] || code,
            flag: getFlag(code),
            count,
            percentage: totalGeoUsers > 0 ? Math.round((count / totalGeoUsers) * 100) : 100,
          }))
          .sort((a, b) => b.count - a.count);

        return new Response(
          JSON.stringify({
            success: true,
            overview: {
              totalReports,
              activeQuarantined,
              totalBanned,
              todayReports,
              liveSockets: this.sockets.size,
              activeMatches: this.activePairs.size / 2,
              cleanVideoQueue: this.cleanVideoQueue.length,
              cleanTextQueue: this.cleanTextQueue.length,
              quarantinedVideoQueue: this.quarantinedVideoQueue.length,
              quarantinedTextQueue: this.quarantinedTextQueue.length,
              geoStats,
            },
          }),
          { headers: corsHeaders }
        );
      }

      // 1.1 Admin Historical Traffic & Duration Analytics (1d, 7d, 28d, 90d)
      if (url.pathname === "/api/admin/analytics") {
        const range = url.searchParams.get("range") || "7d";
        const daysMap = { "1d": 1, "7d": 7, "28d": 28, "90d": 90 };
        const days = daysMap[range] || 7;

        // Flush pending buffer before reading
        await this.flushAnalytics();

        let timeline = [];
        let countryStats = [];
        let summary = {
          totalVisitors: 0,
          totalCalls: 0,
          totalDurationSeconds: 0,
          avgCallDurationSeconds: 0,
        };

        if (this.env.DB) {
          try {
            const res = await this.env.DB.prepare(
              `SELECT date, country, country_name, total_visitors, total_calls, total_duration_seconds
               FROM daily_traffic_stats
               WHERE date >= date('now', '-${days} days')
               ORDER BY date ASC`
            ).all();

            const rows = res.results || [];
            const dateMap = {};
            const countryAgg = {};

            for (const r of rows) {
              summary.totalVisitors += r.total_visitors || 0;
              summary.totalCalls += r.total_calls || 0;
              summary.totalDurationSeconds += r.total_duration_seconds || 0;

              // Aggregate by date for timeline chart
              if (!dateMap[r.date]) {
                dateMap[r.date] = { date: r.date, visitors: 0, calls: 0, durationMinutes: 0 };
              }
              dateMap[r.date].visitors += r.total_visitors || 0;
              dateMap[r.date].calls += r.total_calls || 0;
              dateMap[r.date].durationMinutes += Math.round((r.total_duration_seconds || 0) / 60);

              // Aggregate by country
              const c = r.country;
              if (!countryAgg[c]) {
                countryAgg[c] = {
                  country: c,
                  name: r.country_name || c,
                  visitors: 0,
                  calls: 0,
                  durationSeconds: 0,
                };
              }
              countryAgg[c].visitors += r.total_visitors || 0;
              countryAgg[c].calls += r.total_calls || 0;
              countryAgg[c].durationSeconds += r.total_duration_seconds || 0;
            }

            timeline = Object.values(dateMap);
            if (summary.totalCalls > 0) {
              summary.avgCallDurationSeconds = Math.round(summary.totalDurationSeconds / summary.totalCalls);
            }

            const getFlag = (code) =>
              code && code.length === 2
                ? String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)))
                : "🌐";

            countryStats = Object.values(countryAgg)
              .map((c) => ({
                country: c.country,
                name: c.name,
                flag: getFlag(c.country),
                visitors: c.visitors,
                calls: c.calls,
                totalDurationMinutes: Math.round(c.durationSeconds / 60),
                avgDurationSeconds: c.calls > 0 ? Math.round(c.durationSeconds / c.calls) : 0,
              }))
              .sort((a, b) => b.calls - a.calls || b.totalDurationMinutes - a.totalDurationMinutes);
          } catch (err) {
            console.error("Fetch analytics error:", err);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            range,
            summary,
            timeline,
            countryStats,
          }),
          { headers: corsHeaders }
        );
      }

      // 2. Admin Reports Feed
      if (url.pathname === "/api/admin/reports") {
        let reports = [];
        if (this.env.DB) {
          try {
            const res = await this.env.DB.prepare(
              "SELECT * FROM reports ORDER BY created_at DESC LIMIT 100"
            ).all();
            reports = res.results || [];
          } catch (err) {
            console.error("Fetch reports error:", err);
          }
        }
        return new Response(JSON.stringify({ success: true, reports }), { headers: corsHeaders });
      }

      // 3. Admin Quarantine Pool
      if (url.pathname === "/api/admin/quarantine") {
        let quarantinedUsers = [];
        if (this.env.DB) {
          try {
            const res = await this.env.DB.prepare(
              "SELECT * FROM user_reputation WHERE is_quarantined = 1 AND quarantined_until > datetime('now') ORDER BY last_reported_at DESC LIMIT 100"
            ).all();
            quarantinedUsers = res.results || [];
          } catch (err) {
            console.error("Fetch quarantine error:", err);
          }
        }
        return new Response(JSON.stringify({ success: true, quarantinedUsers }), { headers: corsHeaders });
      }

      // 4. Admin Permanent Bans
      if (url.pathname === "/api/admin/bans") {
        let bans = [];
        if (this.env.DB) {
          try {
            const res = await this.env.DB.prepare(
              "SELECT * FROM banned_users ORDER BY banned_at DESC LIMIT 100"
            ).all();
            bans = res.results || [];
          } catch (err) {
            console.error("Fetch bans error:", err);
          }
        }
        return new Response(JSON.stringify({ success: true, bans }), { headers: corsHeaders });
      }

      // 5. Action: Release / Unban User (Reset reputation to clean pool & resolve report)
      if (url.pathname === "/api/admin/unban" && request.method === "POST") {
        try {
          const body = await request.json();
          const { identifier, reportId, deviceId, ip } = body || {};
          const targetId = identifier || deviceId || ip;

          if (!targetId && !reportId) {
            return new Response(JSON.stringify({ success: false, error: "Identifier or Report ID is required" }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          if (this.env.DB) {
            if (targetId) {
              await this.env.DB.prepare(
                "UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?"
              )
                .bind(targetId)
                .run();

              await this.env.DB.prepare("DELETE FROM banned_users WHERE identifier = ?")
                .bind(targetId)
                .run();
            }

            if (deviceId && deviceId !== targetId) {
              await this.env.DB.prepare(
                "UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?"
              )
                .bind(deviceId)
                .run();
            }

            if (ip && ip !== targetId) {
              await this.env.DB.prepare(
                "UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?"
              )
                .bind(ip)
                .run();
            }

            // Also mark associated report(s) as resolved
            if (reportId) {
              await this.env.DB.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?")
                .bind(reportId)
                .run();
            } else if (targetId) {
              await this.env.DB.prepare(
                "UPDATE reports SET status = 'resolved' WHERE reported_device_id = ? OR ip_address = ?"
              )
                .bind(targetId, targetId)
                .run();
            }
          }

          return new Response(
            JSON.stringify({ success: true, message: `User released to Clean Pool and report marked as resolved.` }),
            { headers: corsHeaders }
          );
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 6. Action: Add Permanent / Long-term Hard Ban
      if (url.pathname === "/api/admin/ban" && request.method === "POST") {
        try {
          const body = await request.json();
          const { identifier, identifierType = "device_id", reason = "Admin Manual Ban", durationHours = null } = body || {};

          if (!identifier) {
            return new Response(JSON.stringify({ success: false, error: "Identifier is required" }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          if (this.env.DB) {
            const banId = "ban_" + crypto.randomUUID();
            const expiresQuery = durationHours
              ? `datetime('now', '+${Number(durationHours)} hours')`
              : "NULL";

            await this.env.DB.prepare(
              `INSERT INTO banned_users (id, identifier, identifier_type, reason, banned_at, expires_at)
               VALUES (?, ?, ?, ?, datetime('now'), ${expiresQuery})
               ON CONFLICT(identifier) DO UPDATE SET
                 reason = excluded.reason,
                 banned_at = datetime('now'),
                 expires_at = excluded.expires_at`
            )
              .bind(banId, identifier, identifierType, reason)
              .run();

            // Also lock in reputation table
            await this.env.DB.prepare(
              `INSERT INTO user_reputation (id, identifier, identifier_type, report_count, is_quarantined, quarantined_until, last_reported_at, created_at)
               VALUES (?, ?, ?, 5, 1, datetime('now', '+30 days'), datetime('now'), datetime('now'))
               ON CONFLICT(identifier) DO UPDATE SET
                 report_count = report_count + 1,
                 is_quarantined = 1,
                 quarantined_until = datetime('now', '+30 days'),
                 last_reported_at = datetime('now')`
            )
              .bind("rep_" + crypto.randomUUID(), identifier, identifierType)
              .run();
          }

          return new Response(
            JSON.stringify({ success: true, message: `Identifier ${identifier} has been hard banned.` }),
            { headers: corsHeaders }
          );
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 7. Action: Dismiss a false report
      if (url.pathname === "/api/admin/dismiss-report" && request.method === "POST") {
        try {
          const body = await request.json();
          const { reportId, releaseUser, identifier } = body || {};
          if (this.env.DB && reportId) {
            await this.env.DB.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ?")
              .bind(reportId)
              .run();

            if (releaseUser && identifier) {
              await this.env.DB.prepare(
                "UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?"
              )
                .bind(identifier)
                .run();
            }
          }
          return new Response(JSON.stringify({ success: true, message: "Report dismissed successfully." }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 8. Action: Delete a report permanently
      if (url.pathname === "/api/admin/delete-report" && request.method === "POST") {
        try {
          const body = await request.json();
          const reportId = body?.reportId;
          if (this.env.DB && reportId) {
            await this.env.DB.prepare("DELETE FROM reports WHERE id = ?")
              .bind(reportId)
              .run();
          }
          return new Response(JSON.stringify({ success: true, message: "Report permanently deleted." }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 9. Action: Batch Delete Reports
      if (url.pathname === "/api/admin/batch-delete-reports" && request.method === "POST") {
        try {
          const body = await request.json();
          const reportIds = body?.reportIds || [];
          if (this.env.DB && Array.isArray(reportIds) && reportIds.length > 0) {
            const placeholders = reportIds.map(() => "?").join(",");
            await this.env.DB.prepare(`DELETE FROM reports WHERE id IN (${placeholders})`)
              .bind(...reportIds)
              .run();
          }
          return new Response(JSON.stringify({ success: true, message: `${reportIds.length} reports deleted successfully.` }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 10. Action: Batch Dismiss Reports
      if (url.pathname === "/api/admin/batch-dismiss-reports" && request.method === "POST") {
        try {
          const body = await request.json();
          const reportIds = body?.reportIds || [];
          if (this.env.DB && Array.isArray(reportIds) && reportIds.length > 0) {
            const placeholders = reportIds.map(() => "?").join(",");
            await this.env.DB.prepare(`UPDATE reports SET status = 'dismissed' WHERE id IN (${placeholders})`)
              .bind(...reportIds)
              .run();
          }
          return new Response(JSON.stringify({ success: true, message: `${reportIds.length} reports dismissed.` }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 11. Action: Delete / Remove Ban
      if (url.pathname === "/api/admin/delete-ban" && request.method === "POST") {
        try {
          const body = await request.json();
          const { banId, identifier } = body || {};
          if (this.env.DB) {
            if (banId) {
              await this.env.DB.prepare("DELETE FROM banned_users WHERE id = ?").bind(banId).run();
            } else if (identifier) {
              await this.env.DB.prepare("DELETE FROM banned_users WHERE identifier = ?").bind(identifier).run();
            }
            if (identifier) {
              await this.env.DB.prepare("UPDATE user_reputation SET is_quarantined = 0, quarantined_until = NULL, report_count = 0 WHERE identifier = ?")
                .bind(identifier)
                .run();
            }
          }
          return new Response(JSON.stringify({ success: true, message: "Ban removed successfully." }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 12. Action: Delete / Remove Quarantine Record
      if (url.pathname === "/api/admin/delete-quarantine" && request.method === "POST") {
        try {
          const body = await request.json();
          const { id, identifier } = body || {};
          if (this.env.DB) {
            if (id) {
              await this.env.DB.prepare("DELETE FROM user_reputation WHERE id = ?").bind(id).run();
            } else if (identifier) {
              await this.env.DB.prepare("DELETE FROM user_reputation WHERE identifier = ?").bind(identifier).run();
            }
          }
          return new Response(JSON.stringify({ success: true, message: "Quarantine record deleted." }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 13. Action: Purge Reports by Status or All
      if (url.pathname === "/api/admin/purge-reports" && request.method === "POST") {
        try {
          const body = await request.json();
          const filter = body?.filter || "dismissed"; // 'all' | 'dismissed' | 'resolved'
          let deletedCount = 0;
          if (this.env.DB) {
            let query = "DELETE FROM reports WHERE status = 'dismissed'";
            if (filter === "all") {
              query = "DELETE FROM reports";
            } else if (filter === "resolved") {
              query = "DELETE FROM reports WHERE status = 'resolved'";
            }
            const res = await this.env.DB.prepare(query).run();
            deletedCount = res.meta?.changes || 0;
          }
          return new Response(JSON.stringify({ success: true, message: `Purged ${deletedCount} reports.` }), {
            headers: corsHeaders,
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 8. Action: Manual 90-Day / 30-Day Cleanup Trigger
      if (url.pathname === "/api/admin/cleanup" && request.method === "POST") {
        try {
          const body = await request.json();
          const days = body?.days || 90;
          let deletedReports = 0;
          let deletedReputations = 0;
          let deletedTraffic = 0;

          if (this.env.DB) {
            const delRep = await this.env.DB.prepare(
              `DELETE FROM reports WHERE created_at < datetime('now', '-${days} days')`
            ).run();
            deletedReports = delRep.meta?.changes || 0;

            const delUser = await this.env.DB.prepare(
              `DELETE FROM user_reputation 
               WHERE last_reported_at < datetime('now', '-${days} days')
                 AND (quarantined_until IS NULL OR quarantined_until < datetime('now'))`
            ).run();
            deletedReputations = delUser.meta?.changes || 0;

            // Also purge historical daily traffic analytics older than N days (90 Days / 30 Days)
            const delTraffic = await this.env.DB.prepare(
              `DELETE FROM daily_traffic_stats WHERE date < date('now', '-${days} days')`
            ).run();
            deletedTraffic = delTraffic.meta?.changes || 0;
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: `Cleaned up ${deletedReports} reports, ${deletedReputations} inactive reputation records, and ${deletedTraffic} traffic stats older than ${days} days.`,
            }),
            { headers: corsHeaders }
          );
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }
    }

    // 3. HTTP Health check & status endpoint
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
        { headers: corsHeaders }
      );
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }

  async handleWebSocket(ws, clientIp, geo = {}) {
    ws.accept();
    const socketId = "sock_" + crypto.randomUUID();
    this.sockets.set(socketId, ws);
    this.socketGeo.set(socketId, {
      country: geo.country || "LK",
      city: geo.city || "Colombo",
      region: geo.region || "",
      continent: geo.continent || "AS",
      connectedAt: Date.now(),
    });

    this.recordVisitor(geo.country || "LK");

    console.log(`[+] User connected: ${socketId} (IP: ${clientIp}, Country: ${geo.country || "LK"})`);
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
        } else if (event === "report-self") {
          await this.handleReportSelf(socketId, ws, clientIp, data);
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
      this.socketGeo.delete(socketId);
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
      const durationSecs = pair.matchedAt ? Math.round((Date.now() - pair.matchedAt) / 1000) : 0;
      if (durationSecs > 0) {
        this.recordCallDuration(pair.country, durationSecs);
      }
      this.activePairs.delete(socketId);

      if (pair.partnerSocketId && this.activePairs.has(pair.partnerSocketId)) {
        const partnerPair = this.activePairs.get(pair.partnerSocketId);
        const partnerDuration = partnerPair.matchedAt ? Math.round((Date.now() - partnerPair.matchedAt) / 1000) : 0;
        if (partnerDuration > 0) {
          this.recordCallDuration(partnerPair.country, partnerDuration);
        }
        this.activePairs.delete(pair.partnerSocketId);
        this.emit(pair.partnerSocketId, "partner-disconnected", {});
      }
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
      const now = Date.now();
      const userGeo = this.socketGeo.get(socketId) || {};
      const matchGeo = this.socketGeo.get(match.socketId) || {};

      this.activePairs.set(socketId, {
        partnerSocketId: match.socketId,
        partnerPeerId: match.peerId,
        mode: chatMode,
        isQuarantined,
        matchedAt: now,
        country: userGeo.country || "LK",
      });
      this.activePairs.set(match.socketId, {
        partnerSocketId: socketId,
        partnerPeerId: peerId,
        mode: chatMode,
        isQuarantined,
        matchedAt: now,
        country: matchGeo.country || "LK",
      });

      this.emit(socketId, "match-found", {
        partnerPeerId: match.peerId,
        partnerGender: match.gender,
        partnerCountry: matchGeo.country || "LK",
        initiator: true,
        mode: chatMode,
      });

      this.emit(match.socketId, "match-found", {
        partnerPeerId: peerId,
        partnerGender: currentUser.gender,
        partnerCountry: userGeo.country || "LK",
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

  async handleReportSelf(socketId, ws, clientIp, { reason, details }) {
    const userSession = this.userSessions.get(socketId);
    const fingerprint = userSession?.fingerprint || {};
    const primaryIdentifier = fingerprint.deviceId || clientIp;

    if (this.env.DB) {
      try {
        const reportId = "rep_self_" + crypto.randomUUID();
        await this.env.DB.prepare(
          `INSERT INTO reports (id, reporter_socket_id, reported_socket_id, reported_peer_id, reported_device_id, reported_user_agent, reported_platform, reported_screen, reported_timezone, reported_language, reported_gpu, reported_metadata, reason, details, mode, ip_address, status, created_at)
           VALUES (?, 'system_ai_self', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', datetime('now'))`
        )
          .bind(
            reportId,
            socketId,
            userSession?.peerId || "unknown",
            fingerprint.deviceId || "unknown",
            fingerprint.userAgent || "unknown",
            fingerprint.platform || "unknown",
            fingerprint.screenResolution || "unknown",
            fingerprint.timezone || "unknown",
            fingerprint.language || "unknown",
            fingerprint.gpuRenderer || "unknown",
            JSON.stringify(fingerprint),
            reason || "harassment",
            details || "Violent threat or severe policy violation attempted",
            userSession?.mode || "text",
            clientIp
          )
          .run();

        await this.env.DB.prepare(
          `INSERT INTO user_reputation (id, identifier, identifier_type, report_count, is_quarantined, quarantined_until, last_reported_at, created_at)
           VALUES (?, ?, ?, 1, 1, datetime('now', '+60 minutes'), datetime('now'), datetime('now'))
           ON CONFLICT(identifier) DO UPDATE SET
             report_count = report_count + 1,
             is_quarantined = 1,
             quarantined_until = datetime('now', '+60 minutes'),
             last_reported_at = datetime('now')`
        )
          .bind("rep_u_" + crypto.randomUUID(), primaryIdentifier, fingerprint.deviceId ? "device_id" : "ip")
          .run();
      } catch (err) {
        console.error("D1 self-report save error:", err);
      }
    }

    this.cleanupActivePair(socketId);
    this.removeFromAllQueues(socketId);
    this.emit(socketId, "error-msg", "You have been quarantined for violating community safety guidelines.");
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
