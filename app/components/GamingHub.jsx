
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_INFO = {
  gaming: {
    title: "Gaming Hub",
    subtitle: "Your home for gaming news, releases, updates, and esports.",
  },
  "gaming-news": {
    title: "Gaming News",
    subtitle: "The latest stories from across the gaming industry.",
  },
  "gaming-releases": {
    title: "New Releases",
    subtitle: "Discover upcoming games and recent launches.",
  },
  "gaming-esports": {
    title: "Esports",
    subtitle: "News, teams, rosters, tournaments, brackets, and competitive gaming.",
  },
  "gaming-updates": {
    title: "Game Updates",
    subtitle: "Patches, balance changes, announcements, and updates.",
  },
  "gaming-deals": {
    title: "Gaming Deals",
    subtitle: "Find reported sales and discounts from gaming publications.",
  },
  "gaming-pc": {
    title: "PC Gaming",
    subtitle: "PC games, releases, hardware, and gaming culture.",
  },
  "gaming-playstation": {
    title: "PlayStation",
    subtitle: "News and announcements related to PlayStation.",
  },
  "gaming-xbox": {
    title: "Xbox",
    subtitle: "News and announcements related to Xbox.",
  },
  "gaming-nintendo": {
    title: "Nintendo",
    subtitle: "News and announcements related to Nintendo.",
  },
};

/*
 * Game logos are loaded from Wikimedia Commons.
 * If a remote logo is missing or blocked, the game abbreviation
 * automatically appears instead.
 */
const ESPORTS_GAMES = [
  {
    id: "all",
    name: "All Games",
    short: "ALL",
    category: "All esports",
    logo: null,
  },
  {
    id: "valorant",
    name: "VALORANT",
    short: "VAL",
    category: "FPS",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Valorant_logo.svg",
  },
  {
    id: "counter-strike-2",
    name: "Counter-Strike 2",
    short: "CS2",
    category: "FPS",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Counter-Strike_2_logo.svg",
  },
  {
    id: "league-of-legends",
    name: "League of Legends",
    short: "LOL",
    category: "MOBA",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/League_of_Legends_logo.svg",
  },
  {
    id: "dota-2",
    name: "Dota 2",
    short: "DOTA",
    category: "MOBA",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Dota_2_logo.svg",
  },
  {
    id: "rocket-league",
    name: "Rocket League",
    short: "RL",
    category: "Sports",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Rocket_League_logo.svg",
  },
  {
    id: "overwatch-2",
    name: "Overwatch 2",
    short: "OW2",
    category: "FPS",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Overwatch_2_logo.svg",
  },
  {
    id: "rainbow-six-siege",
    name: "Rainbow Six Siege",
    short: "R6",
    category: "FPS",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Tom_Clancy%27s_Rainbow_Six_Siege_logo.svg",
  },
  {
    id: "fortnite",
    name: "Fortnite",
    short: "FN",
    category: "Battle Royale",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Fortnite_logo.svg",
  },
  {
    id: "call-of-duty",
    name: "Call of Duty",
    short: "COD",
    category: "FPS",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Call_of_Duty_logo.svg",
  },
  {
    id: "apex-legends",
    name: "Apex Legends",
    short: "APEX",
    category: "Battle Royale",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Apex_legends_logo.svg",
  },
  {
    id: "pubg",
    name: "PUBG",
    short: "PUBG",
    category: "Battle Royale",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/PUBG_logo.svg",
  },
  {
    id: "mobile-legends",
    name: "Mobile Legends",
    short: "MLBB",
    category: "MOBA",
    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Mobile_Legends_Bang_Bang_logo.svg",
  },
  {
    id: "rainbow-six-mobile",
    name: "Mobile Esports",
    short: "MOB",
    category: "Mobile",
    logo: null,
  },
];

const ESPORTS_VIEWS = [
  { id: "news", label: "News" },
  { id: "matches", label: "Matches" },
  { id: "tournaments", label: "Tournaments" },
  { id: "brackets", label: "Brackets" },
  { id: "teams", label: "Teams & Rosters" },
  { id: "standings", label: "Standings" },
];

const EMPTY_ESPORTS = {
  matches: [],
  tournaments: [],
  brackets: [],
  teams: [],
  standings: [],
};

