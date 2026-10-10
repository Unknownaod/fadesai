import { NextResponse } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PANDASCORE_API = "https://api.pandascore.co";
const OPENDOTA_API = "https://api.opendota.com/api";

/* =========================================================
   TUNING

   PandaScore free tier (docs, "Rate and connections limits" and
   changelog 2.63.0):
     - 1,000 requests / hour
     - burst limit of 60 requests / minute
     - every 429 carries a Retry-After header (seconds)

   Most 503s from this route came from fanning out
   (games x views) requests on every uncached call and blowing
   through those limits. Everything below exists to stay under
   them and to serve stale data instead of an error when we can't.
========================================================= */

const CACHE_SECONDS = 60; // CDN cache for 200 responses
const MAX_PER_PAGE = 100; // PandaScore: per_page is 1-100
const DEFAULT_PER_PAGE = 50; // PandaScore default
const REQUEST_TIMEOUT_MS = 10000;

const MAX_REQUESTS_PER_MINUTE = 50; // stay under the 60/min burst limit
const MAX_RETRIES = 2; // retries for 5xx / timeouts / short 429s
const MAX_RETRY_WAIT_MS = 4000; // never sleep longer than this to retry
const DEFAULT_429_COOLDOWN_MS = 30000; // when a 429 has no Retry-After
const MAX_COOLDOWN_MS = 10 * 60 * 1000;
const CONCURRENCY = 3; // parallel upstream calls for per-game fan-out

const STALE_MAX_MS = 6 * 60 * 60 * 1000; // serve stale data up to 6h on failure
const MAX_CACHE_ENTRIES = 300;

const MAX_AUTO_STANDINGS = 3; // running tournaments to pull standings for

/* =========================================================
   GAMES

   Left side  = the game id your frontend sends (?game=...)
   Right side = the PandaScore videogame slug (VideogameSlug enum:
   cod-mw, cs-go, dota-2, e-basketball, e-cricket, e-hockey,
   e-soccer, fifa, kog, league-of-legends, lol-wild-rift, mlbb,
   ow, pubg, r6-siege, rl, starcraft-2, starcraft-brood-war,
   valorant).

   Counter-Strike 2 lives under the `cs-go` videogame (id 3); it is
   a videogame *title* (`cs-2`) of that videogame, so `cs-go` is
   still the right slug here.
========================================================= */

const GAME_SLUGS = {
  valorant: "valorant",
  "counter-strike-2": "cs-go",
  "league-of-legends": "league-of-legends",
  "dota-2": "dota-2",
  "rocket-league": "rl",
  "overwatch-2": "ow",
  "rainbow-six-siege": "r6-siege",
  "call-of-duty": "cod-mw",
  pubg: "pubg",
  "mobile-legends": "mlbb",
};

/*
 * Per-game URL prefixes (e.g. GET /csgo/teams, /dota2/tournaments).
 * These are different from the videogame slugs above.
 */
const GAME_PATHS = {
  valorant: "valorant",
  "cs-go": "csgo",
  "league-of-legends": "lol",
  "dota-2": "dota2",
  rl: "rl",
  ow: "ow",
  "r6-siege": "r6siege",
  "cod-mw": "codmw",
  pubg: "pubg",
  mlbb: "mlbb",
};

// Games the frontend may still send, but PandaScore does not cover.
const UNSUPPORTED_GAMES = new Set(["fortnite", "apex-legends"]);

const GAME_NAMES = {
  valorant: "VALORANT",
  "cs-go": "Counter-Strike 2",
  "league-of-legends": "League of Legends",
  "dota-2": "Dota 2",
  rl: "Rocket League",
  ow: "Overwatch 2",
  "r6-siege": "Rainbow Six Siege",
  "cod-mw": "Call of Duty",
  pubg: "PUBG",
  mlbb: "Mobile Legends",
};

const ALLOWED_VIEWS = new Set([
  "additions",
  "matches",
  "tournaments",
  "brackets",
  "teams",
  "standings",
]);

/* GET /additions -> `type` allowed values */
const ADDITION_TYPES = [
  "league",
  "match",
  "player",
  "serie",
  "team",
  "tournament",
];

/* GET /additions -> `sort` allowed values */
const ADDITION_SORTS = new Set([
  "id",
  "-id",
  "modified_at",
  "-modified_at",
]);

/* GET /additions -> filter[...] and range[...] query objects */
const PASSTHROUGH_KEY = /^(filter|range)\[[a-z0-9_.]{1,64}\]$/i;
const MAX_PASSTHROUGH_PARAMS = 10;

/* ?tournament=<id or slug> */
const TOURNAMENT_REF = /^[a-z0-9][a-z0-9_-]{0,119}$/;

/* =========================================================
   SMALL HELPERS
========================================================= */

