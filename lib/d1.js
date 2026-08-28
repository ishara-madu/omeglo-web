/**
 * Cloudflare D1 Client for Omeglo
 * Handles saving reports, tracking user reputation scores, managing the
 * Toxic Shadow Quarantine Pool, and automated 90-day data cleanup.
 */

const crypto = require("crypto");

// Configuration from Environment Variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

const isD1Configured = Boolean(
  CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_DATABASE_ID && CLOUDFLARE_API_TOKEN
);

if (!isD1Configured) {
  console.log(
    "⚠️  Cloudflare D1 credentials not found. Using local in-memory Toxic Quarantine moderation store."
  );
} else {
  console.log("✅ Cloudflare D1 connected for Toxic Shadow Quarantine & Reputation Tracking.");
}

// In-memory fallback stores for high-speed lookup and local testing
const localReports = [];
const localBanned = new Map();
const localReputation = new Map();

/**
 * Execute raw SQL query against Cloudflare D1 REST API
 */
async function executeD1Query(sql, params = []) {
  if (!isD1Configured) return null;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await res.json();
    if (!data.success) {
      console.error("[-] Cloudflare D1 Query Error:", data.errors);
      return null;
    }

    return data.result?.[0]?.results || [];
  } catch (err) {
    console.error("[-] Cloudflare D1 Network Error:", err.message);
    return null;
  }
}

/**
 * Calculate escalating quarantine duration (in minutes) based on report frequency & severity
 */
function calculateQuarantineDurationMinutes(reportCount, reason) {
  let baseMinutes = 30; // 1st report: 30 minutes

  if (reportCount === 2) {
    baseMinutes = 120; // 2nd report: 2 hours
  } else if (reportCount === 3) {
    baseMinutes = 720; // 3rd report: 12 hours
  } else if (reportCount === 4) {
    baseMinutes = 1440; // 4th report: 24 hours
  } else if (reportCount >= 5) {
    baseMinutes = 10080; // 5+ reports: 7 days
  }

  if (reason === "nudity" || reason === "underage") {
    baseMinutes *= 2;
  }

  return baseMinutes;
}

/**
 * Check if a user (by Device ID or IP) is in the Toxic Quarantine Pool
 */
async function getUserReputation(ipAddress, deviceId, canvasHash) {
  const now = Date.now();

  // 1. Check in-memory store for instant zero-latency match routing
  const identifiers = [deviceId, ipAddress, canvasHash].filter(Boolean);
  for (const id of identifiers) {
    if (localReputation.has(id)) {
      const rep = localReputation.get(id);
      if (rep.quarantinedUntil > now) {
        return {
          isQuarantined: true,
          reportCount: rep.reportCount,
          quarantinedUntil: new Date(rep.quarantinedUntil),
        };
      }
    }
  }

  // 2. Check Cloudflare D1 database
  if (isD1Configured && identifiers.length > 0) {
    const placeholders = identifiers.map(() => "?").join(",");
    const sql = `
      SELECT report_count, is_quarantined, quarantined_until 
      FROM user_reputation 
      WHERE identifier IN (${placeholders})
      AND is_quarantined = 1
      AND quarantined_until > datetime('now')
      ORDER BY report_count DESC
      LIMIT 1
    `;

    const results = await executeD1Query(sql, identifiers);
    if (results && results.length > 0) {
      const row = results[0];
      const qUntil = new Date(row.quarantined_until).getTime();

      for (const id of identifiers) {
        localReputation.set(id, {
          reportCount: row.report_count,
          isQuarantined: true,
          quarantinedUntil: qUntil,
        });
      }

      return {
        isQuarantined: true,
        reportCount: row.report_count,
        quarantinedUntil: new Date(row.quarantined_until),
      };
    }
  }

  return { isQuarantined: false, reportCount: 0, quarantinedUntil: null };
}

/**
 * Save report and escalate user to Toxic Quarantine Pool
 */