const GAME_ALIASES = {
  valorant: ["valorant", "vct"],
  "counter-strike-2": [
    "counter-strike",
    "counter strike",
    "counter-strike 2",
    "cs2",
    "cs:go",
  ],
  "league-of-legends": [
    "league of legends",
    "lol",
    "lck",
    "lcs",
    "lec",
    "lpl",
  ],
  "dota-2": ["dota 2", "dota"],
  "rocket-league": ["rocket league"],
  "overwatch-2": ["overwatch 2", "overwatch", "owcs"],
  "rainbow-six-siege": [
    "rainbow six",
    "rainbow six siege",
    "r6 siege",
  ],
  fortnite: ["fortnite"],
  "call-of-duty": [
    "call of duty",
    "cod esports",
    "call of duty league",
  ],
  "apex-legends": ["apex legends", "algs"],
  pubg: ["pubg", "pubg esports"],
  "mobile-legends": ["mobile legends", "mlbb"],
  "rainbow-six-mobile": ["mobile esports", "rainbow six mobile"],
};

const VIEW_INFO = {
  matches: {
    title: "Matches & Results",
    description:
      "Upcoming match schedules, live series, scores, and completed results.",
    emptyTitle: "No matches available",
    emptyDescription:
      "Matches will appear here when the connected esports data provider has information for this game.",
  },
  tournaments: {
    title: "Tournaments",
    description:
      "Discover competitions, leagues, prize pools, and event schedules.",
    emptyTitle: "No tournaments available",
    emptyDescription:
      "Tournament listings will appear here when data is available.",
  },
  brackets: {
    title: "Tournament Brackets",
    description:
      "Follow tournament rounds, elimination matches, and championship paths.",
    emptyTitle: "No brackets available",
    emptyDescription:
      "Available tournament brackets will appear here when the data source provides bracket information.",
  },
  teams: {
    title: "Teams & Rosters",
    description:
      "Explore competitive teams, player lineups, regions, and roster information.",
    emptyTitle: "No teams available",
    emptyDescription:
      "Team profiles and player rosters will appear here when the data source provides them.",
  },
  standings: {
    title: "Standings & Rankings",
    description:
      "Track league tables, tournament standings, wins, losses, and points.",
    emptyTitle: "No standings available",
    emptyDescription:
      "League standings will appear here when the connected provider supplies rankings.",
  },
};