function json(data, status = 200, extraHeaders = {}) {
  const ctx = requestContext.getStore();
  const degraded =
    status === 200 && (data?.partial === true || ctx?.stale === true);

  let cacheControl = "no-store";

  if (status === 200) {
    cacheControl = degraded
      ? "public, s-maxage=15, stale-while-revalidate=30"
      : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`;
  }

  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      ...extraHeaders,
    },
  });
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function gameName(slug) {
  return GAME_NAMES[slug] || slug || "Esports";
}

function gameIdFromSlug(slug) {
  return (
    Object.entries(GAME_SLUGS).find(([, value]) => value === slug)?.[0] ||
    slug ||
    "all"
  );
}

/*
 * Accepts either the frontend game id ("counter-strike-2") or the
 * PandaScore slug ("cs-go"). Returns the frontend id, "all", or null.
 */
function resolveGame(input) {
  if (input === "all") return "all";

  if (Object.hasOwn(GAME_SLUGS, input)) return input;

  const byProviderSlug = Object.entries(GAME_SLUGS).find(
    ([, slug]) => slug === input
  );

  return byProviderSlug ? byProviderSlug[0] : null;
}

function getSelectedGames(requestedGame) {
  return requestedGame === "all"
    ? Object.entries(GAME_SLUGS)
    : [[requestedGame, GAME_SLUGS[requestedGame]]];
}

function normalizeStatus(value) {
  return String(value || "upcoming")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value) {
  if (!value) return null;

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function buildPandaScoreUrl(path, params = {}) {
  const normalizedPath = String(path).replace(/^\/+/, "");
  const url = new URL(normalizedPath, `${PANDASCORE_API}/`);

  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      continue;
    }

    // Array parameters (type, videogame, sort) are sent comma-separated,
    // e.g. /additions?type=tournament,serie,league&videogame=cs-go
    url.searchParams.set(
      key,
      Array.isArray(value) ? value.join(",") : String(value)
    );
  }

  return url;
}

function parseLinkRels(header) {
  const rels = new Set();
  if (!header) return rels;

  for (const match of header.matchAll(/rel="?([a-z]+)"?/gi)) {
    rels.add(match[1].toLowerCase());
  }

  return rels;
}

/* Runs `worker` over `items` with at most `limit` in flight. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;

      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run)
  );

  return results;
}

/* =========================================================
   ERRORS

   HTTP status we return to YOUR frontend, by cause:

     missing token / misconfig ......... 500
     PandaScore rate limit (429) ....... 429 + Retry-After
     bad parameters (400/422) .......... 400
     not found (404) ................... 404
     token rejected / plan (401/403) ... 502
     PandaScore 5xx .................... 502
     could not connect ................. 503
     timeout ........................... 504

   Before, a rate limit, a missing token and a timeout were all
   reported as 503, which made them indistinguishable.
========================================================= */

function makeError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

function isParamRejection(error) {
  return error?.code === "bad_request";
}

/* Can we hand back old cached data instead of failing? */
function isStaleServable(error) {
  return (
    error?.code !== "bad_request" &&
    error?.code !== "missing_token" &&
    error?.status !== 404
  );
}

function retryAfterSeconds(error) {
  return error?.retryAfterMs != null
    ? Math.max(1, Math.ceil(error.retryAfterMs / 1000))
    : null;
}

/* =========================================================
   REQUEST CONTEXT (per incoming request)
========================================================= */

const requestContext = new AsyncLocalStorage();

function newContext() {
  return {
    upstreamRequests: 0,
    cacheHits: 0,
    stale: false,
    staleSources: [],
    rateLimitRemaining: null,
  };
}

/* =========================================================
   MODULE-LEVEL STATE
   (shared by every request handled by the same warm instance)
========================================================= */

const responseCache = new Map(); // url -> { data, meta, storedAt, freshUntil }
const inflight = new Map(); // url -> Promise (dedupes identical calls)
const requestLog = []; // timestamps of upstream calls (sliding window)
let blockedUntil = 0; // set after a 429 so we stop hammering the API

function ttlFor(path) {
  const value = String(path);

  if (value.includes("/running")) return 20000; // live data
  if (value.includes("/matches") || value.includes("/brackets")) {
    return CACHE_SECONDS * 1000;
  }
  if (value.includes("/standings")) return 2 * 60 * 1000;
  if (value.includes("/additions")) return 30000;

  return 5 * 60 * 1000; // tournaments, teams, single resources
}

function rememberResponse(key, result, ttlMs) {
  responseCache.delete(key); // refresh insertion order

  responseCache.set(key, {
    data: result.data,
    meta: result.meta,
    storedAt: Date.now(),
    freshUntil: Date.now() + ttlMs,
  });

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
}

/*
 * Sliding-window limiter. Returns 0 when a slot was reserved, or
 * the number of seconds to wait when the window is full.
 */
function reserveRequestSlot() {
  const now = Date.now();

  while (requestLog.length && now - requestLog[0] > 60000) {
    requestLog.shift();
  }

  if (requestLog.length >= MAX_REQUESTS_PER_MINUTE) {
    return Math.max(1, Math.ceil((60000 - (now - requestLog[0])) / 1000));
  }

  requestLog.push(now);
  return 0;
}

/* =========================================================
   SHARED PANDASCORE REQUEST

   Authentication: Bearer token in the Authorization header. The
   token is never placed in the URL, so it cannot leak into logs.

   Behaviour:
     1. fresh cache hit            -> no upstream call
     2. identical call in flight   -> share it
     3. local limiter / cooldown   -> don't call, use stale cache
     4. 5xx / timeout / network    -> retry with backoff
     5. 429                        -> honour Retry-After (short waits
                                      only), then cool down
     6. still failing              -> serve stale cache if we have any

   Returns { data, meta } where meta carries pagination and
   rate-limit information from the response headers.
========================================================= */

async function singleAttempt(urlString, path, token) {
  let response;

  try {
    response = await fetch(urlString, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut =
      cause?.name === "TimeoutError" || cause?.name === "AbortError";

    throw makeError(
      timedOut
        ? "PandaScore request timed out."
        : "Could not connect to PandaScore.",
      {
        status: timedOut ? 504 : 503,
        code: timedOut ? "timeout" : "network",
        retryable: true,
      }
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let providerMessage = "";

    // PandaScore error bodies: { "error": "<id>", "message": "<text>" }
    try {
      const parsed = JSON.parse(body);

      providerMessage =
        (typeof parsed?.message === "string" && parsed.message) ||
        (typeof parsed?.error === "string" && parsed.error) ||
        parsed?.errors?.[0]?.detail ||
        "";
    } catch {
      // Provider returned a non-JSON error body.
    }

    console.error("[PandaScore] Request failed", {
      path,
      status: response.status,
      details: body.slice(0, 500),
    });

    const providerStatus = response.status;
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

    if (providerStatus === 429) {
      throw makeError("PandaScore rate limit reached.", {
        status: 429,
        providerStatus,
        code: "rate_limited",
        retryable: true,
        retryAfterMs: retryAfterMs ?? DEFAULT_429_COOLDOWN_MS,
      });
    }

    if (providerStatus === 400 || providerStatus === 422) {
      throw makeError(
        `PandaScore rejected the request parameters.${
          providerMessage ? ` ${providerMessage}` : ""
        }`,
        { status: 400, providerStatus, code: "bad_request" }
      );
    }

    if (providerStatus === 401) {
      throw makeError("PandaScore rejected the API token.", {
        status: 502,
        providerStatus,
        code: "unauthorized",
      });
    }

    if (providerStatus === 403) {
      throw makeError(
        `PandaScore denied access. This endpoint or field is not included in your plan.${
          providerMessage ? ` ${providerMessage}` : ""
        }`,
        { status: 502, providerStatus, code: "forbidden" }
      );
    }

    if (providerStatus === 404) {
      throw makeError("PandaScore could not find the requested resource.", {
        status: 404,
        providerStatus,
        code: "not_found",
      });
    }

    // 5xx: PandaScore recommends simply trying again.
    throw makeError(`PandaScore request failed (${providerStatus}).`, {
      status: 502,
      providerStatus,
      code: "upstream_error",
      retryable: providerStatus >= 500,
    });
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw makeError("PandaScore returned an invalid JSON response.", {
      status: 502,
      code: "invalid_json",
      retryable: true,
    });
  }

  const rels = parseLinkRels(response.headers.get("link"));

  return {
    data,
    meta: {
      rateLimitRemaining: safeNumber(
        response.headers.get("x-rate-limit-remaining")
      ),
      page: safeNumber(response.headers.get("x-page")),
      perPage: safeNumber(response.headers.get("x-per-page")),
      total: safeNumber(response.headers.get("x-total")),
      hasNext: rels.has("next"),
      hasPrev: rels.has("prev"),
    },
  };
}

async function fetchWithRetry(urlString, path, token) {
  const ctx = requestContext.getStore();
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const cooldownMs = blockedUntil - Date.now();

    if (cooldownMs > 0) {
      throw makeError("PandaScore rate limit reached.", {
        status: 429,
        code: "rate_limited",
        retryAfterMs: cooldownMs,
      });
    }

    const waitSeconds = reserveRequestSlot();

    if (waitSeconds > 0) {
      throw makeError(
        "Request budget for this minute is used up. Try again shortly.",
        {
          status: 429,
          code: "rate_limited",
          retryAfterMs: waitSeconds * 1000,
        }
      );
    }

    if (ctx) ctx.upstreamRequests += 1;

    try {
      return await singleAttempt(urlString, path, token);
    } catch (error) {
      lastError = error;

      const delay =
        error.retryAfterMs ??
        300 * 2 ** attempt + Math.floor(Math.random() * 150);

      const willRetry =
        error.retryable && attempt < MAX_RETRIES && delay <= MAX_RETRY_WAIT_MS;

      if (!willRetry) {
        if (error.providerStatus === 429) {
          blockedUntil =
            Date.now() +
            Math.min(error.retryAfterMs ?? DEFAULT_429_COOLDOWN_MS, MAX_COOLDOWN_MS);
        }

        throw error;
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

async function pandaRequest(path, params = {}) {
  const token = process.env.PANDASCORE_API_TOKEN?.trim();

  if (!token) {
    throw makeError(
      "PandaScore token is missing. Configure PANDASCORE_API_TOKEN on the server.",
      { status: 500, code: "missing_token" }
    );
  }

  const ctx = requestContext.getStore();
  const urlString = buildPandaScoreUrl(path, params).toString();
  const cached = responseCache.get(urlString);
  const now = Date.now();

  if (cached && cached.freshUntil > now) {
    if (ctx) ctx.cacheHits += 1;

    return {
      data: cached.data,
      meta: { ...cached.meta, cached: true },
    };
  }

  if (inflight.has(urlString)) {
    return inflight.get(urlString);
  }

  const promise = (async () => {
    try {
      const result = await fetchWithRetry(urlString, path, token);

      rememberResponse(urlString, result, ttlFor(path));

      if (ctx && result.meta.rateLimitRemaining !== null) {
        ctx.rateLimitRemaining = result.meta.rateLimitRemaining;
      }

      return result;
    } catch (error) {
      if (
        cached &&
        Date.now() - cached.storedAt < STALE_MAX_MS &&
        isStaleServable(error)
      ) {
        console.warn("[PandaScore] Serving stale data", {
          path,
          reason: error.message,
        });

        if (ctx) {
          ctx.stale = true;
          ctx.staleSources.push({
            path,
            reason: error.message,
            ageSeconds: Math.round((Date.now() - cached.storedAt) / 1000),
          });
        }

        return {
          data: cached.data,
          meta: { ...cached.meta, stale: true },
        };
      }

      throw error;
    } finally {
      inflight.delete(urlString);
    }
  })();

  inflight.set(urlString, promise);
  return promise;
}

async function pandaFetch(path, params = {}) {
  const { data } = await pandaRequest(path, params);
  return data;
}

/* =========================================================
   PUBLIC BACKUP REQUEST HELPER

   This is for public backup providers only.
   Never use it to make PandaScore requests.
========================================================= */

async function publicFetch(url, provider) {
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (cause) {
    throw new Error(
      `${provider} request failed: ${
        cause?.name === "TimeoutError" ? "timeout" : "network error"
      }.`
    );
  }

  if (!response.ok) {
    throw new Error(`${provider} returned HTTP ${response.status}.`);
  }

  return response.json();
}

/* =========================================================
   OPENDOTA BACKUP

   Public, no-token source for professional Dota 2 match history.
   This is not an upcoming schedule or an official bracket API.
========================================================= */

async function getOpenDotaProMatches() {
  const matches = await publicFetch(
    `${OPENDOTA_API}/proMatches`,
    "OpenDota"
  );

  return toArray(matches).map((match) => ({
    id: `opendota-${match.match_id}`,
    _source: "OpenDota",
    _game: "dota-2",
    videogame: {
      slug: "dota-2",
      name: "Dota 2",
    },
    status: "finished",
    begin_at: match.start_time
      ? new Date(match.start_time * 1000).toISOString()
      : null,
    scheduled_at: null,
    name: match.league_name || "Professional Dota 2",
    match_type: "Professional match",
    tournament: {
      id: match.leagueid ?? null,
      name: match.league_name || "Professional Dota 2",
    },
    league: {
      name: match.league_name || "Professional Dota 2",
    },
    serie: {},
    opponents: [
      {
        opponent: {
          id: match.radiant_team_id ?? null,
          name: match.radiant_name || "Radiant",
        },
        score: safeNumber(match.radiant_score),
      },
      {
        opponent: {
          id: match.dire_team_id ?? null,
          name: match.dire_name || "Dire",
        },
        score: safeNumber(match.dire_score),
      },
    ],
    number_of_games: null,
    winner_id: null,
    results: [],
    streams_list: [],
    original_url: `https://www.opendota.com/matches/${match.match_id}`,
  }));
}

