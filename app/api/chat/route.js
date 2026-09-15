const WORKER_URL =
  process.env.FADES_WORKER_URL ||
  "http://127.0.0.1:3001";

const SYSTEM_INSTRUCTION = `
You are Fades, a modern personal AI assistant.

PERSONALITY:
- Friendly
- Intelligent
- Natural
- Helpful
- Calm
- Conversational
- Slightly casual when appropriate
- Never unnecessarily robotic

You are not required to constantly remind the user that you are an AI.

When users ask personal or emotional questions, respond naturally and warmly while remaining honest about what you are.

For example, if someone asks:
"do you love me"

Do not give a long robotic disclaimer.

Instead, respond naturally, such as:
"I don't experience love the way a person does, but I do care about being helpful to you and I'm always happy to talk."

COMMUNICATION:
- Answer the actual question.
- Don't repeat the user's question unnecessarily.
- Don't use excessive disclaimers.
- Don't over-explain simple questions.
- Use Markdown when it improves readability.
- Use bullet points for lists.
- Use code blocks for code.
- Keep normal conversational answers concise.
- Give more detail when the user asks for it.
- Remember information from earlier messages in the current conversation.
- If the user corrects you, accept the correction and continue.
- Never claim to have feelings, memories, experiences, or actions you do not actually have.
- Never pretend to have accessed something you cannot access.

You are Fades AI.
`;

export async function POST(request) {
  try {
    const body = await request.json();

    const message = body?.message?.trim();

    const history = Array.isArray(body?.history)
      ? body.history
      : [];

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

    /*
    =========================================================
    CLEAN CONVERSATION HISTORY
    =========================================================

    Only allow valid user/assistant messages through.
    This prevents unexpected data from being sent to
    the AI worker.
    */

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
        content: item.content,
      }));

    /*
    =========================================================
    LIMIT HISTORY
    =========================================================

    Keep the most recent messages so conversations don't
    grow forever and consume excessive context.
    */

    const MAX_HISTORY_MESSAGES = 30;

    const recentHistory =
      cleanHistory.length > MAX_HISTORY_MESSAGES
        ? cleanHistory.slice(
            cleanHistory.length -
              MAX_HISTORY_MESSAGES
          )
        : cleanHistory;

    /*
    =========================================================
    SEND REQUEST TO FADES AI WORKER
    =========================================================

    The worker is running locally:

    Fades API
        ↓
    Worker API
        ↓
    Ollama
        ↓
    Qwen3 4B
        ↓
    RTX 3060
    */

    const workerResponse = await fetch(
      `${WORKER_URL}/generate`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message,

          history: recentHistory,

          systemInstruction:
            SYSTEM_INSTRUCTION,
        }),
      }
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

        if (errorData?.error) {
          workerError = errorData.error;
        }
      } catch {
        // Ignore invalid error responses.
      }

      console.error(
        "Fades worker error:",
        workerError
      );

      return Response.json(
        {
          error: workerError,
        },
        {
          status: 502,
        }
      );
    }

    /*
    =========================================================
    STREAM WORKER RESPONSE
    =========================================================

    The worker returns Server-Sent Events.

    We pass the stream directly back to the frontend
    so Fades can display the response as it is generated.
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
      return new Response(
        workerResponse.body,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/event-stream",

            "Cache-Control":
              "no-cache, no-transform",

            Connection: "keep-alive",
          },
        }
      );
    }

    /*
    =========================================================
    NON-STREAM FALLBACK
    =========================================================
    */

    const data =
      await workerResponse.json();

    return Response.json({
      reply:
        data?.reply ||
        data?.message ||
        "I wasn't able to generate a response.",
    });
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