function formatDate(value) {
  if (!value) return "Date TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Time TBA";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayValue(value, fallback = "TBA") {
  return value === undefined || value === null || value === ""
    ? fallback
    : value;
}

function normalizeStatus(value) {
  return String(value || "upcoming")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTeam(match, index) {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const team = teams[index];

  if (team) return team;

  if (index === 0) {
    return {
      name: match.team1 || match.homeTeam || "Team TBA",
      logo: match.team1Logo || match.homeLogo,
      score: match.score1 ?? match.homeScore,
    };
  }

  return {
    name: match.team2 || match.awayTeam || "Team TBA",
    logo: match.team2Logo || match.awayLogo,
    score: match.score2 ?? match.awayScore,
  };
}

function ExternalLink({
  href,
  children,
  className = "",
  ...props
}) {
  if (!href) {
    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="esports-empty">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function SectionHeading({ title, description, count }) {
  return (
    <div className="esports-content-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {Number.isFinite(count) && (
        <span className="esports-count">{count} items</span>
      )}
    </div>
  );
}

function EsportsGameLogo({ game }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [game.logo]);

  return (
    <span className="esports-game-icon">
      {game.logo && !failed ? (
        <img
          src={game.logo}
          alt={`${game.name} logo`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="esports-game-fallback">
          {game.short}
        </span>
      )}
    </span>
  );
}

function TeamLogo({ src, name, className = "esports-team-logo" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span className={className}>
      {src && !failed ? (
        <img
          src={src}
          alt={name ? `${name} logo` : ""}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>
          {(name || "?").trim().slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function MatchCard({ match }) {
  const teamA = getTeam(match, 0);
  const teamB = getTeam(match, 1);
  const status = normalizeStatus(match.status);

  return (
    <article className="esports-match-card" key={match.id}>
      <div className="esports-match-top">
        <span className="esports-match-league">
          {displayValue(
            match.tournament || match.event || match.league,
            match.gameName || match.game || "Esports"
          )}
        </span>

        <span
          className={`esports-status esports-status-${status}`}
        >
          {displayValue(match.status, "Upcoming")}
        </span>
      </div>

      <div className="esports-match-teams">
        <div className="esports-match-team">
          <TeamLogo src={teamA.logo} name={teamA.name} />
          <span className="esports-match-team-name">
            {displayValue(teamA.name, "Team TBA")}
          </span>
        </div>

        <div className="esports-match-score">
          <span>{teamA.score ?? "—"}</span>
          <span className="esports-match-score-separator">:</span>
          <span>{teamB.score ?? "—"}</span>
        </div>

        <div className="esports-match-team">
          <TeamLogo src={teamB.logo} name={teamB.name} />
          <span className="esports-match-team-name">
            {displayValue(teamB.name, "Team TBA")}
          </span>
        </div>
      </div>

      <div className="esports-match-bottom">
        <span>{formatDateTime(match.startTime || match.date)}</span>
        {match.bestOf && <span>BO{match.bestOf}</span>}
        {match.round && <span>{match.round}</span>}
      </div>

      {match.url && (
        <ExternalLink
          href={match.url}
          className="esports-news-link"
        >
          View match ↗
        </ExternalLink>
      )}
    </article>
  );
}

function TournamentCard({ tournament }) {
  const status = normalizeStatus(tournament.status);

  return (
    <article className="esports-tournament-card" key={tournament.id}>
      <div className="esports-tournament-image">
        {tournament.image ? (
          <img
            src={tournament.image}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="esports-tournament-image-placeholder">
            {tournament.gameName || tournament.game || "ESPORTS"}
          </span>
        )}
      </div>

      <div className="esports-tournament-content">
        <div className="esports-card-header">
          <span className="esports-badge">
            {tournament.gameName || tournament.game || "Esports"}
          </span>

          <span className={`esports-status esports-status-${status}`}>
            {displayValue(tournament.status, "Upcoming")}
          </span>
        </div>

        <h3 className="esports-tournament-name">
          {displayValue(tournament.name, "Unnamed tournament")}
        </h3>

        <p className="esports-tournament-description">
          {displayValue(tournament.organizer, "Organizer TBA")}
        </p>

        <div className="esports-tournament-meta">
          <div>
            <span className="esports-meta-label">Starts</span>
            <span className="esports-meta-value">
              {formatDate(tournament.startDate)}
            </span>
          </div>

          <div>
            <span className="esports-meta-label">Prize pool</span>
            <span className="esports-meta-value">
              {displayValue(tournament.prizePool, "Not announced")}
            </span>
          </div>

          <div>
            <span className="esports-meta-label">Teams</span>
            <span className="esports-meta-value">
              {displayValue(tournament.teamCount, "TBA")}
            </span>
          </div>

          <div>
            <span className="esports-meta-label">Format</span>
            <span className="esports-meta-value">
              {displayValue(tournament.format, "TBA")}
            </span>
          </div>
        </div>

        <ExternalLink
          href={tournament.url}
          className="esports-news-link"
        >
          Tournament details ↗
        </ExternalLink>
      </div>
    </article>
  );
}

function TeamCard({ team }) {
  const players = team.players || team.roster || [];

  return (
    <article className="esports-team-card" key={team.id}>
      <div className="esports-team-card-header">
        <TeamLogo
          src={team.logo}
          name={team.name}
          className="esports-team-logo"
        />

        <div className="esports-team-card-info">
          <h3>{displayValue(team.name, "Unknown team")}</h3>
          <p>{displayValue(team.region, "Region TBA")}</p>
        </div>

        {team.rank != null && (
          <span className="esports-badge">#{team.rank}</span>
        )}
      </div>

      <div className="esports-team-stats">
        {[
          ["Wins", team.wins],
          ["Losses", team.losses],
          ["Players", players.length || null],
        ].map(([label, value]) =>
          value != null ? (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ) : null
        )}
      </div>

      <div className="esports-roster">
        <div className="esports-card-header">
          <h4>Roster</h4>
          <span className="esports-meta-label">
            {players.length} players
          </span>
        </div>

        {players.length ? (
          players.map((player, index) => {
            const item =
              typeof player === "string"
                ? { name: player }
                : player;

            return (
              <div
                className="esports-roster-player"
                key={item.id || `${item.name}-${index}`}
              >
                <span className="esports-player-avatar">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    (item.name || "?").slice(0, 1).toUpperCase()
                  )}
                </span>

                <span className="esports-player-info">
                  <span className="esports-player-name">
                    {displayValue(item.name, "Unknown player")}
                  </span>
                  <span className="esports-player-role">
                    {displayValue(item.role || item.position, "Player")}
                  </span>
                </span>

                {item.country && (
                  <span className="esports-meta-label">
                    {item.country}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p className="esports-muted">
            No roster data available yet.
          </p>
        )}
      </div>

      {team.url && (
        <ExternalLink
          href={team.url}
          className="esports-news-link"
        >
          View team ↗
        </ExternalLink>
      )}
    </article>
  );
}

function StandingsTable({ standings }) {
  if (!standings.length) {
    return (
      <EmptyState
        title="No standings available"
        description="Standings will appear when league or tournament ranking data is available."
      />
    );
  }

  return (
    <div className="esports-standings-wrap">
      <table className="esports-standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Played</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Points</th>
          </tr>
        </thead>

        <tbody>
          {standings.map((row, index) => (
            <tr key={row.id || row.teamId || row.team || index}>
              <td className="esports-rank">
                {row.rank ?? index + 1}
              </td>

              <td>
                <div className="esports-standings-team">
                  <TeamLogo
                    src={row.logo}
                    name={row.teamName || row.team || row.name}
                    className="esports-standings-logo"
                  />
                  <span>
                    {displayValue(
                      row.teamName || row.team || row.name
                    )}
                  </span>
                </div>
              </td>

              <td>{row.played ?? row.matchesPlayed ?? "—"}</td>
              <td>{row.wins ?? "—"}</td>
              <td>{row.losses ?? "—"}</td>
              <td>{row.points ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BracketMatch({ match }) {
  const first = getTeam(match, 0);
  const second = getTeam(match, 1);

  const firstWon =
    match.winnerId != null &&
    String(match.winnerId) === String(first.id);

  const secondWon =
    match.winnerId != null &&
    String(match.winnerId) === String(second.id);

  return (
    <div className="esports-bracket-match">
      <div className="esports-card-header">
        <span className="esports-meta-label">
          {displayValue(match.label || match.round, "Match")}
        </span>
        <span className="esports-meta-label">
          {displayValue(match.status, "")}
        </span>
      </div>

      {[{ team: first, won: firstWon }, { team: second, won: secondWon }].map(
        ({ team, won }, index) => (
          <div
            key={team.id || team.name || index}
            className={`esports-bracket-team ${
              won ? "winner" : ""
            }`}
            data-winner={won ? "true" : "false"}
          >
            <span className="esports-bracket-team-name">
              {displayValue(team.name, "TBD")}
            </span>
            <span className="esports-bracket-score">
              {team.score ?? "—"}
            </span>
          </div>
        )
      )}

      {match.url && (
        <div className="esports-card-footer">
          <ExternalLink
            href={match.url}
            className="esports-news-link"
          >
            Match details ↗
          </ExternalLink>
        </div>
      )}
    </div>
  );
}

function BracketView({ brackets }) {
  if (!brackets.length) {
    return (
      <EmptyState
        title="No brackets available"
        description="Tournament rounds and matchups will appear here when the provider supplies bracket data."
      />
    );
  }

  return (
    <div className="esports-bracket-layout">
      {brackets.map((bracket, index) => {
        const rounds = bracket.rounds || [];

        return (
          <section
            className="esports-bracket-tournament"
            key={bracket.id || index}
          >
            <div className="esports-content-header">
              <div>
                <h2>{displayValue(bracket.name, "Tournament bracket")}</h2>
                <p>
                  {displayValue(bracket.format, "Tournament")}
                  {" · "}
                  {displayValue(bracket.status, "Status TBA")}
                </p>
              </div>

              {bracket.url && (
                <ExternalLink
                  href={bracket.url}
                  className="esports-news-link"
                >
                  Full bracket ↗
                </ExternalLink>
              )}
            </div>

            {rounds.length ? (
              <div className="esports-bracket-container">
                <div className="esports-bracket">
                  {rounds.map((round, roundIndex) => (
                    <div
                      className="esports-bracket-round"
                      key={round.id || round.name || roundIndex}
                    >
                      <h3 className="esports-bracket-round-title">
                        {displayValue(
                          round.name,
                          `Round ${roundIndex + 1}`
                        )}
                      </h3>

                      {(round.matches || []).map((match, matchIndex) => (
                        <BracketMatch
                          key={match.id || matchIndex}
                          match={match}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Rounds not available"
                description="The current data response does not include rounds for this tournament."
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function EsportsDashboard({
  articles,
  loading,
  error,
  onRetry,
  onSearch,
  search,
  setSearch,
  lastUpdated,
}) {
  const [selectedGame, setSelectedGame] = useState("all");
  const [activeView, setActiveView] = useState("news");
  const [esportsData, setEsportsData] = useState(EMPTY_ESPORTS);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedGameInfo =
    ESPORTS_GAMES.find((game) => game.id === selectedGame) ||
    ESPORTS_GAMES[0];

  const loadEsportsData = useCallback(
    async () => {
      if (activeView === "news") return;

      setDataLoading(true);
      setDataError("");

      try {
        const params = new URLSearchParams({
          game: selectedGame,
          view: activeView,
        });

        const response = await fetch(
          `/api/gaming/esports?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "The /api/gaming/esports endpoint was not found."
              : `Esports request failed (${response.status}).`
          );
        }

        const data = await response.json();

        setEsportsData({
          matches: Array.isArray(data.matches) ? data.matches : [],
          tournaments: Array.isArray(data.tournaments)
            ? data.tournaments
            : [],
          brackets: Array.isArray(data.brackets) ? data.brackets : [],
          teams: Array.isArray(data.teams) ? data.teams : [],
          standings: Array.isArray(data.standings)
            ? data.standings
            : [],
        });
      } catch (err) {
        setDataError(
          err.message || "Couldn't load esports data."
        );
        setEsportsData(EMPTY_ESPORTS);
      } finally {
        setDataLoading(false);
      }
    },
    [activeView, selectedGame, refreshKey]
  );

  useEffect(() => {
    loadEsportsData();
  }, [loadEsportsData]);

  const visibleArticles = useMemo(() => {
    if (selectedGame === "all") return articles;

    const terms = GAME_ALIASES[selectedGame] || [selectedGame];

    return articles.filter((article) => {
      const text = [
        article.title,
        article.description,
        article.source,
        article.game,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return terms.some((term) => text.includes(term));
    });
  }, [articles, selectedGame]);

  const currentItems = esportsData[activeView] || [];
  const currentViewInfo = VIEW_INFO[activeView];

  return (
    <div className="esports-dashboard">
      <section className="esports-header">
        <div className="esports-header-content">
          <div className="esports-eyebrow">
            THE COMPETITIVE SCENE
          </div>

          <h1 className="esports-title">
            Esports <span>Central.</span>
          </h1>

          <p className="esports-subtitle">
            Follow your favorite games, track tournaments, discover
            teams, explore rosters, and keep up with the competitive scene.
          </p>

          <div className="esports-header-actions">
            <button
              type="button"
              className="esports-button esports-button-primary"
              onClick={() => setActiveView("matches")}
            >
              Explore matches ↗
            </button>

            <button
              type="button"
              className="esports-button"
              onClick={() => setActiveView("tournaments")}
            >
              View tournaments
            </button>

            <button
              type="button"
              className="esports-refresh"
              onClick={() => {
                if (activeView === "news") {
                  onRetry();
                } else {
                  setRefreshKey((value) => value + 1);
                }
              }}
              disabled={activeView === "news" ? loading : dataLoading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="esports-game-section">
        <div className="esports-section-heading">
          <div>
            <h2>Choose your game</h2>
            <p>Browse competitive news and data by title.</p>
          </div>

          <span className="esports-count">
            {ESPORTS_GAMES.length - 1} games
          </span>
        </div>

        <div className="esports-game-selector">
          {ESPORTS_GAMES.map((game) => (
            <button
              type="button"
              key={game.id}
              className={`esports-game-option ${
                selectedGame === game.id ? "active" : ""
              }`}
              onClick={() => setSelectedGame(game.id)}
              aria-pressed={selectedGame === game.id}
            >
              <EsportsGameLogo game={game} />

              <span className="esports-game-option-text">
                <strong>{game.name}</strong>
                <small>{game.category}</small>
              </span>

              {selectedGame === game.id && (
                <span className="esports-game-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <nav className="esports-tabs" aria-label="Esports sections">
        {ESPORTS_VIEWS.map((view) => (
          <button
            type="button"
            key={view.id}
            className={`esports-tab ${
              activeView === view.id ? "active" : ""
            }`}
            onClick={() => setActiveView(view.id)}
            aria-pressed={activeView === view.id}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === "news" ? (
        <section className="esports-content">
          <SectionHeading
            title={
              selectedGame === "all"
                ? "Latest Esports News"
                : `${selectedGameInfo.name} News`
            }
            description={
              selectedGame === "all"
                ? "Stories and reporting from across competitive gaming."
                : `Competitive news and reporting for ${selectedGameInfo.name}.`
            }
            count={visibleArticles.length}
          />

          <form
            className="esports-search"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch(search);
            }}
          >
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search esports news..."
              aria-label="Search esports news"
            />
            <button
              type="submit"
              className="esports-button esports-button-primary"
            >
              Search
            </button>
          </form>

          {error && (
            <div className="esports-error">
              <h3>Couldn't load esports news</h3>
              <p>{error}</p>
              <button
                type="button"
                className="esports-button"
                onClick={onRetry}
              >
                Try again
              </button>
            </div>
          )}

          {loading && visibleArticles.length === 0 && !error && (
            <div className="esports-loading">
              <div className="esports-spinner" />
              <h3>Loading esports news</h3>
              <p>Checking gaming news feeds…</p>
            </div>
          )}

          {!loading && !error && visibleArticles.length === 0 && (
            <EmptyState
              title="No esports stories found"
              description="Try another game or search term, or refresh the news feed."
            />
          )}

          {visibleArticles.length > 0 && (
            <div className="esports-news-grid">
              {visibleArticles.map((article) => (
                <article
                  className="esports-news-card"
                  key={article.id || article.url || article.title}
                >
                  <ExternalLink
                    href={article.url}
                    className="esports-news-image"
                    aria-label={`Read ${article.title}`}
                  >
                    {article.image ? (
                      <img
                        src={article.image}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span className="esports-news-placeholder">
                        ESPORTS
                      </span>
                    )}
                  </ExternalLink>

                  <div className="esports-news-content">
                    <div className="esports-news-meta">
                      <span>
                        {article.source || "Esports source"}
                      </span>
                      {article.publishedAt && (
                        <time dateTime={article.publishedAt}>
                          {formatDate(article.publishedAt)}
                        </time>
                      )}
                    </div>

                    <h3>{article.title}</h3>

                    {article.description && (
                      <p>{article.description}</p>
                    )}

                    <ExternalLink
                      href={article.url}
                      className="esports-news-link"
                    >
                      Read original story ↗
                    </ExternalLink>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="esports-content">
          <SectionHeading
            title={currentViewInfo.title}
            description={currentViewInfo.description}
            count={currentItems.length}
          />

          {dataLoading && (
            <div className="esports-loading">
              <div className="esports-spinner" />
              <h3>Loading {activeView}</h3>
              <p>
                Getting {selectedGameInfo.name} competitive data…
              </p>
            </div>
          )}

          {dataError && !dataLoading && (
            <div className="esports-error">
              <h3>Esports data unavailable</h3>
              <p>{dataError}</p>
              <p>
                Check that your esports API route is configured and
                that its data provider has access to this game and view.
              </p>
              <button
                type="button"
                className="esports-button"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!dataLoading && !dataError && currentItems.length === 0 && (
            <EmptyState
              title={currentViewInfo.emptyTitle}
              description={currentViewInfo.emptyDescription}
            />
          )}

          {!dataLoading && !dataError && currentItems.length > 0 && (
            <>
              {activeView === "matches" && (
                <div className="esports-match-grid">
                  {currentItems.map((match, index) => (
                    <MatchCard
                      key={match.id || index}
                      match={match}
                    />
                  ))}
                </div>
              )}

              {activeView === "tournaments" && (
                <div className="esports-tournament-grid">
                  {currentItems.map((tournament, index) => (
                    <TournamentCard
                      key={tournament.id || index}
                      tournament={tournament}
                    />
                  ))}
                </div>
              )}

              {activeView === "brackets" && (
                <BracketView brackets={currentItems} />
              )}

              {activeView === "teams" && (
                <div className="esports-team-grid">
                  {currentItems.map((team, index) => (
                    <TeamCard
                      key={team.id || index}
                      team={team}
                    />
                  ))}
                </div>
              )}

              {activeView === "standings" && (
                <StandingsTable standings={currentItems} />
              )}
            </>
          )}
        </section>
      )}

      <footer className="gaming-source-footer">
        {lastUpdated && (
          <>News updated {lastUpdated.toLocaleTimeString()} · </>
        )}
        {selectedGameInfo.name} · Fades Gaming Esports.
        {" "}Scores, rosters, brackets, and schedules depend on the
        availability of connected data providers.
      </footer>
    </div>
  );
}

export default function GamingHub({ page = "gaming" }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  const info = PAGE_INFO[page] || PAGE_INFO.gaming;
  const isEsports = page === "gaming-esports";

  const loadNews = useCallback(
    async (searchTerm = "") => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ topic: page });

        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }

        const response = await fetch(
          `/api/gaming/news?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`News request failed (${response.status})`);
        }

        const data = await response.json();

        setArticles(
          Array.isArray(data.articles) ? data.articles : []
        );
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || "Couldn't load gaming news.");
      } finally {
        setLoading(false);
      }
    },
    [page]
  );

  useEffect(() => {
    setSearch("");
    loadNews("");
  }, [loadNews]);

  const showEmpty = !loading && !error && articles.length === 0;
  const showLoading = loading && articles.length === 0;

  if (isEsports) {
    return (
      <main className="gaming-hub">
        <header className="gaming-hub-header">
          <div className="gaming-hub-heading">
            <h1>{info.title}</h1>
            <p>{info.subtitle}</p>
          </div>
        </header>

        <EsportsDashboard
          articles={articles}
          loading={loading}
          error={error}
          onRetry={() => loadNews(search)}
          onSearch={loadNews}
          search={search}
          setSearch={setSearch}
          lastUpdated={lastUpdated}
        />
      </main>
    );
  }

  return (
    <main className="gaming-hub">
      <header className="gaming-hub-header">
        <div className="gaming-hub-heading">
          <h1>{info.title}</h1>
          <p>{info.subtitle}</p>
        </div>

        <div className="gaming-hub-actions">
          <button
            type="button"
            className="gaming-refresh"
            onClick={() => loadNews(search)}
            disabled={loading}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <form
        className="gaming-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadNews(search);
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search gaming headlines..."
          aria-label="Search gaming headlines"
        />

        <button type="submit" className="gaming-search-button">
          Search
        </button>
      </form>

      {error && (
        <div className="gaming-error">
          <h2>Couldn't load the feed</h2>
          <p>{error}</p>

          <button
            type="button"
            className="gaming-refresh"
            onClick={() => loadNews(search)}
          >
            Try again
          </button>
        </div>
      )}

      {showLoading && !error && (
        <div className="gaming-loading">
          <div className="gaming-spinner" />
          <p>Checking public gaming feeds…</p>
        </div>
      )}

      {showEmpty && (
        <div className="gaming-empty">
          <h2>No stories found</h2>
          <p>Try another search or refresh the feed in a moment.</p>
        </div>
      )}

      {articles.length > 0 && (
        <section className="gaming-article-grid">
          {articles.map((article) => (
            <article
              className="gaming-article"
              key={article.id || article.url}
            >
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="gaming-article-image"
                aria-label={`Read ${article.title}`}
              >
                {article.image && (
                  <img
                    src={article.image}
                    alt=""
                    loading="lazy"
                  />
                )}
              </a>

              <div className="gaming-article-content">
                <div className="gaming-article-meta">
                  <span className="gaming-article-source">
                    {article.source || "Gaming source"}
                  </span>

                  {article.publishedAt && (
                    <time dateTime={article.publishedAt}>
                      {formatDate(article.publishedAt)}
                    </time>
                  )}
                </div>

                <h2>{article.title}</h2>

                {article.description && (
                  <p className="gaming-article-description">
                    {article.description}
                  </p>
                )}

                <a
                  className="gaming-article-link"
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read original story ↗
                </a>
              </div>
            </article>
          ))}
        </section>
      )}

      <footer className="gaming-source-footer">
        {lastUpdated && (
          <>Updated {lastUpdated.toLocaleTimeString()} · </>
        )}
        Headlines are collected from public RSS feeds. Articles remain
        the property of their original publishers.
      </footer>
    </main>
  );
}