async function recordReportAndQuarantine({
  reporterSocketId,
  reportedSocketId,
  reportedPeerId,
  reason,
  details = "",
  mode = "video",
  ipAddress = "unknown",
  fingerprint = {},
}) {
  const reportId = "rep_" + crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const deviceId = fingerprint.deviceId || "unknown";
  const userAgent = fingerprint.userAgent || "unknown";
  const platform = fingerprint.platform || "unknown";
  const screen = fingerprint.screenResolution || "unknown";
  const timezone = fingerprint.timezone || "unknown";
  const language = fingerprint.language || "unknown";
  const gpu = fingerprint.gpuRenderer ? `${fingerprint.gpuRenderer} (${fingerprint.gpuVendor || ""})` : "unknown";
  const metadataJson = JSON.stringify(fingerprint || {});

  const reportItem = {
    id: reportId,
    reporter_socket_id: reporterSocketId,
    reported_socket_id: reportedSocketId,
    reported_peer_id: reportedPeerId,
    reported_device_id: deviceId,
    reported_user_agent: userAgent,
    reported_platform: platform,
    reported_screen: screen,
    reported_timezone: timezone,
    reported_language: language,
    reported_gpu: gpu,
    reported_metadata: metadataJson,
    reason,
    details,
    mode,
    ip_address: ipAddress,
    status: "quarantined",
    created_at: timestamp,
  };

  localReports.unshift(reportItem);
  if (localReports.length > 500) localReports.pop();

  const primaryIdentifier = deviceId !== "unknown" && deviceId ? deviceId : ipAddress;
  const identifierType = deviceId !== "unknown" && deviceId ? "device_id" : "ip";

  const currentRep = localReputation.get(primaryIdentifier) || { reportCount: 0 };
  const newReportCount = currentRep.reportCount + 1;
  const durationMinutes = calculateQuarantineDurationMinutes(newReportCount, reason);
  const quarantinedUntilMs = Date.now() + durationMinutes * 60 * 1000;
  const quarantinedUntilDate = new Date(quarantinedUntilMs).toISOString();

  localReputation.set(primaryIdentifier, {
    reportCount: newReportCount,
    isQuarantined: true,
    quarantinedUntil: quarantinedUntilMs,
  });
  if (ipAddress && ipAddress !== "unknown") {
    localReputation.set(ipAddress, {
      reportCount: newReportCount,
      isQuarantined: true,
      quarantinedUntil: quarantinedUntilMs,
    });
  }

  if (isD1Configured) {
    const reportSql = `
      INSERT INTO reports (
        id, reporter_socket_id, reported_socket_id, reported_peer_id,
        reported_device_id, reported_user_agent, reported_platform,
        reported_screen, reported_timezone, reported_language, reported_gpu,
        reported_metadata, reason, details, mode, ip_address, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', datetime('now'))
    `;
    const reportParams = [
      reportId,
      reporterSocketId || "unknown",
      reportedSocketId || "unknown",
      reportedPeerId || "unknown",
      deviceId,
      userAgent,
      platform,
      screen,
      timezone,
      language,
      gpu,
      metadataJson,
      reason || "other",
      details || "",
      mode || "video",
      ipAddress || "unknown",
    ];

    executeD1Query(reportSql, reportParams).catch((err) =>
      console.error("[-] Failed to insert report to D1:", err)
    );

    const repSql = `
      INSERT INTO user_reputation (
        id, identifier, identifier_type, report_count, is_quarantined, quarantined_until, last_reported_at, created_at
      ) VALUES (?, ?, ?, 1, 1, datetime('now', '+${durationMinutes} minutes'), datetime('now'), datetime('now'))
      ON CONFLICT(identifier) DO UPDATE SET
        report_count = report_count + 1,
        is_quarantined = 1,
        quarantined_until = datetime('now', '+${durationMinutes} minutes'),
        last_reported_at = datetime('now')
    `;
    const repId = "rep_user_" + crypto.randomUUID();
    executeD1Query(repSql, [repId, primaryIdentifier, identifierType]).catch((err) =>
      console.error("[-] Failed to update user reputation in D1:", err)
    );
  }

  console.log(
    `[☣️ QUARANTINE ACTIVATED] Identifier: ${primaryIdentifier} | Reports: ${newReportCount} | Quarantined for: ${durationMinutes} mins`
  );

  return {
    reportId,
    reportCount: newReportCount,
    durationMinutes,
    quarantinedUntil: quarantinedUntilDate,
  };
}