/* =========================================================
   ADDITIONS
   PandaScore GET /additions  (available to all plans)

   Query parameters (per the API reference):
     filter[...]   object   filter results
     range[...]    object   select results within ranges
     sort          array    id | -id | modified_at | -modified_at
     page          integer  >= 1, default 1
     per_page      integer  1-100, default 50
     type          array    league | match | player | serie |
                            team | tournament
     since         date-time  filter out older results
     videogame     array    videogame id(s) or slug(s)

   Response: array of
     {
       change_type: "creation" | "update" | "deletion",
       id,
       modified_at,
       type: "league" | "match" | "player" | "serie" | "team" | "tournament",
       object: { ... depends on `type` ... }
     }

   Note: this endpoint only shows unchanged objects.
========================================================= */

function mapAddition(entry, selectedGame, { includeRaw = false } = {}) {
  const object = entry?.object || {};
  const videogame = object.videogame || {};
  const providerSlug = videogame.slug || null;

  const game = providerSlug
    ? gameIdFromSlug(providerSlug)
    : selectedGame;

  const type = entry?.type || "unknown";
  const changeType = entry?.change_type || "creation";

  const title =
    object.full_name ||
    object.name ||
    object.slug ||
    `${type} #${entry?.id ?? object.id ?? "unknown"}`;

  const seriesList = toArray(object.series)
    .map((serie) => serie?.full_name || serie?.name)
    .filter(Boolean);

  // League objects embed their series; other objects reference
  // their parent league / serie / tournament.
  const leagueName =
    object.league?.name || (type === "league" ? object.name : null) || null;

  const seriesName =
    object.serie?.full_name ||
    (type === "serie" ? object.full_name || object.name : null) ||
    null;

  const tournamentName =
    object.tournament?.name ||
    (type === "tournament" ? object.name : null) ||
    null;

  const relatedNames = [
    leagueName,
    seriesName,
    tournamentName,
    ...seriesList,
  ].filter((name, index, all) => name && all.indexOf(name) === index);

  const modifiedAt = entry?.modified_at || object.modified_at || null;

  const mapped = {
    id: `${type}-${entry?.id ?? object.id ?? title}`,
    providerId: safeNumber(entry?.id),
    objectId: safeNumber(object.id),
    type,
    changeType,
    title,
    name: title,
    description: object.description || null,
    game,
    gameSlug: providerSlug || GAME_SLUGS[selectedGame] || null,
    gameName:
      videogame.name ||
      gameName(providerSlug || GAME_SLUGS[selectedGame]),
    image:
      object.image_url ||
      object.league?.image_url ||
      object.serie?.image_url ||
      null,
    logo: object.image_url || null,
    // Only the URL PandaScore provides. No guessed links.
    url: object.url || object.official_url || null,
    modifiedAt,
    createdAt: changeType === "creation" ? modifiedAt : null,
    beginAt: object.begin_at || object.scheduled_at || null,
    endAt: object.end_at || null,
    status: normalizeStatus(object.status || changeType),
    league: leagueName,
    series: seriesName,
    seriesList,
    tournament: tournamentName,
    relatedNames,
    region: object.location || null,
    acronym: object.acronym || null,
    slug: object.slug || null,
  };

  if (includeRaw) {
    mapped.raw = object;
  }

  return mapped;
}

