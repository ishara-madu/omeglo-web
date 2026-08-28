/**
 * Omeglo - Cloudflare Scheduled Cron Worker
 * Automatically cleans up 90-day-old inactive guest reports and reputation data directly on D1.
 * Runs independently on Cloudflare Edge with 0% load on the Node.js signaling server.
 */

export default {
  /**
   * 1. Scheduled Cron Trigger Handler (Runs every day at 00:00 UTC)
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(executeCleanup(env.DB));
  },

  /**
   * 2. HTTP Endpoint Handler (Allows manual testing / admin trigger)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/cleanup" || url.pathname === "/" || url.pathname === "/health") {
      const result = await executeCleanup(env.DB);
      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

/**
 * Perform 90-Day Purge on D1 Database
 */
async function executeCleanup(db) {
  const retentionDays = 90;
  console.log(`[🧹 CLOUDFLARE CRON] Starting 90-day purge of guest reports & inactive reputation...`);

  try {
    // 1. Delete reports older than 90 days
    const deleteReportsResult = await db
      .prepare("DELETE FROM reports WHERE created_at < datetime('now', '-90 days')")
      .run();

    // 2. Delete inactive guest reputations older than 90 days whose quarantine has expired
    const deleteReputationResult = await db
      .prepare(
        "DELETE FROM user_reputation WHERE last_reported_at < datetime('now', '-90 days') AND (quarantined_until IS NULL OR quarantined_until < datetime('now'))"
      )
      .run();

    const summary = {
      status: "success",
      timestamp: new Date().toISOString(),
      retentionDays,
      purgedReportsCount: deleteReportsResult.meta?.changes || 0,
      purgedReputationCount: deleteReputationResult.meta?.changes || 0,
    };

    console.log(`[✅ CLOUDFLARE CRON COMPLETED]`, summary);
    return summary;
  } catch (error) {
    console.error(`[❌ CLOUDFLARE CRON ERROR]:`, error);
    return {
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}
