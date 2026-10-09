
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANDASCORE_API = "https://api.pandascore.co";
const OPENDOTA_API = "https://api.opendota.com/api";

const CACHE_SECONDS = 60;
const MAX_PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 12000;

const GAME_SLUGS = {
  valorant: "valorant",
  "counter-strike-2": "cs-go",
  "league-of-legends": "league-of-legends",
  "dota-2": "dota-2",
  "rocket-league": "rl",
  "overwatch-2": "overwatch",
  "rainbow-six-siege": "r6siege",
  fortnite: "fortnite",
  "call-of-duty": "cod-mw",
  "apex-legends": "apex",
  pubg: "pubg",
  "mobile-legends": "mlbb",
};

const GAME_NAMES = {
  valorant: "VALORANT",
  "cs-go": "Counter-Strike 2",
  "league-of-legends": "League of Legends",
  "dota-2": "Dota 2",
  rl: "Rocket League",
  overwatch: "Overwatch 2",
  r6siege: "Rainbow Six Siege",
  fortnite: "Fortnite",
  "cod-mw": "Call of Duty",
  apex: "Apex Legends",
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

const ADDITION_TYPES = new Set([
  "league",
  "match",
  "player",
  "serie",
  "team",
  "tournament",
]);

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
      value === ""
    ) {
      continue;
    }

    url.searchParams.set(
      key,
      Array.isArray(value) ? value.join(",") : String(value)
    );
  }

  return url;
}

/* =========================================================
   SHARED PANDA SCORE REQUEST
   Every PandaScore request passes through this function.

   Token is sent in the query string and Authorization header.
   Never log the complete URL because it contains the token.
========================================================= */

async function pandaFetch(path, params = {}) {
  const token = process.env.PANDASCORE_API_TOKEN?.trim();

  if (!token) {
    const error = new Error(
      "PandaScore token is missing. Configure PANDASCORE_API_TOKEN on the server."
    );

    error.status = 503;
    throw error;
  }

  const url = buildPandaScoreUrl(path, params);

  // PandaScore documents token authentication through token=...
  // Also send the Bearer authorization header.
  url.searchParams.set("token", token);

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

    try {
      const parsed = JSON.parse(body);

      providerMessage =
        parsed?.message ||
        parsed?.error ||
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

    const error = new Error(
      response.status === 401
        ? "PandaScore rejected the API token."
        : response.status === 403
          ? "PandaScore denied access. Check your subscription and endpoint permissions."
          : response.status === 429
            ? "PandaScore rate limit reached."
            : response.status === 400 || response.status === 422
              ? `PandaScore rejected the request parameters.${providerMessage ? ` ${providerMessage}` : ""}`
              : `PandaScore request failed (${response.status}).`
    );

    error.providerStatus = response.status;

    error.status =
      response.status === 400 || response.status === 422
        ? 400
        : response.status === 429
          ? 503
          : response.status === 401 || response.status === 403
            ? 502
            : 502;

    throw error;
  }

  try {
    return await response.json();
  } catch {
    const error = new Error(
      "PandaScore returned an invalid JSON response."
    );

    error.status = 502;
    throw error;
  }
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
========================================================= */

function mapAddition(entry, selectedGame) {
  const object = entry?.object || {};
  const videogame = object.videogame || {};
  const providerSlug = videogame.slug || null;

  const inferredGame = providerSlug
    ? gameIdFromSlug(providerSlug)
    : selectedGame;

  const type = entry?.type || "unknown";

  const name =
    object.name ||
    object.full_name ||
    object.slug ||
    `${type} #${entry?.id ?? object.id ?? "unknown"}`;

  const relatedNames = [
    object.league?.name,
    object.serie?.full_name,
    object.tournament?.name,
  ].filter(Boolean);

  return {
    id: `${type}-${entry?.id ?? object.id ?? name}`,
    providerId: safeNumber(entry?.id),
    objectId: safeNumber(object.id),
    type,
    changeType: entry?.change_type || "creation",
    title: name,
    name,
    description: object.description || object.short_name || null,
    game: inferredGame,
    gameSlug: providerSlug || GAME_SLUGS[inferredGame] || null,
    gameName:
      videogame.name ||
      gameName(providerSlug || GAME_SLUGS[inferredGame]),
    image:
      object.image_url ||
      object.logo_url ||
      object.league?.image_url ||
      object.serie?.image_url ||
      null,
    logo: object.image_url || object.logo_url || null,
    url:
      object.url ||
      object.official_url ||
      (object.slug
        ? `https://www.pandascore.co/${type === "team" ? "teams" : `${type}s`}/${encodeURIComponent(object.slug)}`
        : null),
    modifiedAt: entry?.modified_at || object.modified_at || null,
    createdAt: object.created_at || entry?.modified_at || null,
    beginAt: object.begin_at || null,
    endAt: object.end_at || null,
    status: normalizeStatus(object.status || entry?.change_type),
    league: object.league?.name || null,
    series: object.serie?.full_name || null,
    tournament: object.tournament?.name || null,
    relatedNames,
    region: object.location || null,
    acronym: object.acronym || null,
    slug: object.slug || null,
    raw: object,
  };
}

async function getAdditions({
  selectedGame,
  requestedTypes,
  since,
  perPage,
  page,
}) {
  const games =
    selectedGame === "all"
      ? Object.entries(GAME_SLUGS)
      : [[selectedGame, GAME_SLUGS[selectedGame]]];

  const results = await Promise.allSettled(
    games.map(async ([gameId, providerSlug]) => {
      const entries = await pandaFetch("/additions", {
        videogame: providerSlug,
        type: requestedTypes,
        sort: "-modified_at",
        per_page: perPage,
        page,
        since,
      });

      return toArray(entries).map((entry) =>
        mapAddition(entry, gameId)
      );
    })
  );

  const data = [];
  const warnings = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(...result.value);
    } else {
      const [gameId] = games[index];

      warnings.push({
        game: gameId,
        provider: "PandaScore",
        message: result.reason?.message || "Request failed.",
        providerStatus: result.reason?.providerStatus ?? null,
      });
    }
  });

  return { data, warnings };
}