function sortAdditions(items, sortList) {
  const key = sortList?.[0] || "-modified_at";
  const descending = key.startsWith("-");
  const field = key.replace(/^-/, "");

  const value = (item) =>
    field === "id"
      ? item.providerId ?? 0
      : item.modifiedAt
        ? new Date(item.modifiedAt).getTime()
        : 0;

  return [...items].sort((a, b) =>
    descending ? value(b) - value(a) : value(a) - value(b)
  );
}

async function getAdditions({
  selectedGame,
  requestedTypes,
  since,
  sort,
  perPage,
  page,
  passthrough,
  includeRaw,
}) {
  const games = getSelectedGames(selectedGame);

  const baseParams = {
    // Omit `type` when all six types are requested; it is the default.
    type:
      requestedTypes.length === ADDITION_TYPES.length
        ? undefined
        : requestedTypes,
    sort,
    per_page: perPage,
    page,
    since,
    ...passthrough,
  };

  const mapEntries = (entries, gameId) =>
    toArray(entries).map((entry) =>
      mapAddition(entry, gameId, { includeRaw })
    );

  /*
   * `videogame` accepts several slugs, so a single request covers
   * every selected game. That keeps pagination (`page`, `per_page`)
   * and sorting correct across all games instead of per game.
   */
  try {
    const { data, meta } = await pandaRequest("/additions", {
      ...baseParams,
      videogame: games.map(([, slug]) => slug),
    });

    return {
      data: mapEntries(data, selectedGame),
      warnings: [],
      meta,
    };
  } catch (error) {
    // One rejected slug should not break every other game: retry per
    // game and report the failures as warnings.
    if (games.length > 1 && isParamRejection(error)) {
      const results = await mapLimit(games, CONCURRENCY, async ([gameId, providerSlug]) => {
        const { data } = await pandaRequest("/additions", {
          ...baseParams,
          videogame: providerSlug,
        });

        return mapEntries(data, gameId);
      });

      const data = [];
      const warnings = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          data.push(...result.value);
        } else {
          warnings.push(toWarning(games[index][0], result.reason));
        }
      });

      return {
        data: sortAdditions(data, sort),
        warnings,
        meta: null,
      };
    }

    throw error;
  }
}

/* =========================================================
   NORMALIZERS
========================================================= */

/*
 * PandaScore matches carry scores in `results: [{ team_id, score }]`
 * (or `player_id` for 1v1 games), not on the opponent entries.
 * A match name looks like "Grand final: Team A vs Team B", so the
 * part before ":" is the round.
 */
function roundLabel(match) {
  const name = String(match.name || "");
  const prefix = name.includes(":") ? name.split(":")[0].trim() : "";

  return prefix || name || null;
}

/*
 * Matches expose streams in `streams_list`. (`official_stream_url`
 * and `live.url` are not usable: the former does not exist in the
 * v2 API, the latter is a wss:// websocket address.)
 */
function pickStreamUrl(match) {
  const streams = toArray(match.streams_list);

  const best =
    streams.find((stream) => stream?.main && stream.raw_url) ||
    streams.find((stream) => stream?.official && stream.raw_url) ||
    streams.find((stream) => stream?.raw_url);

  return best?.raw_url || match.original_url || null;
}

function recordGame(record, fallback) {
  if (record?._game) return record._game;

  const slug =
    record?.videogame?.slug ||
    record?.current_videogame?.slug ||
    record?.league?.videogame?.slug ||
    null;

  return slug ? gameIdFromSlug(slug) : fallback;
}

function tagRecords(records, gameId) {
  return toArray(records).map((record) =>
    record && typeof record === "object" ? { ...record, _game: gameId } : record
  );
}

