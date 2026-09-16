const API_URL = "https://api.fades.lol";

const WORKER_URL = process.env.FADES_WORKER_URL;
const WORKER_KEY = process.env.FADES_WORKER_KEY;

const MAX_MESSAGE_LENGTH = 20000;

const FREE_CONTEXT_MESSAGES = 30;
const PRO_CONTEXT_MESSAGES = 100;

export async function POST(request) {
  try {
    console.log("[FADES] /api/chat request received");

    /*
    =========================================================
    WORKER CONFIGURATION
    =========================================================
    */

    console.log(
      "[FADES] Worker URL:",
      WORKER_URL || "(missing)"
    );

    console.log(
      "[FADES] Worker key:",
      WORKER_KEY ? "configured" : "missing"
    );

    if (!WORKER_URL) {
      return Response.json(
        {
          error: "FADES_WORKER_URL is not configured.",
        },
        { status: 500 }
      );
    }

    if (!WORKER_KEY) {
      return Response.json(
        {
          error: "FADES_WORKER_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    /*
    =========================================================
    GET THE CURRENT USER FROM THE REGULAR FADES API
    =========================================================
    */

    const cookie =
      request.headers.get("cookie") || "";

    let user = null;

    try {
      const userResponse = await fetch(
        `${API_URL}/auth/me`,
        {
          method: "GET",

          headers: {
            ...(cookie
              ? {
                  Cookie: cookie,
                }
              : {}),
          },

          cache: "no-store",
        }
      );

      if (userResponse.ok) {
        const userData =
          await userResponse.json();

        user =
          userData?.user ||
          userData ||
          null;
      }
    } catch (error) {
      console.error(
        "[FADES] Failed to retrieve user:",
        error
      );

      /*
       * If the user lookup fails, treat them
       * as a guest instead of breaking chat.
       */
      user = null;
    }

    /*
    =========================================================
    DETERMINE PLAN
    =========================================================
    */

    const isPro =
      user?.plan === "pro";

    const contextLimit =
      isPro
        ? PRO_CONTEXT_MESSAGES
        : FREE_CONTEXT_MESSAGES;

    console.log(
      "[FADES] User:",
      user
        ? user.displayName ||
          user.username ||
          user.id
        : "guest"
    );

    console.log(
      "[FADES] Plan:",
      isPro ? "pro" : "free"
    );

    console.log(
      "[FADES] Context limit:",
      contextLimit
    );

    /*
    =========================================================
    READ REQUEST
    =========================================================
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
          error: "Message is required.",
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
          error: "Message is too long.",
        },
        { status: 400 }
      );
    }

    /*
    =========================================================
    CLEAN HISTORY
    =========================================================
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
    =========================================================
    APPLY PRO / FREE CONTEXT
    =========================================================
    */

    const recentHistory =
      cleanHistory.length >
      contextLimit
        ? cleanHistory.slice(
            -contextLimit
          )
        : cleanHistory;

    console.log(
      "[FADES] History received:",
      cleanHistory.length
    );

    console.log(
      "[FADES] History sent to AI:",
      recentHistory.length
    );

    /*
    =========================================================
    SEND TO FADES AI WORKER
    =========================================================
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
    =========================================================
    WORKER ERROR
    =========================================================
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
    =========================================================
    STREAMING RESPONSE
    =========================================================
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

      const headers =
        new Headers();

      headers.set(
        "Content-Type",
        "text/event-stream; charset=utf-8"
      );

      headers.set(
        "Cache-Control",
        "no-cache, no-store, no-transform"
      );

      headers.set(
        "Connection",
        "keep-alive"
      );

      headers.set(
        "X-Accel-Buffering",
        "no"
      );

      headers.set(
        "X-Fades-Plan",
        isPro
          ? "pro"
          : "free"
      );

      headers.set(
        "X-Fades-Context-Limit",
        String(contextLimit)
      );

      return new Response(
        workerResponse.body,
        {
          status: 200,
          headers,
        }
      );
    }

    /*
    =========================================================
    NORMAL RESPONSE
    =========================================================
    */

    const data =
      await workerResponse.json();

    return Response.json(
      {
        reply:
          data?.reply ||
          data?.message ||
          "I wasn't able to generate a response.",

        plan:
          isPro
            ? "pro"
            : "free",

        contextLimit,
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
