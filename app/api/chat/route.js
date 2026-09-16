const API_URL = "https://api.fades.lol";

const WORKER_URL = process.env.FADES_WORKER_URL;
const WORKER_KEY = process.env.FADES_WORKER_KEY;

const MAX_MESSAGE_LENGTH = 20000;

const FREE_CONTEXT_MESSAGES = 30;
const PRO_CONTEXT_MESSAGES = 100;

/*
=========================================================
POST /api/chat
=========================================================

Flow:

1. Get current user from the regular Fades API.
2. Check daily AI usage.
3. Determine Free / Pro context.
4. Send request to Fades AI worker.
5. If generation succeeds, record the generation.
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
    GET USER
    =======================================================
    */

    const cookie =
      request.headers.get("cookie") || "";

    let user = null;

    try {
      const userResponse =
        await fetch(
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

      user = null;
    }

    /*
    =======================================================
    PLAN
    =======================================================
    */

    const isPro =
      user?.plan === "pro";

    const plan =
      isPro
        ? "pro"
        : "free";

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
      plan
    );

    console.log(
      "[FADES] Context limit:",
      contextLimit
    );

    /*
    =======================================================
    CHECK AI USAGE
    =======================================================
    */

    let usage = null;

    /*
     * Only authenticated users have server-side
     * daily usage tracking.
     *
     * Guests are still allowed to use chat.
     */

    if (user && cookie) {
      try {
        const usageResponse =
          await fetch(
            `${API_URL}/ai/usage`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Cookie: cookie,
              },

              body: JSON.stringify({
                action: "check",
              }),

              cache: "no-store",
            }
          );

        const usageData =
          await usageResponse.json();

        if (!usageResponse.ok) {
          console.error(
            "[FADES] Usage check failed:",
            usageData
          );

          /*
           * Do not silently bypass the usage
           * system if the backend is unavailable.
           */
          return Response.json(
            {
              error:
                usageData?.error ||
                "Unable to verify AI usage.",
            },
            {
              status:
                usageResponse.status >= 400
                  ? usageResponse.status
                  : 502,
            }
          );
        }

        usage = usageData;

        console.log(
          "[FADES] AI usage:",
          `${usage.used}/${usage.limit}`
        );

        if (
          usage.allowed !== true
        ) {
          return Response.json(
            {
              error:
                "Daily AI generation limit reached.",

              code:
                "DAILY_LIMIT_REACHED",

              plan:
                usage.plan || plan,

              used:
                usage.used ?? 0,

              limit:
                usage.limit ??
                (isPro ? 500 : 50),

              remaining:
                usage.remaining ?? 0,
            },
            { status: 429 }
          );
        }
      } catch (error) {
        console.error(
          "[FADES] Usage check request failed:",
          error
        );

        return Response.json(
          {
            error:
              "Unable to verify AI usage.",
          },
          { status: 502 }
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
    APPLY CONTEXT LIMIT
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
      "[FADES] History received:",
      cleanHistory.length
    );

    console.log(
      "[FADES] History sent to AI:",
      recentHistory.length
    );

    /*
    =======================================================
    SEND TO FADES AI WORKER
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
              text.slice(
                0,
                1000
              );
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

      /*
       * We need to watch the stream so that the
       * generation is recorded only after the
       * worker successfully finishes.
       */

      const workerBody =
        workerResponse.body;

      if (!workerBody) {
        return Response.json(
          {
            error:
              "Worker returned an empty response.",
          },
          { status: 502 }
        );
      }

      const reader =
        workerBody.getReader();

      const encoder =
        new TextEncoder();

      let generationCompleted =
        false;

      const stream =
        new ReadableStream({
          async start(
            controller
          ) {
            try {
              while (true) {
                const {
                  done,
                  value,
                } =
                  await reader.read();

                if (done) {
                  break;
                }

                controller.enqueue(
                  value
                );
              }

              generationCompleted =
                true;

              controller.close();
            } catch (error) {
              console.error(
                "[FADES] Stream proxy error:",
                error
              );

              try {
                controller.error(
                  error
                );
              } catch {
                // Ignore stream controller errors.
              }
            } finally {
              /*
               * Only count the generation if
               * the worker stream completed.
               */

              if (
                generationCompleted &&
                user &&
                cookie
              ) {
                try {
                  const completeResponse =
                    await fetch(
                      `${API_URL}/ai/usage`,
                      {
                        method: "POST",

                        headers: {
                          "Content-Type":
                            "application/json",

                          Cookie: cookie,
                        },

                        body: JSON.stringify({
                          action:
                            "complete",
                        }),

                        cache: "no-store",
                      }
                    );

                  const completeData =
                    await completeResponse.json();

                  if (
                    completeResponse.ok
                  ) {
                    console.log(
                      "[FADES] AI usage completed:",
                      `${completeData.used}/${completeData.limit}`
                    );
                  } else {
                    console.error(
                      "[FADES] Failed to record AI usage:",
                      completeData
                    );
                  }
                } catch (error) {
                  console.error(
                    "[FADES] Usage completion failed:",
                    error
                  );
                }
              }
            }
          },

          cancel() {
            try {
              reader.cancel();
            } catch {
              // Ignore cancellation errors.
            }
          },
        });

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
        plan
      );

      headers.set(
        "X-Fades-Context-Limit",
        String(contextLimit)
      );

      if (usage) {
        headers.set(
          "X-Fades-Daily-Limit",
          String(
            usage.limit
          )
        );

        headers.set(
          "X-Fades-Daily-Used",
          String(
            usage.used
          )
        );

        headers.set(
          "X-Fades-Daily-Remaining",
          String(
            usage.remaining
          )
        );
      }

      return new Response(
        stream,
        {
          status: 200,
          headers,
        }
      );
    }

    /*
    =======================================================
    NORMAL RESPONSE
    =======================================================
    */

    const data =
      await workerResponse.json();

    /*
     * The worker returned successfully,
     * so record the generation.
     */

    let completedUsage =
      usage;

    if (
      user &&
      cookie
    ) {
      try {
        const completeResponse =
          await fetch(
            `${API_URL}/ai/usage`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Cookie: cookie,
              },

              body: JSON.stringify({
                action:
                  "complete",
              }),

              cache: "no-store",
            }
          );

        if (
          completeResponse.ok
        ) {
          completedUsage =
            await completeResponse.json();
        }
      } catch (error) {
        console.error(
          "[FADES] Usage completion failed:",
          error
        );
      }
    }

    return Response.json(
      {
        reply:
          data?.reply ||
          data?.message ||
          "I wasn't able to generate a response.",

        plan,

        contextLimit,

        usage:
          completedUsage
            ? {
                used:
                  completedUsage.used,
                limit:
                  completedUsage.limit,
                remaining:
                  completedUsage.remaining,
              }
            : null,
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