function mapMatch(match, selectedGame, { tournament: tournamentOverride } = {}) {
  const game = recordGame(match, selectedGame);
  const opponents = toArray(match.opponents);
  const results = toArray(match.results);

  const mapOpponent = (entry) => {
    const opponent = entry?.opponent || {};

    const result =
      opponent.id != null
        ? results.find(
            (item) =>
              String(item?.team_id ?? item?.player_id) === String(opponent.id)
          )
        : null;

    return {
      id: opponent.id != null ? String(opponent.id) : null,
      name: opponent.name || "TBA",
      acronym: opponent.acronym || null,
      logo: opponent.image_url || null,
      type: entry?.type || null,
      score: safeNumber(result?.score ?? entry?.score),
    };
  };

  const tournament = match.tournament || tournamentOverride || {};
  const league = match.league || {};
  const serie = match.serie || {};
  const providerGame = match.videogame?.slug || GAME_SLUGS[game] || null;

  return {
    id: String(match.id),
    source: match._source || "PandaScore",
    game,
    gameSlug: providerGame,
    gameName:
      match.videogame?.name || gameName(providerGame || game),
    tournament:
      tournament.name ||
      league.name ||
      serie.full_name ||
      "Tournament TBA",
    tournamentId: tournament.id ?? match.tournament_id ?? null,
    league: league.name || null,
    serie: serie.full_name || null,
    tier: tournament.tier || null,
    status: match.status || "not_started",
    startTime: match.begin_at || match.scheduled_at || null,
    date: match.begin_at || match.scheduled_at || null,
    scheduledAt: match.scheduled_at || null,
    endTime: match.end_at || null,
    bestOf: safeNumber(match.number_of_games),
    round: roundLabel(match),
    url: pickStreamUrl(match),
    streams: toArray(match.streams_list)
      .filter((stream) => stream?.raw_url)
      .map((stream) => ({
        url: stream.raw_url,
        embedUrl: stream.embed_url || null,
        language: stream.language || null,
        main: Boolean(stream.main),
        official: Boolean(stream.official),
      })),
    teams: [
      mapOpponent(opponents[0]),
      mapOpponent(opponents[1]),
    ],
    winnerId:
      match.winner_id != null ? String(match.winner_id) : null,
    forfeit: match.forfeit ?? null,
    draw: match.draw ?? null,
    rescheduled: match.rescheduled ?? null,
    results,
  };
}

function mapTournament(tournament, selectedGame) {
  const game = recordGame(tournament, selectedGame);

  return {
    id: String(tournament.id),
    source: "PandaScore",
    game,
    gameName:
      tournament.videogame?.name || gameName(GAME_SLUGS[game]),
    name: tournament.name || tournament.slug || "Tournament",
    organizer:
      tournament.league?.name ||
      tournament.serie?.full_name ||
      null,
    status: tournament.status || "upcoming",
    startDate: tournament.begin_at || null,
    endDate: tournament.end_at || null,
    prizePool: tournament.prizepool || null,
    teamCount: safeNumber(tournament.teams?.length),
    image:
      tournament.league?.image_url ||
      tournament.serie?.image_url ||
      tournament.image_url ||
      null,
    // `type` is online / offline / online/offline in the v2 API.
    format: tournament.tournament_type || tournament.type || null,
    tier: tournament.tier || null,
    region: tournament.region || null,
    hasBracket: tournament.has_bracket ?? null,
    winnerId:
      tournament.winner_id != null ? String(tournament.winner_id) : null,
    url: tournament.official_url || tournament.url || null,
  };
}

function mapTeam(team, selectedGame) {
  const game = recordGame(team, selectedGame);

  return {
    id: String(team.id),
    source: "PandaScore",
    game,
    gameName:
      team.current_videogame?.name ||
      team.videogame?.name ||
      gameName(GAME_SLUGS[game]),
    name: team.name || "Unknown team",
    acronym: team.acronym || null,
    logo: team.image_url || null,
    region: team.location || null,
    players: toArray(team.players).map((player) => ({
      id: player.id != null ? String(player.id) : null,
      name: player.name || player.slug || "Unknown player",
      role: player.role || null,
      position: player.role || null,
      nationality: player.nationality || null,
      country: player.nationality || null,
      active: player.active ?? null,
      image: player.image_url || null,
    })),
    // PandaScore does not provide a public team page URL.
    url: null,
  };
}

function mapStandingRow(row) {
  const team = row?.team || {};

  return {
    rank: safeNumber(row?.rank),
    team: {
      id: team.id != null ? String(team.id) : null,
      name: team.name || "TBA",
      acronym: team.acronym || null,
      logo: team.image_url || null,
    },
    wins: safeNumber(row?.wins),
    losses: safeNumber(row?.losses),
    ties: safeNumber(row?.ties),
    total: safeNumber(row?.total),
    gameWins: safeNumber(row?.game_wins),
    gameLosses: safeNumber(row?.game_losses),
    gameTies: safeNumber(row?.game_ties),
    // Present on bracket standings only.
    lastMatch: row?.last_match
      ? {
          id: String(row.last_match.id),
          name: row.last_match.name || null,
          status: row.last_match.status || null,
          winnerId:
            row.last_match.winner_id != null
              ? String(row.last_match.winner_id)
              : null,
        }
      : null,
  };
}

/*
 * Approximate match grouping (no `tournament` param given).
 * For an official bracket tree request ?view=brackets&tournament=<id>.
 */
function buildBrackets(matches, selectedGame) {
  const tournaments = new Map();

  for (const match of matches) {
    const tournament = match.tournament || {};
    const tournamentId = tournament.id;

    if (tournamentId == null) continue;

    const game = recordGame(match, selectedGame);

    if (!tournaments.has(tournamentId)) {
      tournaments.set(tournamentId, {
        id: String(tournamentId),
        source: match._source || "PandaScore",
        name:
          tournament.name ||
          match.league?.name ||
          "Tournament",
        format: "Match schedule",
        status: match.status || "scheduled",
        url: tournament.official_url || null,
        game,
        gameName: gameName(GAME_SLUGS[game]),
        tier: tournament.tier || null,
        hasBracket: tournament.has_bracket ?? null,
        approximate: true,
        rounds: [],
      });
    }

    const bracket = tournaments.get(tournamentId);
    const roundName = roundLabel(match) || "Matches";

    let round = bracket.rounds.find(
      (item) => item.name === roundName
    );

    if (!round) {
      round = {
        id: `${tournamentId}-${bracket.rounds.length + 1}`,
        name: roundName,
        matches: [],
      };

      bracket.rounds.push(round);
    }

    round.matches.push(mapMatch(match, selectedGame));
  }

  return Array.from(tournaments.values());
}

