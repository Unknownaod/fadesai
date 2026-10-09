import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANDASCORE_API = "https://api.pandascore.co";
const OPENDOTA_API = "https://api.opendota.com/api";

const CACHE_SECONDS = 60;
const MAX_PER_PAGE = 100; // PandaScore: per_page is 1-100
const DEFAULT_PER_PAGE = 50; // PandaScore default
const REQUEST_TIMEOUT_MS = 12000;

/* =========================================================
   GAMES

   Left side  = the game id your frontend sends (?game=...)
   Right side = the PandaScore videogame slug used for the
                `videogame` query parameter.

   PandaScore slugs (from the API's VideogameSlug enum):
   cod-mw, cs-go, dota-2, fifa, kog, league-of-legends,
   lol-wild-rift, ow, pubg, r6-siege, rl, starcraft-2,
   starcraft-brood-war, valorant, ...

   "overwatch" and "r6siege" were NOT valid slugs; they are
   "ow" and "r6-siege".
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

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        status === 200
          ? `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`
          : "no-store",
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

/* =========================================================
   SHARED PANDA SCORE REQUEST

   Authentication: Bearer token in the Authorization header,
   exactly as shown in the PandaScore API reference. The token
   is never placed in the URL, so it cannot leak into logs.

   Returns { data, meta } where meta carries pagination and
   rate-limit information from the response headers.
========================================================= */

async function pandaRequest(path, params = {}) {
  const token = process.env.PANDASCORE_API_TOKEN?.trim();

  if (!token) {
    const error = new Error(
      "PandaScore token is missing. Configure PANDASCORE_API_TOKEN on the server."
    );

    error.status = 503;
    throw error;
  }

  const url = buildPandaScoreUrl(path, params);

  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const error = new Error(
      cause?.name === "TimeoutError"
        ? "PandaScore request timed out."
        : "Could not connect to PandaScore."
    );

    error.status = 503;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let providerMessage = "";

    // PandaScore error bodies look like: { "error": "..." }
    try {
      const parsed = JSON.parse(body);

      providerMessage =
        (typeof parsed?.error === "string" && parsed.error) ||
        parsed?.message ||
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

    const status = response.status;

    const error = new Error(
      status === 401
        ? "PandaScore rejected the API token."
        : status === 403
          ? "PandaScore denied access. Check your subscription and endpoint permissions."
          : status === 404
            ? "PandaScore could not find the requested resource."
            : status === 429
              ? "PandaScore rate limit reached."
              : status === 400 || status === 422
                ? `PandaScore rejected the request parameters.${providerMessage ? ` ${providerMessage}` : ""}`
                : `PandaScore request failed (${status}).`
    );

    error.providerStatus = status;

    error.status =
      status === 400 || status === 422
        ? 400
        : status === 404
          ? 404
          : status === 429
            ? 503
            : 502;

    throw error;
  }

  let data;

  try {
    data = await response.json();
  } catch {
    const error = new Error(
      "PandaScore returned an invalid JSON response."
    );

    error.status = 502;
    throw error;
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
    throw new Error(
      `${provider} returned HTTP ${response.status}.`
    );
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
    official_stream_url: null,
    original_url: `https://www.opendota.com/matches/${match.match_id}`,
  }));
}

/* =========================================================
   ADDITIONS
   PandaScore GET /additions

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
       object: {
         id, name, slug, url, image_url, modified_at,
         videogame: { id, name, slug, current_version },
         series: [...]            (league objects)
         ...other fields depending on `type`
       }
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
    const rejected =
      error.providerStatus === 400 || error.providerStatus === 422;

    // One rejected slug should not break every other game: retry per
    // game and report the failures as warnings.
    if (games.length > 1 && rejected) {
      const results = await Promise.allSettled(
        games.map(async ([gameId, providerSlug]) => {
          const { data } = await pandaRequest("/additions", {
            ...baseParams,
            videogame: providerSlug,
          });

          return mapEntries(data, gameId);
        })
      );

      const data = [];
      const warnings = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          data.push(...result.value);
        } else {
          warnings.push({
            game: games[index][0],
            provider: "PandaScore",
            message: result.reason?.message || "Request failed.",
            providerStatus: result.reason?.providerStatus ?? null,
          });
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
 * PandaScore matches carry scores in `results: [{ team_id, score }]`,
 * not on the opponent entries. A match name looks like
 * "Grand final: Team A vs Team B", so the part before ":" is the round.
 */
function roundLabel(match) {
  const name = String(match.name || "");
  const prefix = name.includes(":") ? name.split(":")[0].trim() : "";

  return prefix || name || null;
}

