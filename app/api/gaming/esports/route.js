
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANDASCORE_API = "https://api.pandascore.co";

const GAME_SLUGS = {
  valorant: "valorant",
  "counter-strike-2": "cs-go",
  "league-of-legends": "lol",
  "dota-2": "dota-2",
  "rocket-league": "rl",
  "overwatch-2": "overwatch",
  "rainbow-six-siege": "r6siege",
  fortnite: "fortnite",
  "call-of-duty": "cod-mw",
  "apex-legends": "apex",
  pubg: "pubg",
  "mobile-legends": "mobile-legends",
};

const ALLOWED_VIEWS = new Set([
  "matches",
  "tournaments",
  "brackets",
  "teams",
  "standings",
]);

const CACHE_SECONDS = 60;

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
  const entry = Object.entries(GAME_SLUGS).find(
    ([, value]) => value === slug
  );

  return entry
    ? entry[0]
        .split("-")
        .map((word) => word.toUpperCase())
        .join(" ")
    : slug || "Esports";
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

  const url = new URL(`${PANDASCORE_API}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: {
      revalidate: CACHE_SECONDS,
    },
  });

  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? "The esports provider rejected the API token or access."
        : response.status === 429
          ? "The esports provider rate limit was reached. Try again later."
          : `Esports provider request failed (${response.status}).`
    );

    error.status =
      response.status === 429 ? 503 : response.status === 404 ? 502 : 502;

    throw error;
  }

  return response.json();
}

function mapMatch(match, selectedGame) {
  const opponents = toArray(match.opponents);

  const mapOpponent = (entry) => {
    const opponent = entry?.opponent || {};

    return {
      id: opponent.id ? String(opponent.id) : null,
      name: opponent.name || "TBA",
      logo: opponent.image_url || null,
      score: safeNumber(entry?.score),
    };
  };

  return {
    id: String(match.id),
    game: selectedGame,
    gameName: gameName(selectedGame),
    tournament:
      match.tournament?.name ||
      match.league?.name ||
      match.serie?.full_name ||
      "Tournament TBA",
    status: match.status || "not_started",
    startTime: match.begin_at || match.scheduled_at || null,
    date: match.begin_at || match.scheduled_at || null,
    bestOf: safeNumber(match.number_of_games),
    round: match.match_type || match.name || null,
    url: match.official_stream_url || null,
    teams: [
      mapOpponent(opponents[0]),
      mapOpponent(opponents[1]),
    ],
    winnerId: match.winner_id ? String(match.winner_id) : null,
  };
}

function mapTournament(tournament, selectedGame) {
  return {
    id: String(tournament.id),
    game: selectedGame,
    gameName: gameName(selectedGame),
    name: tournament.name || tournament.slug || "Tournament",
    organizer: tournament.league?.name || tournament.serie?.full_name || null,
    status: tournament.status || "upcoming",
    startDate: tournament.begin_at || null,
    endDate: tournament.end_at || null,
    prizePool: tournament.prizepool || null,
    teamCount: safeNumber(tournament.teams?.length),
    image:
      tournament.league?.image_url ||
      tournament.serie?.image_url ||
      null,
    url: tournament.official_url || null,
  };
}

function mapTeam(team, selectedGame) {
  return {
    id: String(team.id),
    game: selectedGame,
    gameName: gameName(selectedGame),
    name: team.name || "Unknown team",
    acronym: team.acronym || null,
    logo: team.image_url || null,
    region: team.location || null,
    players: toArray(team.players).map((player) => ({
      id: player.id ? String(player.id) : null,
      name: player.name || player.slug || "Unknown player",
      role: player.role || null,
      position: player.role || null,
      nationality: player.nationality || null,
      active: player.active ?? null,
    })),
    url: team.slug
      ? `https://www.pandascore.co/teams/${encodeURIComponent(team.slug)}`
      : null,
  };
}

function buildBrackets(matches, selectedGame) {
  const tournaments = new Map();

  for (const match of matches) {
    const tournamentId = match.tournament?.id;

    if (!tournamentId) continue;

    if (!tournaments.has(tournamentId)) {
      tournaments.set(tournamentId, {
        id: String(tournamentId),
        name:
          match.tournament?.name ||
          match.league?.name ||
          "Tournament",
        format: "Tournament",
        status: match.status || "scheduled",
        url: match.tournament?.official_url || null,
        game: selectedGame,
        gameName: gameName(selectedGame),
        rounds: [],
      });
    }

    const bracket = tournaments.get(tournamentId);

    const roundName =
      match.serie?.full_name ||
      match.match_type ||
      match.name ||
      "Matches";

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedGame = (
      searchParams.get("game") || "all"
    ).toLowerCase();

    const view = (
      searchParams.get("view") || "matches"
    ).toLowerCase();

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

    const games =
      requestedGame === "all"
        ? Object.entries(GAME_SLUGS)
        : [[requestedGame, GAME_SLUGS[requestedGame]]];

    const results = await Promise.all(
      games.map(async ([gameId, providerSlug]) => {
        let items = [];

        if (view === "matches") {
          const [upcoming, past] = await Promise.all([
            getMatches(providerSlug),
            getMatches(providerSlug, true),
          ]);

          items = [...upcoming, ...past].map((match) =>
            mapMatch(match, gameId)
          );
        }

        if (view === "tournaments") {
          const tournaments = await getTournaments(providerSlug);

          items = tournaments.map((tournament) =>
            mapTournament(tournament, gameId)
          );
        }

        if (view === "brackets") {
          const [upcoming, past] = await Promise.all([
            getMatches(providerSlug),
            getMatches(providerSlug, true),
          ]);

          items = buildBrackets(
            [...upcoming, ...past],
            gameId
          );
        }

        if (view === "teams") {
          const teams = await getTeams(providerSlug);

          items = teams.map((team) => mapTeam(team, gameId));
        }

        if (view === "standings") {
          // Do not fabricate standings. The provider integration
          // must be extended with a supported standings source.
          items = [];
        }

        return items;
      })
    );

    const data = results.flat();

    return json({
      game: requestedGame,
      view,
      count: data.length,
      updatedAt: new Date().toISOString(),
      provider: "PandaScore",
      items: data,
      matches: view === "matches" ? data : [],
      tournaments: view === "tournaments" ? data : [],
      brackets: view === "brackets" ? data : [],
      teams: view === "teams" ? data : [],
      standings: view === "standings" ? data : [],
      notice:
        view === "standings"
          ? "Standings require a supported standings data source."
          : undefined,
    });
  } catch (error) {
    console.error("[gaming/esports]", error);

    return json(
      {
        error: error.message || "Unable to load esports data.",
      },
      error.status || 500
    );
  }
}