/* =========================================================
   RESOURCE REQUESTS
========================================================= */

function toWarning(gameId, reason, extra = {}) {
  return {
    game: gameId,
    ...extra,
    provider: extra.provider || "PandaScore",
    message: reason?.message || "Request failed.",
    providerStatus: reason?.providerStatus ?? null,
    status: reason?.status ?? null,
    retryAfter: retryAfterSeconds(reason),
  };
}

/*
 * One request covers every selected game: PandaScore's
 * `filter[videogame]` accepts a comma-separated list. That turns the
 * old "games x 2" fan-out (20 calls for game=all) into 3 calls.
 */
async function fetchMatchBucket(bucket, games, { perPage, page }) {
  const fetchFor = (slugs) =>
    pandaFetch(`/matches/${bucket}`, {
      "filter[videogame]": slugs,
      sort: bucket === "past" ? "-begin_at" : "begin_at",
      per_page: perPage,
      page,
    });

  try {
    const records = toArray(await fetchFor(games.map(([, slug]) => slug)));

    return {
      records: games.length === 1 ? tagRecords(records, games[0][0]) : records,
      warnings: [],
    };
  } catch (error) {
    // A single rejected slug must not take every other game down.
    if (games.length > 1 && isParamRejection(error)) {
      const settled = await mapLimit(games, CONCURRENCY, async ([gameId, slug]) =>
        tagRecords(await fetchFor([slug]), gameId)
      );

      const records = [];
      const warnings = [];

      settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
          records.push(...result.value);
        } else {
          warnings.push(
            toWarning(games[index][0], result.reason, { view: bucket })
          );
        }
      });

      if (records.length === 0 && warnings.length > 0) {
        throw settled.find((item) => item.status === "rejected").reason;
      }

      return { records, warnings };
    }

    throw error;
  }
}

/*
 * Running + upcoming + past matches. (Running matches were missing
 * before, so live games never showed up.)
 */
async function collectRawMatches(games, { perPage, page }) {
  const buckets = ["running", "upcoming", "past"];

  const results = await Promise.allSettled(
    buckets.map((bucket) =>
      fetchMatchBucket(bucket, games, { perPage, page })
    )
  );

  const records = [];
  const warnings = [];

  for (let index = 0; index < results.length; index += 1) {
    const bucket = buckets[index];
    const result = results[index];

    if (result.status === "fulfilled") {
      records.push(...result.value.records);
      warnings.push(...result.value.warnings);
      continue;
    }

    // Public fallback for historical Dota 2 matches only.
    if (bucket === "past" && games.some(([id]) => id === "dota-2")) {
      try {
        console.warn(
          "[Esports] Falling back to OpenDota for historical Dota 2 matches."
        );

        const backup = (await getOpenDotaProMatches()).slice(0, perPage);
        records.push(...backup);

        warnings.push({
          game: "dota-2",
          view: "past",
          provider: "OpenDota",
          fallback: true,
          message:
            "PandaScore past matches were unavailable; showing OpenDota professional matches for Dota 2.",
          providerStatus: result.reason?.providerStatus ?? null,
          status: result.reason?.status ?? null,
          retryAfter: retryAfterSeconds(result.reason),
        });

        continue;
      } catch (backupError) {
        console.error(
          "[Esports] OpenDota fallback failed:",
          backupError.message
        );
      }
    }

    warnings.push(
      toWarning(games.length === 1 ? games[0][0] : "all", result.reason, {
        view: bucket,
      })
    );
  }

  // Drop duplicates (a match can briefly appear in two buckets).
  const seen = new Set();

  const unique = records.filter((record) => {
    const key = String(record?.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { records: unique, warnings };
}

async function collectMatchesByGame(games, options) {
  const { records, warnings } = await collectRawMatches(games, options);

  const data = records.map((record) =>
    mapMatch(record, games.length === 1 ? games[0][0] : "all")
  );

  data.sort((a, b) => {
    const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return timeA - timeB;
  });

  return { data, warnings };
}

async function collectBracketsByGame(games, options) {
  const { records, warnings } = await collectRawMatches(games, options);

  return {
    data: buildBrackets(records, games.length === 1 ? games[0][0] : "all"),
    warnings,
  };
}

/*
 * Per-game endpoints (/csgo/teams, /dota2/tournaments, ...).
 * Fetched with limited concurrency so game=all can't burst past the
 * free tier's 60-requests-per-minute limit. A failure for one game
 * does not discard results for the others.
 */
async function collectByGame(games, fetchGame, mapItem) {
  const results = await mapLimit(games, CONCURRENCY, async ([gameId, slug]) => {
    const records = await fetchGame(slug, gameId);
    return toArray(records).map((record) => mapItem(record, gameId));
  });

  const data = [];
  const warnings = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(...result.value);
      return;
    }

    warnings.push(toWarning(games[index][0], result.reason));
  });

  return { data, warnings };
}

function gamePath(slug, resource) {
  const prefix = GAME_PATHS[slug];

  if (!prefix) {
    throw makeError(`No PandaScore endpoint is configured for "${slug}".`, {
      status: 400,
      code: "bad_request",
    });
  }

  return `/${prefix}/${resource}`;
}

async function getTournaments(slug, { perPage, page }) {
  return toArray(
    await pandaFetch(gamePath(slug, "tournaments"), {
      sort: "-begin_at",
      per_page: perPage,
      page,
    })
  );
}

async function getTeams(slug, { perPage, page }) {
  return toArray(
    await pandaFetch(gamePath(slug, "teams"), {
      sort: "name",
      per_page: perPage,
      page,
    })
  );
}

/* =========================================================
   OFFICIAL BRACKETS AND STANDINGS (need ?tournament=<id|slug>)

   GET /tournaments/{id}/brackets   (available to all plans)
   GET /tournaments/{id}/standings  (available to all plans)
========================================================= */