function mapMatch(match, selectedGame) {
  const opponents = toArray(match.opponents);
  const results = toArray(match.results);

  const mapOpponent = (entry) => {
    const opponent = entry?.opponent || {};

    const result =
      opponent.id != null
        ? results.find(
            (item) => String(item?.team_id) === String(opponent.id)
          )
        : null;

    return {
      id: opponent.id != null ? String(opponent.id) : null,
      name: opponent.name || "TBA",
      logo: opponent.image_url || null,
      score: safeNumber(result?.score ?? entry?.score),
    };
  };

  const tournament = match.tournament || {};
  const league = match.league || {};
  const serie = match.serie || {};
  const providerGame = match.videogame?.slug || null;

  return {
    id: String(match.id),
    source: match._source || "PandaScore",
    game: selectedGame,
    gameSlug: providerGame || GAME_SLUGS[selectedGame] || null,
    gameName:
      match.videogame?.name ||
      gameName(providerGame || GAME_SLUGS[selectedGame] || selectedGame),
    tournament:
      tournament.name ||
      league.name ||
      serie.full_name ||
      "Tournament TBA",
    tournamentId: tournament.id ?? null,
    status: match.status || "not_started",
    startTime: match.begin_at || match.scheduled_at || null,
    date: match.begin_at || match.scheduled_at || null,
    bestOf: safeNumber(match.number_of_games),
    round: roundLabel(match),
    url: match.official_stream_url || match.original_url || null,
    teams: [
      mapOpponent(opponents[0]),
      mapOpponent(opponents[1]),
    ],
    winnerId:
      match.winner_id != null ? String(match.winner_id) : null,
    results,
  };
}

function mapTournament(tournament, selectedGame) {
  return {
    id: String(tournament.id),
    source: "PandaScore",
    game: selectedGame,
    gameName:
      tournament.videogame?.name || gameName(GAME_SLUGS[selectedGame]),
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
    format: tournament.tournament_type || null,
    url: tournament.official_url || tournament.url || null,
  };
}

function mapTeam(team, selectedGame) {
  return {
    id: String(team.id),
    source: "PandaScore",
    game: selectedGame,
    gameName:
      team.videogame?.name || gameName(GAME_SLUGS[selectedGame]),
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
    url: team.slug
      ? `https://www.pandascore.co/teams/${encodeURIComponent(team.slug)}`
      : null,
  };
}

/*
 * This is an approximate match grouping, not an official bracket tree.
 */
function buildBrackets(matches, selectedGame) {
  const tournaments = new Map();

  for (const match of matches) {
    const tournament = match.tournament || {};
    const tournamentId = tournament.id;

    if (tournamentId == null) continue;

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
        game: selectedGame,
        gameName: gameName(GAME_SLUGS[selectedGame]),
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

async function getMatches(providerSlug, past = false) {
  const path = past ? "/matches/past" : "/matches/upcoming";

  try {
    return toArray(
      await pandaFetch(path, {
        "filter[videogame]": providerSlug,
        sort: past ? "-begin_at" : "begin_at",
        per_page: 50,
      })
    );
  } catch (error) {
    // Only use OpenDota for historical professional Dota 2 matches.
    if (providerSlug === "dota-2" && past) {
      try {
        console.warn(
          "[Esports] Falling back to OpenDota for historical Dota 2 matches."
        );

        return await getOpenDotaProMatches();
      } catch (backupError) {
        console.error(
          "[Esports] OpenDota fallback failed:",
          backupError.message
        );
      }
    }

    throw error;
  }
}

async function getTournaments(providerSlug) {
  return toArray(
    await pandaFetch("/tournaments", {
      "filter[videogame]": providerSlug,
      sort: "-begin_at",
      per_page: 50,
    })
  );
}

async function getTeams(providerSlug) {
  return toArray(
    await pandaFetch("/teams", {
      "filter[videogame]": providerSlug,
      sort: "name",
      per_page: 50,
    })
  );
}

/* =========================================================
   HELPERS FOR PARTIAL RESULTS

   A failure for one game does not discard successful results
   returned for other games.
========================================================= */

function getSelectedGames(requestedGame) {
  return requestedGame === "all"
    ? Object.entries(GAME_SLUGS)
    : [[requestedGame, GAME_SLUGS[requestedGame]]];
}

function toWarning(gameId, reason, extra = {}) {
  return {
    game: gameId,
    ...extra,
    provider: "PandaScore",
    message: reason?.message || "Request failed.",
    providerStatus: reason?.providerStatus ?? null,
  };
}

async function collectByGame(games, fetchGame, mapItems) {
  const results = await Promise.allSettled(
    games.map(async ([gameId, providerSlug]) => {
      const records = await fetchGame(providerSlug);
      return toArray(records).map((record) =>
        mapItems(record, gameId)
      );
    })
  );

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

/* Upcoming + past matches for one game, with per-request warnings. */
async function fetchGameMatches(gameId, providerSlug) {
  const matchResults = await Promise.allSettled([
    getMatches(providerSlug, false),
    getMatches(providerSlug, true),
  ]);

  const matches = [];
  const warnings = [];

  matchResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      matches.push(...result.value);
    } else {
      warnings.push(
        toWarning(gameId, result.reason, {
          view: index === 0 ? "upcoming" : "past",
        })
      );
    }
  });

  return { matches, warnings };
}

