const WORKER_URL =
  process.env.FADES_WORKER_URL ||
  "http://127.0.0.1:3001";

const WORKER_KEY =
  process.env.FADES_WORKER_KEY;

// =========================================================
// CONFIGURATION
// =========================================================

const MAX_MESSAGE_LENGTH = 20000;
const MAX_HISTORY_MESSAGES = 30;

// =========================================================
// POST /api/chat
// =========================================================

export async function POST(request) {
  try {
    // -------------------------------------------------------
    // Verify worker configuration
    // -------------------------------------------------------

    if (!WORKER_URL) {
      console.error(
        "FADES_WORKER_URL is not configured."
      );

      return Response.json(
        {
          error:
            "Fades AI worker is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    if (!WORKER_KEY) {
      console.error(
        "FADES_WORKER_KEY is not configured."
      );

      return Response.json(
        {
          error:
            "Fades AI worker authentication is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    // -------------------------------------------------------
    // Read request
    // -------------------------------------------------------

    const body = await request.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    const history = Array.isArray(
      body?.history
    )
      ? body.history
      : [];

    // -------------------------------------------------------
    // Validate message
    // -------------------------------------------------------

    if (!message) {
      return Response.json(
        {
          error: "Message is required.",
        },
        {
          status: 400,
        }
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
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------
    // Clean conversation history
    // -------------------------------------------------------

    const cleanHistory = history
      .filter(
        (item) =>
          item &&
          (item.role === "user" ||
            item.role === "assistant") &&
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

    // -------------------------------------------------------
    // Limit history
    // -------------------------------------------------------

    const recentHistory =
      cleanHistory.length >
      MAX_HISTORY_MESSAGES
        ? cleanHistory.slice(
            -MAX_HISTORY_MESSAGES
          )
        : cleanHistory;

    // -------------------------------------------------------
    // Send request to Fades AI worker
    // -------------------------------------------------------
    //
    // Vercel
    //   ↓
    // Worker
    //   ↓
    // Ollama
    //   ↓
    // Qwen3 4B
    //
    // The worker key NEVER reaches the browser.
    // -------------------------------------------------------

    const workerResponse =
      await fetch(
        `${WORKER_URL}/generate`,
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

          // Do not let Next/Vercel cache
          // an AI generation request.
          cache: "no-store",
        }
      );

    // -------------------------------------------------------
    // Worker error
    // -------------------------------------------------------

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
        // Worker did not return JSON.
      }

      console.error(
        `Fades worker returned ${workerResponse.status}:`,
        workerError
      );

      return Response.json(
        {
          error: workerError,
        },
        {
          status:
            workerResponse.status === 401
              ? 502
              : 502,
        }
      );
    }

    // -------------------------------------------------------
    // Streaming response
    // -------------------------------------------------------
    //
    // The worker already converts Ollama's stream
    // into Server-Sent Events.
    //
    // We simply pass that stream through to the
    // browser.
    // -------------------------------------------------------

    const contentType =
      workerResponse.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "text/event-stream"
      )
    ) {
      return new Response(
        workerResponse.body,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/event-stream; charset=utf-8",

            "Cache-Control":
              "no-cache, no-store, no-transform",

            Connection:
              "keep-alive",

            "X-Accel-Buffering":
              "no",
          },
        }
      );
    }

    // -------------------------------------------------------
    // Non-stream fallback
    // -------------------------------------------------------

    const data =
      await workerResponse.json();

    return Response.json(
      {
        reply:
          data?.reply ||
          data?.message ||
          "I wasn't able to generate a response.",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Fades AI error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Fades could not generate a response.",
      },
      {
        status: 500,
      }
    );
  }
}