async function getTournamentBracket(ref, requestedGame, { page }) {
  const [bracketResult, tournamentResult] = await Promise.allSettled([
    pandaFetch(`/tournaments/${encodeURIComponent(ref)}/brackets`, {
      per_page: MAX_PER_PAGE,
      page,
      sort: "scheduled_at",
    }),
    pandaFetch(`/tournaments/${encodeURIComponent(ref)}`),
  ]);

  // The bracket itself is required; tournament details are a bonus.
  if (bracketResult.status === "rejected") {
    throw bracketResult.reason;
  }

  const warnings = [];
  const tournament =
    tournamentResult.status === "fulfilled" ? tournamentResult.value : null;

  if (tournamentResult.status === "rejected") {
    warnings.push(
      toWarning(requestedGame, tournamentResult.reason, {
        view: "tournament-details",
      })
    );
  }

  const game = tournament?.videogame?.slug
    ? gameIdFromSlug(tournament.videogame.slug)
    : requestedGame;

  const matches = toArray(bracketResult.value);

  const bracket = {
    id: String(tournament?.id ?? ref),
    source: "PandaScore",
    name: tournament?.name || `Tournament ${ref}`,
    format: "Bracket",
    status: tournament?.status || "scheduled",
    url: tournament?.official_url || null,
    game,
    gameName:
      tournament?.videogame?.name || gameName(GAME_SLUGS[game]),
    tier: tournament?.tier || null,
    approximate: false,
    rounds: [],
  };

  for (const match of matches) {
    const mapped = {
      ...mapMatch(match, game, { tournament: tournament || undefined }),
      previousMatches: toArray(match.previous_matches).map((previous) => ({
        matchId: String(previous.match_id),
        type: previous.type || null,
      })),
    };

    const roundName = roundLabel(match) || "Matches";
    let round = bracket.rounds.find((item) => item.name === roundName);

    if (!round) {
      round = {
        id: `${bracket.id}-${bracket.rounds.length + 1}`,
        name: roundName,
        matches: [],
      };

      bracket.rounds.push(round);
    }

    round.matches.push(mapped);
  }

  return { data: [bracket], warnings };
}

async function getTournamentStandings(ref, requestedGame, label = null) {
  const rows = toArray(
    await pandaFetch(`/tournaments/${encodeURIComponent(ref)}/standings`, {
      per_page: MAX_PER_PAGE,
    })
  );

  return {
    tournamentId: String(ref),
    name: label,
    game: requestedGame,
    rows: rows.map(mapStandingRow),
  };
}

/*
 * No ?tournament given: use the currently running tournaments of
 * the selected game (a single game only, to keep the call count low).
 */
async function getRunningStandings(games) {
  const [gameId, slug] = games[0];

  const running = toArray(
    await pandaFetch(gamePath(slug, "tournaments/running"), {
      sort: "begin_at",
      per_page: MAX_AUTO_STANDINGS,
    })
  ).slice(0, MAX_AUTO_STANDINGS);

  const settled = await mapLimit(running, CONCURRENCY, (tournament) =>
    getTournamentStandings(tournament.id, gameId, tournament.name || null)
  );

  const data = [];
  const warnings = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.rows.length > 0) data.push(result.value);
      return;
    }

    warnings.push(
      toWarning(gameId, result.reason, {
        view: "standings",
        tournamentId: String(running[index]?.id ?? ""),
      })
    );
  });

  return { data, warnings, runningCount: running.length };
}

/* =========================================================
   REQUEST PARSING HELPERS
========================================================= */

/*
 * Forwards filter[...] and range[...] query parameters to
 * GET /additions, limited to a safe key format and size.
 */
function collectPassthroughParams(searchParams) {
  const params = {};
  let count = 0;

  for (const [key, value] of searchParams.entries()) {
    if (!PASSTHROUGH_KEY.test(key)) continue;
    if (value.length === 0 || value.length > 200) continue;

    params[key] = value;

    count += 1;
    if (count >= MAX_PASSTHROUGH_PARAMS) break;
  }

  return params;
}

function parseCommaList(value) {
  return value
    ? [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        ),
      ]
    : [];
}

/* =========================================================
   RESPONSE ENVELOPE
========================================================= */

function buildEnvelope({
  requestedGame,
  view,
  data,
  warnings = [],
  page,
  perPage,
  since,
  types,
  sort,
  meta,
  notice,
}) {
  const ctx = requestContext.getStore();
  const stale = Boolean(ctx?.stale);

  return {
    provider: "PandaScore",
    game: requestedGame,
    view,
    count: data.length,
    page,
    perPage,
    since: view === "additions" ? since : undefined,
    types: view === "additions" ? types : undefined,
    sort: view === "additions" ? sort : undefined,
    pagination:
      view === "additions" && meta
        ? {
            page: meta.page ?? page,
            perPage: meta.perPage ?? perPage,
            total: meta.total,
            hasNext: meta.hasNext,
            hasPrev: meta.hasPrev,
          }
        : undefined,
    rateLimitRemaining:
      ctx?.rateLimitRemaining ?? meta?.rateLimitRemaining ?? undefined,
    updatedAt: new Date().toISOString(),
    partial: warnings.length > 0,
    stale,
    staleSources: stale ? ctx.staleSources : undefined,
    warnings,

    // Generic result list.
    items: data,

    // Properties consumed by the existing frontend.
    additions: view === "additions" ? data : [],
    matches: view === "matches" ? data : [],
    tournaments: view === "tournaments" ? data : [],
    brackets: view === "brackets" ? data : [],
    teams: view === "teams" ? data : [],
    standings: view === "standings" ? data : [],

    notice:
      notice ||
      (stale
        ? "PandaScore was unavailable or rate limited, so some data is served from a recent cache."
        : view === "brackets" && data.some((item) => item.approximate)
          ? "Brackets are approximate groupings from match data. Pass ?tournament=<id or slug> for the official bracket tree."
          : warnings.length > 0
            ? "Some data providers or games were unavailable. Check the warnings array for details."
            : undefined),
  };
}

/* =========================================================
   GET ROUTE
========================================================= */

export async function GET(request) {
  return requestContext.run(newContext(), () => handleGet(request));
}