/**
 * Automated Cleanup: Purge reports and inactive guest reputation data older than 90 days
 */
async function cleanupOldGuestData(retentionDays = 90) {
  console.log(`[🧹 CLEANUP TASK] Checking for guest data older than ${retentionDays} days...`);
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // Clean local in-memory stores
  for (const [id, rep] of localReputation.entries()) {
    if (rep.quarantinedUntil < cutoffTime) {
      localReputation.delete(id);
    }
  }

  // Clean Cloudflare D1
  if (isD1Configured) {
    const deleteReportsSql = `DELETE FROM reports WHERE created_at < datetime('now', '-${Number(retentionDays)} days')`;
    const deleteReputationSql = `
      DELETE FROM user_reputation 
      WHERE last_reported_at < datetime('now', '-${Number(retentionDays)} days')
      AND (quarantined_until IS NULL OR quarantined_until < datetime('now'))
    `;

    try {
      await executeD1Query(deleteReportsSql);
      await executeD1Query(deleteReputationSql);
      console.log(`[🧹 CLEANUP COMPLETED] Purged inactive guest records older than ${retentionDays} days.`);
    } catch (err) {
      console.error("[-] Cleanup Error:", err.message);
    }
  }
}

/**
 * Get recent reports for Admin Dashboard or Mobile Moderation App
 */
async function getReports({ limit = 50, offset = 0, status } = {}) {
  if (isD1Configured) {
    let sql = "SELECT * FROM reports";
    const params = [];

    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const results = await executeD1Query(sql, params);
    if (results !== null) return results;
  }

  let filtered = localReports;
  if (status) {
    filtered = filtered.filter((r) => r.status === status);
  }
  return filtered.slice(offset, offset + limit);
}

/**
 * Check if a user is completely hard-banned
 */
async function isUserBanned(ipAddress, deviceId, canvasHash) {
  if (ipAddress && localBanned.has(ipAddress)) return true;
  if (deviceId && localBanned.has(deviceId)) return true;
  if (canvasHash && localBanned.has(canvasHash)) return true;

  if (isD1Configured) {
    const sql = `
      SELECT id FROM banned_users 
      WHERE (identifier = ? OR identifier = ? OR identifier = ?) 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      LIMIT 1
    `;
    const results = await executeD1Query(sql, [
      ipAddress || "",
      deviceId || "",
      canvasHash || "",
    ]);
    if (results && results.length > 0) return true;
  }

  return false;
}

/**
 * Ban a user manually or permanently
 */
async function banUser({
  identifier,
  identifierType = "ip",
  reason = "Community guidelines violation",
  durationHours = null,
}) {
  const banId = "ban_" + crypto.randomUUID();
  localBanned.set(identifier, { reason, banned_at: new Date().toISOString() });

  if (isD1Configured) {
    let expiresAtSql = durationHours
      ? `datetime('now', '+${Number(durationHours)} hours')`
      : "NULL";
    const sql = `
      INSERT OR REPLACE INTO banned_users (id, identifier, identifier_type, reason, banned_at, expires_at)
      VALUES (?, ?, ?, ?, datetime('now'), ${expiresAtSql})
    `;
    await executeD1Query(sql, [banId, identifier, identifierType, reason]);
  }

  console.log(`[🚫 USER HARD-BANNED] Identifier: ${identifier} (${identifierType}) | Reason: ${reason}`);
  return { success: true, banId };
}

module.exports = {
  recordReportAndQuarantine,
  getUserReputation,
  cleanupOldGuestData,
  getReports,
  isUserBanned,
  banUser,
  isD1Configured,
};