async function collectMatchesByGame(games) {
  const results = await Promise.allSettled(
    games.map(async ([gameId, providerSlug]) => {
      const { matches, warnings } = await fetchGameMatches(
        gameId,
        providerSlug
      );

      return {
        matches: matches.map((match) => mapMatch(match, gameId)),
        warnings,
      };
    })
  );

  const data = [];
  const warnings = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(...result.value.matches);
      warnings.push(...result.value.warnings);
      return;
    }

    warnings.push(toWarning(games[index][0], result.reason));
  });

  data.sort((a, b) => {
    const timeA = a.startTime
      ? new Date(a.startTime).getTime()
      : 0;

    const timeB = b.startTime
      ? new Date(b.startTime).getTime()
      : 0;

    return timeA - timeB;
  });

  return { data, warnings };
}

async function collectBracketsByGame(games) {
  const results = await Promise.allSettled(
    games.map(async ([gameId, providerSlug]) => {
      const { matches, warnings } = await fetchGameMatches(
        gameId,
        providerSlug
      );

      return {
        brackets: buildBrackets(matches, gameId),
        warnings,
      };
    })
  );

  const data = [];
  const warnings = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(...result.value.brackets);
      warnings.push(...result.value.warnings);
      return;
    }

    warnings.push(toWarning(games[index][0], result.reason));
  });

  return { data, warnings };
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
    rateLimitRemaining: meta?.rateLimitRemaining ?? undefined,
    updatedAt: new Date().toISOString(),
    partial: warnings.length > 0,
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
      (view === "standings"
        ? "Standings are not configured for this route yet."
        : view === "brackets"
          ? "Brackets are approximate groupings from match data, not official tournament bracket trees."
          : warnings.length > 0
            ? "Some data providers or games were unavailable. Check the warnings array for details."
            : undefined),
  };
}

/* =========================================================
   GET ROUTE
========================================================= */

export async function GET(request) {
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

    if (!ALLOWED_VIEWS.has(view)) {
      return json(
        {
          error: "Invalid esports view.",
          allowedViews: [...ALLOWED_VIEWS],
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
      const result = await collectMatchesByGame(games);
      data = result.data;
      warnings = result.warnings;
    }

    if (view === "tournaments") {
      const result = await collectByGame(
        games,
        getTournaments,
        mapTournament
      );

      data = result.data;
      warnings = result.warnings;
    }

    if (view === "teams") {
      const result = await collectByGame(
        games,
        getTeams,
        mapTeam
      );

      data = result.data;
      warnings = result.warnings;
    }

    if (view === "brackets") {
      const result = await collectBracketsByGame(games);
      data = result.data;
      warnings = result.warnings;
    }

    if (view === "standings") {
      // Do not fabricate standings. Proper standings require
      // GET /tournaments/{id}/standings for a specific tournament.
      data = [];
    }

    /*
     * If every request failed for a data view, return an error
     * rather than presenting an empty array as real data.
     *
     * When some games succeeded, return their results and expose
     * the failed games through warnings.
     */
    if (
      view !== "standings" &&
      warnings.length > 0 &&
      data.length === 0
    ) {
      const firstWarning = warnings[0];

      return json(
        {
          error: "Esports data could not be loaded.",
          provider: "PandaScore",
          message: firstWarning.message,
          providerStatus: firstWarning.providerStatus,
          warnings,
          game: requestedGame,
          view,
        },
        503
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
      })
    );
  } catch (error) {
    console.error("[api/gaming/esports]", {
      message: error?.message,
      status: error?.status,
      providerStatus: error?.providerStatus,
    });

    return json(
      {
        error: error?.message || "Unable to load esports data.",
        provider: "PandaScore",
        providerStatus: error?.providerStatus ?? null,
      },
      error?.status || 502
    );
  }
}
