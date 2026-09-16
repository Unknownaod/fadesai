import { db } from "../../../lib/database.js";
import { getUserFromSession } from "../../../lib/auth.js";

const WORKER_URL = process.env.FADES_WORKER_URL;
const WORKER_KEY = process.env.FADES_WORKER_KEY;

const COOKIE_NAME = "fades_session";

const MAX_MESSAGE_LENGTH = 20000;

/*
=========================================================
FADES AI LIMITS
=========================================================

FREE
- 50 AI generations per day
- 30 messages of AI context

PRO
- 500 AI generations per day
- 100 messages of AI context

These limits are enforced server-side.
=========================================================
*/

const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 500;

const FREE_CONTEXT_MESSAGES = 30;
const PRO_CONTEXT_MESSAGES = 100;

/*
=========================================================
AUTHENTICATION
=========================================================
*/

async function getAuthenticatedUser(request) {
  const cookieHeader =
    request.headers.get("cookie") || "";

  const cookies = {};

  cookieHeader
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");

      if (index === -1) {
        return;
      }

      const name =
        part.slice(0, index).trim();

      const value =
        part.slice(index + 1).trim();

      if (name) {
        cookies[name] = decodeURIComponent(value);
      }
    });

  const token =
    cookies[COOKIE_NAME] || null;

  if (!token) {
    return null;
  }

  return getUserFromSession(token);
}

/*
=========================================================
DATE HELPERS
=========================================================
*/

function getTodayKey() {
  const now = new Date();

  return now.toISOString().slice(0, 10);
}

/*
=========================================================
AI USAGE
=========================================================

Usage is stored on the user record:

aiUsage: {
  date: "2026-09-15",
  count: 12
}

Only successful AI generations are counted.
=========================================================
*/

async function getAIUsage(user) {
  const today = getTodayKey();

  if (
    !user?.aiUsage ||
    user.aiUsage.date !== today
  ) {
    return {
      date: today,
      count: 0,
    };
  }

  return {
    date: today,
    count:
      Number(user.aiUsage.count) || 0,
  };
}

/*
=========================================================
MAIN CHAT ENDPOINT
=========================================================
*/