/* =========================================================
   NORMALIZERS
========================================================= */

function mapMatch(match, selectedGame) {
  const opponents = toArray(match.opponents);

  const mapOpponent = (entry) => {
    const opponent = entry?.opponent || {};

    return {
      id: opponent.id != null ? String(opponent.id) : null,
      name: opponent.name || "TBA",
      logo: opponent.image_url || null,
      score: safeNumber(entry?.score),
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
    round: match.match_type || match.name || null,
    url: match.official_stream_url || match.original_url || null,
    teams: [
      mapOpponent(opponents[0]),
      mapOpponent(opponents[1]),
    ],
    winnerId:
      match.winner_id != null ? String(match.winner_id) : null,
    results: toArray(match.results),
  };
}

function mapTournament(tournament, selectedGame) {
  return {
    id: String(tournament.id),
    source: "PandaScore",
    game: selectedGame,
    gameName:
      tournament.videogame?.name || gameName(selectedGame),
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
    gameName: team.videogame?.name || gameName(selectedGame),
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
        gameName: gameName(selectedGame),
        rounds: [],
      });
    }

    const bracket = tournaments.get(tournamentId);
    const roundName =
      match.match_type || match.name || "Matches";

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

async function getMatches(selectedGame, past = false) {
  const path = past ? "/matches/past" : "/matches/upcoming";

  try {
    return toArray(
      await pandaFetch(path, {
        "filter[videogame]": selectedGame,
        sort: past ? "-begin_at" : "begin_at",
        per_page: 50,
      })
    );
  } catch (error) {
    // Only use OpenDota for historical professional Dota 2 matches.
    if (selectedGame === "dota-2" && past) {
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

async function getTournaments(selectedGame) {
  return toArray(
    await pandaFetch("/tournaments", {
      "filter[videogame]": selectedGame,
      sort: "-begin_at",
      per_page: 50,
    })
  );
}

async function getTeams(selectedGame) {
  return toArray(
    await pandaFetch("/teams", {
      "filter[videogame]": selectedGame,
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

    const [gameId] = games[index];

    warnings.push({
      game: gameId,
      provider: "PandaScore",
      message: result.reason?.message || "Request failed.",
      providerStatus: result.reason?.providerStatus ?? null,
    });
  });

  return { data, warnings };
}

async function collectMatchesByGame(games) {
  const results = await Promise.allSettled(
    games.map(async ([gameId, providerSlug]) => {
      const matchResults = await Promise.allSettled([
        getMatches(providerSlug, false),
        getMatches(providerSlug, true),
      ]);

      const matches = [];
      const failures = [];

      matchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          matches.push(...result.value);
        } else {
          failures.push({
            game: gameId,
            view: index === 0 ? "upcoming" : "past",
            provider: "PandaScore",
            message:
              result.reason?.message || "Request failed.",
            providerStatus:
              result.reason?.providerStatus ?? null,
          });
        }
      });

      return {
        matches: matches.map((match) => mapMatch(match, gameId)),
        warnings: failures,
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

    const [gameId] = games[index];

    warnings.push({
      game: gameId,
      provider: "PandaScore",
      message: result.reason?.message || "Request failed.",
      providerStatus: result.reason?.providerStatus ?? null,
    });
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

/* =========================================================
   GET ROUTE
========================================================= */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedGame = (
      searchParams.get("game") || "all"
    ).toLowerCase();

    const view = (
      searchParams.get("view") || "matches"
    ).toLowerCase();

    const page = Math.max(
      1,
      Math.min(
        10000,
        safeNumber(searchParams.get("page")) || 1
      )
    );

    const perPage = Math.max(
      1,
      Math.min(
        MAX_PER_PAGE,
        safeNumber(searchParams.get("per_page")) || 50
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

    if (
      requestedGame !== "all" &&
      !Object.hasOwn(GAME_SLUGS, requestedGame)
    ) {
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
    let requestedTypes = [];

    const games = getSelectedGames(requestedGame);

    if (view === "additions") {
      const typesParam = searchParams.get("type");

      requestedTypes = typesParam
        ? typesParam
            .split(",")
            .map((type) => type.trim().toLowerCase())
            .filter(Boolean)
        : [...ADDITION_TYPES];

      const invalidTypes = requestedTypes.filter(
        (type) => !ADDITION_TYPES.has(type)
      );

      if (invalidTypes.length) {
        return json(
          {
            error: "One or more addition types are invalid.",
            invalidTypes,
            allowedTypes: [...ADDITION_TYPES],
          },
          400
        );
      }

      if (requestedTypes.length === 0) {
        return json(
          {
            error: "Select at least one addition type.",
            allowedTypes: [...ADDITION_TYPES],
          },
          400
        );
      }

      const result = await getAdditions({
        selectedGame: requestedGame,
        requestedTypes,
        since,
        perPage,
        page,
      });

      data = result.data;
      warnings = result.warnings;
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
      const results = await Promise.allSettled(
        games.map(async ([gameId, providerSlug]) => {
          const matchResults = await Promise.allSettled([
            getMatches(providerSlug, false),
            getMatches(providerSlug, true),
          ]);

          const matches = [];
          const gameWarnings = [];

          matchResults.forEach((result, index) => {
            if (result.status === "fulfilled") {
              matches.push(...result.value);
            } else {
              gameWarnings.push({
                game: gameId,
                view: index === 0 ? "upcoming" : "past",
                provider: "PandaScore",
                message:
                  result.reason?.message || "Request failed.",
                providerStatus:
                  result.reason?.providerStatus ?? null,
              });
            }
          });

          return {
            brackets: buildBrackets(matches, gameId),
            warnings: gameWarnings,
          };
        })
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          data.push(...result.value.brackets);
          warnings.push(...result.value.warnings);
        } else {
          const [gameId] = games[index];

          warnings.push({
            game: gameId,
            provider: "PandaScore",
            message:
              result.reason?.message || "Request failed.",
            providerStatus:
              result.reason?.providerStatus ?? null,
          });
        }
      });
    }

    if (view === "standings") {
      // Do not fabricate standings. Proper standings require
      // a competition-specific standings endpoint.
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

    return json({
      provider: "PandaScore",
      game: requestedGame,
      view,
      count: data.length,
      page,
      perPage,
      since: view === "additions" ? since : undefined,
      types: view === "additions" ? requestedTypes : undefined,
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
        view === "standings"
          ? "Standings are not configured for this route yet."
          : view === "brackets"
            ? "Brackets are approximate groupings from match data, not official tournament bracket trees."
            : warnings.length > 0
              ? "Some data providers or games were unavailable. Check the warnings array for details."
              : undefined,
    });
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
