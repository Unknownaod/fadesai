
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANDASCORE_API = "https://api.pandascore.co";
const CACHE_SECONDS = 60;
const MAX_PER_PAGE = 100;

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
  const url = new URL(`${PANDASCORE_API}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(
      key,
      Array.isArray(value) ? value.join(",") : String(value)
    );
  }

  return url;
}

async function pandaFetch(path, params = {}) {
  const token = process.env.PANDASCORE_API_TOKEN;

  if (!token) {
    const error = new Error(
      "PANDASCORE_API_TOKEN is not configured."
    );
    error.status = 503;
    throw error;
  }

  const url = buildPandaScoreUrl(path, params);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let providerMessage = "";

    try {
      const body = await response.json();
      providerMessage =
        body?.message || body?.error || body?.errors?.[0]?.detail || "";
    } catch {
      // The provider did not return a JSON error body.
    }

    const error = new Error(
      response.status === 401 || response.status === 403
        ? "PandaScore rejected the API token or this endpoint is not included in your plan."
        : response.status === 429
          ? "PandaScore rate limit reached. Try again later."
          : response.status === 400 || response.status === 422
            ? `PandaScore rejected the request parameters.${providerMessage ? ` ${providerMessage}` : ""}`
            : `PandaScore request failed (${response.status}).`
    );

    error.status =
      response.status === 429
        ? 503
        : response.status === 401 || response.status === 403
          ? 502
          : response.status === 400 || response.status === 422
            ? 400
            : 502;

    throw error;
  }

  return response.json();
}

/* =========================================================
   ADDITIONS
   PandaScore GET /additions
========================================================= */

function mapAddition(entry, selectedGame) {
  const object = entry?.object || {};
  const videogame = object.videogame || {};
  const providerSlug = videogame.slug || null;

  const inferredGame =
    providerSlug
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
    description:
      object.description ||
      object.short_name ||
      null,
    game: inferredGame,
    gameSlug: providerSlug || GAME_SLUGS[inferredGame] || null,
    gameName:
      videogame.name ||
      gameName(providerSlug) ||
      gameName(inferredGame),
    image:
      object.image_url ||
      object.logo_url ||
      object.league?.image_url ||
      object.serie?.image_url ||
      null,
    logo:
      object.image_url ||
      object.logo_url ||
      null,
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
  const videogames =
    selectedGame === "all"
      ? Object.values(GAME_SLUGS)
      : [GAME_SLUGS[selectedGame]];

  const params = {
    videogame: videogames,
    type: requestedTypes,
    sort: "-modified_at",
    per_page: perPage,
    page,
    since,
  };

  const additions = toArray(await pandaFetch("/additions", params));

  return additions.map((entry) => mapAddition(entry, selectedGame));
}

/* =========================================================
   MATCHES
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
    game: selectedGame,
    gameSlug: providerGame || GAME_SLUGS[selectedGame] || null,
    gameName: match.videogame?.name || gameName(providerGame || selectedGame),
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
    winnerId: match.winner_id != null ? String(match.winner_id) : null,
    results: toArray(match.results),
  };
}

function mapTournament(tournament, selectedGame) {
  return {
    id: String(tournament.id),
    game: selectedGame,
    gameName: tournament.videogame?.name || gameName(selectedGame),
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
 * PandaScore's regular match endpoints do not guarantee a complete
 * official bracket tree. This creates a basic grouping from returned
 * matches; it is not presented as an official bracket structure.
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
        name: tournament.name || match.league?.name || "Tournament",
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
      match.match_type ||
      match.name ||
      "Matches";

    let round = bracket.rounds.find((item) => item.name === roundName);

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
   PANDA SCORE RESOURCE REQUESTS
========================================================= */

async function getMatches(selectedGame, past = false) {
  const path = past ? "/matches/past" : "/matches/upcoming";

  return toArray(
    await pandaFetch(path, {
      "filter[videogame]": selectedGame,
      sort: past ? "-begin_at" : "begin_at",
      per_page: 50,
    })
  );
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
      Math.min(10000, safeNumber(searchParams.get("page")) || 1)
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
          error: "Invalid since date. Supply a valid ISO 8601 date-time.",
          example: "2026-10-09T00:00:00Z",
        },
        400
      );
    }

    let data = [];
    let requestedTypes = [];

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

      data = await getAdditions({
        selectedGame: requestedGame,
        requestedTypes,
        since,
        perPage,
        page,
      });
    }

    if (view === "matches") {
      const games =
        requestedGame === "all"
          ? Object.entries(GAME_SLUGS)
          : [[requestedGame, GAME_SLUGS[requestedGame]]];

      const results = await Promise.all(
        games.map(async ([gameId, providerSlug]) => {
          const [upcoming, past] = await Promise.all([
            getMatches(providerSlug),
            getMatches(providerSlug, true),
          ]);

          return [...upcoming, ...past].map((match) =>
            mapMatch(match, gameId)
          );
        })
      );

      data = results
        .flat()
        .sort((a, b) => {
          const timeA = new Date(a.startTime || 0).getTime();
          const timeB = new Date(b.startTime || 0).getTime();
          return timeA - timeB;
        });
    }

    if (view === "tournaments") {
      const games =
        requestedGame === "all"
          ? Object.entries(GAME_SLUGS)
          : [[requestedGame, GAME_SLUGS[requestedGame]]];

      const results = await Promise.all(
        games.map(async ([gameId, providerSlug]) => {
          const tournaments = await getTournaments(providerSlug);
          return tournaments.map((tournament) =>
            mapTournament(tournament, gameId)
          );
        })
      );

      data = results.flat();
    }

    if (view === "brackets") {
      const games =
        requestedGame === "all"
          ? Object.entries(GAME_SLUGS)
          : [[requestedGame, GAME_SLUGS[requestedGame]]];

      const results = await Promise.all(
        games.map(async ([gameId, providerSlug]) => {
          const [upcoming, past] = await Promise.all([
            getMatches(providerSlug),
            getMatches(providerSlug, true),
          ]);

          return buildBrackets([...upcoming, ...past], gameId);
        })
      );

      data = results.flat();
    }

    if (view === "teams") {
      const games =
        requestedGame === "all"
          ? Object.entries(GAME_SLUGS)
          : [[requestedGame, GAME_SLUGS[requestedGame]]];

      const results = await Promise.all(
        games.map(async ([gameId, providerSlug]) => {
          const teams = await getTeams(providerSlug);
          return teams.map((team) => mapTeam(team, gameId));
        })
      );

      data = results.flat();
    }

    if (view === "standings") {
      /*
       * Do not invent standings. This route needs a standings source
       * appropriate to the competition and PandaScore plan.
       */
      data = [];
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

      // Generic result list for new views and integrations.
      items: data,

      // Keep the response properties expected by the existing UI.
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
            ? "Brackets are grouped from match data and may not represent the official tournament bracket."
            : undefined,
    });
  } catch (error) {
    console.error("[api/gaming/esports]", error);

    return json(
      {
        error: error.message || "Unable to load esports data.",
      },
      error.status || 500
    );
  }
}