export async function POST(request) {
  try {
    console.log(
      "[FADES] /api/chat request received"
    );

    /*
    =======================================================
    WORKER CONFIGURATION
    =======================================================
    */

    console.log(
      "[FADES] Worker URL:",
      WORKER_URL || "(missing)"
    );

    console.log(
      "[FADES] Worker key:",
      WORKER_KEY
        ? "configured"
        : "missing"
    );

    if (!WORKER_URL) {
      return Response.json(
        {
          error:
            "FADES_WORKER_URL is not configured.",
        },
        { status: 500 }
      );
    }

    if (!WORKER_KEY) {
      return Response.json(
        {
          error:
            "FADES_WORKER_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    /*
    =======================================================
    AUTHENTICATION
    =======================================================
    */

    const user =
      await getAuthenticatedUser(request);

    const isLoggedIn = Boolean(user);

    const isPro =
      user?.plan === "pro";

    /*
    Guests use the Free limits.
    */

    const dailyLimit = isPro
      ? PRO_DAILY_LIMIT
      : FREE_DAILY_LIMIT;

    const contextLimit = isPro
      ? PRO_CONTEXT_MESSAGES
      : FREE_CONTEXT_MESSAGES;

    console.log(
      "[FADES] Account:",
      isLoggedIn
        ? user.username ||
          user.displayName ||
          user.id
        : "guest"
    );

    console.log(
      "[FADES] Plan:",
      isPro
        ? "pro"
        : "free"
    );

    console.log(
      "[FADES] Daily limit:",
      dailyLimit
    );

    console.log(
      "[FADES] Context limit:",
      contextLimit
    );

    /*
    =======================================================
    CHECK DAILY AI USAGE
    =======================================================
    */

    let usage = null;

    if (user) {
      usage =
        await getAIUsage(user);

      if (usage.count >= dailyLimit) {
        return Response.json(
          {
            error:
              isPro
                ? "You've reached your Fades Pro AI limit for today."
                : "You've reached your daily AI limit. Upgrade to Fades Pro for a higher limit.",
            code:
              "AI_DAILY_LIMIT_REACHED",
            limit: dailyLimit,
            used: usage.count,
            remaining: 0,
            plan:
              isPro
                ? "pro"
                : "free",
          },
          { status: 429 }
        );
      }
    }

    /*
    =======================================================
    READ REQUEST
    =======================================================
    */

    const body =
      await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    const history =
      Array.isArray(body?.history)
        ? body.history
        : [];

    if (!message) {
      return Response.json(
        {
          error:
            "Message is required.",
        },
        { status: 400 }
      );
    }

    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {
      return Response.json(
        {
          error:
            "Message is too long.",
        },
        { status: 400 }
      );
    }

    /*
    =======================================================
    CLEAN HISTORY
    =======================================================
    */

    const cleanHistory =
      history
        .filter(
          (item) =>
            item &&
            (
              item.role === "user" ||
              item.role === "assistant"
            ) &&
            typeof item.content ===
              "string"
        )
        .map((item) => ({
          role: item.role,
          content:
            item.content.trim(),
        }))
        .filter(
          (item) =>
            item.content.length > 0
        );

    /*
    =======================================================
    APPLY PLAN-SPECIFIC CONTEXT LIMIT
    =======================================================
    */

    const recentHistory =
      cleanHistory.length >
      contextLimit
        ? cleanHistory.slice(
            -contextLimit
          )
        : cleanHistory;

    console.log(
      "[FADES] History:",
      cleanHistory.length,
      "messages received"
    );

    console.log(
      "[FADES] Context:",
      recentHistory.length,
      "messages sent to worker"
    );

    /*
    =======================================================
    WORKER REQUEST
    =======================================================
    */

    const workerEndpoint =
      `${WORKER_URL.replace(
        /\/+$/,
        ""
      )}/generate`;

    console.log(
      "[FADES] Connecting to worker:",
      workerEndpoint
    );

    let workerResponse;

    try {
      workerResponse =
        await fetch(
          workerEndpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${WORKER_KEY}`,
            },

            body: JSON.stringify({
              message,
              history:
                recentHistory,
            }),

            cache: "no-store",
          }
        );
    } catch (
      workerFetchError
    ) {
      console.error(
        "[FADES] Worker fetch failed:",
        workerFetchError
      );

      return Response.json(
        {
          error:
            "Unable to connect to Fades AI worker.",
          details:
            workerFetchError?.message ||
            String(
              workerFetchError
            ),
        },
        { status: 502 }
      );
    }

    console.log(
      "[FADES] Worker status:",
      workerResponse.status
    );

    console.log(
      "[FADES] Worker content type:",
      workerResponse.headers.get(
        "content-type"
      )
    );

    /*
    =======================================================
    WORKER ERROR
    =======================================================
    */

    if (!workerResponse.ok) {
      let workerError =
        "Fades AI worker failed.";

      try {
        const errorData =
          await workerResponse.json();

        if (
          typeof errorData?.error ===
          "string"
        ) {
          workerError =
            errorData.error;
        }
      } catch {
        try {
          const text =
            await workerResponse.text();

          if (text) {
            workerError =
              text.slice(0, 1000);
          }
        } catch {
          // Ignore unreadable worker response.
        }
      }

      console.error(
        "[FADES] Worker returned error:",
        workerResponse.status,
        workerError
      );

      return Response.json(
        {
          error: workerError,
          workerStatus:
            workerResponse.status,
        },
        { status: 502 }
      );
    }

    /*
    =======================================================
    IMPORTANT:
    Only count usage after the worker
    successfully accepts/generates the request.
    =======================================================
    */

    if (user) {
      const currentUsage =
        usage ||
        await getAIUsage(user);

      const newUsage = {
        date:
          currentUsage.date,
        count:
          currentUsage.count + 1,
      };

      try {
        await db.update(
          "users",
          user.id,
          {
            aiUsage: newUsage,
          }
        );

        console.log(
          "[FADES] AI usage:",
          newUsage.count,
          "/",
          dailyLimit
        );
      } catch (
        usageError
      ) {
        /*
         * Do not break an otherwise successful
         * AI response because usage tracking failed.
         *
         * Log it so it can be fixed.
         */
        console.error(
          "[FADES] Failed to update AI usage:",
          usageError
        );
      }
    }

    /*
    =======================================================
    STREAMING RESPONSE
    =======================================================
    */

    const contentType =
      workerResponse.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "text/event-stream"
      )
    ) {
      console.log(
        "[FADES] Streaming worker response"
      );

      const responseHeaders =
        new Headers();

      responseHeaders.set(
        "Content-Type",
        "text/event-stream; charset=utf-8"
      );

      responseHeaders.set(
        "Cache-Control",
        "no-cache, no-store, no-transform"
      );

      responseHeaders.set(
        "Connection",
        "keep-alive"
      );

      responseHeaders.set(
        "X-Accel-Buffering",
        "no"
      );

      /*
       * Helpful information for the frontend.
       */
      responseHeaders.set(
        "X-Fades-Plan",
        isPro
          ? "pro"
          : "free"
      );

      responseHeaders.set(
        "X-Fades-Daily-Limit",
        String(dailyLimit)
      );

      if (user) {
        responseHeaders.set(
          "X-Fades-Daily-Used",
          String(
            (usage?.count || 0) + 1
          )
        );
      }

      return new Response(
        workerResponse.body,
        {
          status: 200,
          headers:
            responseHeaders,
        }
      );
    }

    /*
    =======================================================
    NORMAL JSON RESPONSE
    =======================================================
    */

    const data =
      await workerResponse.json();

    const used =
      user
        ? (usage?.count || 0) + 1
        : null;

    const remaining =
      user
        ? Math.max(
            0,
            dailyLimit - used
          )
        : null;

    return Response.json(
      {
        reply:
          data?.reply ||
          data?.message ||
          "I wasn't able to generate a response.",

        /*
         * Useful for the frontend later.
         */
        usage: user
          ? {
              used,
              limit: dailyLimit,
              remaining,
            }
          : null,

        plan:
          isPro
            ? "pro"
            : "free",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[FADES] /api/chat fatal error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Fades could not generate a response.",
      },
      { status: 500 }
    );
  }
}
