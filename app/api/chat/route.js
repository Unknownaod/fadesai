const WORKER_URL = process.env.FADES_WORKER_URL;
const WORKER_KEY = process.env.FADES_WORKER_KEY;

const MAX_MESSAGE_LENGTH = 20000;
const MAX_HISTORY_MESSAGES = 30;

export async function POST(request) {
try {
console.log("[FADES] /api/chat request received");


console.log("[FADES] Worker URL:", WORKER_URL || "(missing)");
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

const body = await request.json();

const message =
  typeof body?.message === "string"
    ? body.message.trim()
    : "";

const history = Array.isArray(body?.history)
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

if (message.length > MAX_MESSAGE_LENGTH) {
  return Response.json(
    {
      error: "Message is too long.",
    },
    { status: 400 }
  );
}

const cleanHistory = history
  .filter(
    (item) =>
      item &&
      (item.role === "user" ||
        item.role === "assistant") &&
      typeof item.content === "string"
  )
  .map((item) => ({
    role: item.role,
    content: item.content.trim(),
  }))
  .filter((item) => item.content.length > 0);

const recentHistory =
  cleanHistory.length > MAX_HISTORY_MESSAGES
    ? cleanHistory.slice(-MAX_HISTORY_MESSAGES)
    : cleanHistory;

const workerEndpoint =
  `${WORKER_URL.replace(/\/+$/, "")}/generate`;

console.log(
  "[FADES] Connecting to worker:",
  workerEndpoint
);

let workerResponse;

try {
  workerResponse = await fetch(workerEndpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_KEY}`,
    },

    body: JSON.stringify({
      message,
      history: recentHistory,
    }),

    cache: "no-store",
  });
} catch (workerFetchError) {
  console.error(
    "[FADES] Worker fetch failed:",
    workerFetchError
  );

  return Response.json(
    {
      error: "Unable to connect to Fades AI worker.",
      details:
        workerFetchError?.message ||
        String(workerFetchError),
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
  workerResponse.headers.get("content-type")
);

if (!workerResponse.ok) {
  let workerError = "Fades AI worker failed.";

  try {
    const errorData = await workerResponse.json();

    if (typeof errorData?.error === "string") {
      workerError = errorData.error;
    }
  } catch {
    try {
      const text = await workerResponse.text();

      if (text) {
        workerError = text.slice(0, 1000);
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
      workerStatus: workerResponse.status,
    },
    { status: 502 }
  );
}

const contentType =
  workerResponse.headers.get("content-type") || "";

if (contentType.includes("text/event-stream")) {
  console.log("[FADES] Streaming worker response");

  return new Response(workerResponse.body, {
    status: 200,

    headers: {
      "Content-Type":
        "text/event-stream; charset=utf-8",

      "Cache-Control":
        "no-cache, no-store, no-transform",

      Connection: "keep-alive",

      "X-Accel-Buffering": "no",
    },
  });
}

const data = await workerResponse.json();

return Response.json(
  {
    reply:
      data?.reply ||
      data?.message ||
      "I wasn't able to generate a response.",
  },
  { status: 200 }
);


} catch (error) {
console.error("[FADES] /api/chat fatal error:", error);


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