async function handleGet(request) {
  try {
    const { searchParams } = new URL(request.url);

    const gameInput = (
      searchParams.get("game") || "all"
    ).toLowerCase();

    const view = (
      searchParams.get("view") || "matches"
    ).toLowerCase();

    const page = Math.max(
      1,
      Math.min(
        10000,
        Math.floor(safeNumber(searchParams.get("page")) || 1)
      )
    );

    const perPage = Math.max(
      1,
      Math.min(
        MAX_PER_PAGE,
        Math.floor(
          safeNumber(searchParams.get("per_page")) || DEFAULT_PER_PAGE
        )
      )
    );

    const sinceInput = searchParams.get("since");
    const since = sinceInput ? safeDate(sinceInput) : null;

    const tournamentInput = (searchParams.get("tournament") || "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_VIEWS.has(view)) {
      return json(
        {
          error: "Invalid esports view.",
          allowedViews: [...ALLOWED_VIEWS],
        },
        400
      );
    }

    if (tournamentInput && !TOURNAMENT_REF.test(tournamentInput)) {
      return json(
        {
          error:
            "Invalid tournament. Use a PandaScore tournament id or slug.",
        },
        400
      );
    }

    // Games the frontend lists but PandaScore does not cover.
    if (UNSUPPORTED_GAMES.has(gameInput)) {
      return json(
        buildEnvelope({
          requestedGame: gameInput,
          view,
          data: [],
          page,
          perPage,
          since,
          types: [],
          sort: [],
          notice:
            "PandaScore does not provide esports data for this game.",
        })
      );
    }

    const requestedGame = resolveGame(gameInput);

    if (!requestedGame) {
      return json(
        {
          error: "Unsupported game.",
          supportedGames: Object.keys(GAME_SLUGS),
        },
        400
      );
    }

    if (sinceInput && !since) {
      return json(
        {
          error:
            "Invalid since date. Supply a valid ISO 8601 date-time.",
          example: "2026-10-09T00:00:00Z",
        },
        400
      );
    }

    let data = [];
    let warnings = [];
    let meta = null;
    let requestedTypes = [];
    let sort = [];
    let notice;

    const games = getSelectedGames(requestedGame);

    if (view === "additions") {
      requestedTypes = searchParams.get("type")
        ? parseCommaList(searchParams.get("type"))
        : [...ADDITION_TYPES];

      const invalidTypes = requestedTypes.filter(
        (type) => !ADDITION_TYPES.includes(type)
      );

      if (invalidTypes.length) {
        return json(
          {
            error: "One or more addition types are invalid.",
            invalidTypes,
            allowedTypes: ADDITION_TYPES,
          },
          400
        );
      }

      if (requestedTypes.length === 0) {
        return json(
          {
            error: "Select at least one addition type.",
            allowedTypes: ADDITION_TYPES,
          },
          400
        );
      }

      sort = searchParams.get("sort")
        ? parseCommaList(searchParams.get("sort"))
        : ["-modified_at"];

      const invalidSorts = sort.filter(
        (item) => !ADDITION_SORTS.has(item)
      );

      if (invalidSorts.length || sort.length === 0) {
        return json(
          {
            error: "One or more sort values are invalid.",
            invalidSorts,
            allowedSorts: [...ADDITION_SORTS],
          },
          400
        );
      }

      const result = await getAdditions({
        selectedGame: requestedGame,
        requestedTypes,
        since,
        sort,
        perPage,
        page,
        passthrough: collectPassthroughParams(searchParams),
        includeRaw: searchParams.get("raw") === "1",
      });

      data = result.data;
      warnings = result.warnings;
      meta = result.meta;
    }

    if (view === "matches") {
      const result = await collectMatchesByGame(games, { perPage, page });
      data = result.data;
      warnings = result.warnings;
    }

    if (view === "tournaments") {
      const result = await collectByGame(
        games,
        (slug) => getTournaments(slug, { perPage, page }),
        mapTournament
      );

      data = result.data;
      warnings = result.warnings;
    }

    if (view === "teams") {
      const result = await collectByGame(
        games,
        (slug) => getTeams(slug, { perPage, page }),
        mapTeam
      );

      data = result.data;
      warnings = result.warnings;
    }

    if (view === "brackets") {
      if (tournamentInput) {
        const result = await getTournamentBracket(
          tournamentInput,
          requestedGame,
          { page }
        );

        data = result.data;
        warnings = result.warnings;
      } else {
        const result = await collectBracketsByGame(games, { perPage, page });
        data = result.data;
        warnings = result.warnings;
      }
    }

    if (view === "standings") {
      if (tournamentInput) {
        const table = await getTournamentStandings(
          tournamentInput,
          requestedGame
        );

        data = table.rows.length > 0 ? [table] : [];
      } else if (requestedGame === "all") {
        return json(
          {
            error:
              "Standings need a specific game or a tournament. Use ?game=<game> or ?tournament=<id or slug>.",
            supportedGames: Object.keys(GAME_SLUGS),
          },
          400
        );
      } else {
        const result = await getRunningStandings(games);
        data = result.data;
        warnings = result.warnings;

        if (data.length === 0 && warnings.length === 0) {
          notice =
            result.runningCount === 0
              ? "No tournaments are running for this game right now."
              : "Standings are not published yet for the running tournaments.";
        }
      }
    }

    /*
     * If every request failed, return an error with the right status
     * (429 for rate limits, 502/503/504 for upstream problems) rather
     * than presenting an empty array as real data.
     *
     * When some requests succeeded, return their results and expose
     * the failures through warnings.
     */
    if (warnings.length > 0 && data.length === 0) {
      const failure = warnings.find((item) => !item.fallback) || warnings[0];
      const status = failure.status || 502;
      const retryAfter =
        Math.max(0, ...warnings.map((item) => item.retryAfter || 0)) || null;

      return json(
        {
          error: "Esports data could not be loaded.",
          provider: "PandaScore",
          message: failure.message,
          providerStatus: failure.providerStatus,
          retryAfter,
          warnings,
          game: requestedGame,
          view,
        },
        status,
        status === 429 && retryAfter
          ? { "Retry-After": String(retryAfter) }
          : {}
      );
    }

    return json(
      buildEnvelope({
        requestedGame,
        view,
        data,
        warnings,
        page,
        perPage,
        since,
        types: requestedTypes,
        sort,
        meta,
        notice,
      })
    );
  } catch (error) {
    console.error("[api/gaming/esports]", {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      providerStatus: error?.providerStatus,
    });

    const status = error?.status || 502;
    const retryAfter = retryAfterSeconds(error);

    return json(
      {
        error: error?.message || "Unable to load esports data.",
        provider: "PandaScore",
        providerStatus: error?.providerStatus ?? null,
        retryAfter,
      },
      status,
      status === 429 && retryAfter
        ? { "Retry-After": String(retryAfter) }
        : {}
    );
  }
}
