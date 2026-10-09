
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

const ESPORTS_GAMES = [
  { id: "all", name: "All Games", short: "ALL", category: "All esports" },
  { id: "valorant", name: "VALORANT", short: "VAL", category: "FPS" },
  { id: "counter-strike-2", name: "Counter-Strike 2", short: "CS2", category: "FPS" },
  { id: "league-of-legends", name: "League of Legends", short: "LOL", category: "MOBA" },
  { id: "dota-2", name: "Dota 2", short: "DOTA", category: "MOBA" },
  { id: "rocket-league", name: "Rocket League", short: "RL", category: "Sports" },
  { id: "overwatch-2", name: "Overwatch 2", short: "OW2", category: "FPS" },
  { id: "rainbow-six-siege", name: "Rainbow Six Siege", short: "R6", category: "FPS" },
  { id: "fortnite", name: "Fortnite", short: "FN", category: "Battle Royale" },
  { id: "call-of-duty", name: "Call of Duty", short: "COD", category: "FPS" },
  { id: "apex-legends", name: "Apex Legends", short: "APEX", category: "Battle Royale" },
  { id: "pubg", name: "PUBG", short: "PUBG", category: "Battle Royale" },
  { id: "mobile-legends", name: "Mobile Legends", short: "MLBB", category: "MOBA" },
  { id: "rainbow-six-mobile", name: "Mobile Esports", short: "MOB", category: "Mobile" },
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

function ExternalLink({ href, children, className = "" }) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="gaming-empty">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function SectionHeading({ title, description, count }) {
  return (
    <div className="esports-section-heading">
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

function MatchCard({ match }) {
  const teams = match.teams || [];

  const teamA = teams[0] || {
    name: match.team1 || match.homeTeam || "Team TBA",
    score: match.score1 ?? match.homeScore,
  };

  const teamB = teams[1] || {
    name: match.team2 || match.awayTeam || "Team TBA",
    score: match.score2 ?? match.awayScore,
  };

  const status = match.status || "upcoming";

  return (
    <article className="esports-match-card" key={match.id}>
      <div className="esports-match-top">
        <span className="esports-game-tag">
          {match.gameName || match.game || "Esports"}
        </span>

        <span className={`esports-match-status status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
          {status}
        </span>
      </div>

      <p className="esports-match-event">
        {displayValue(match.tournament || match.event, "Tournament TBA")}
      </p>

      <div className="esports-match-team">
        <div className="esports-team-identity">
          {teamA.logo && <img src={teamA.logo} alt="" loading="lazy" />}
          <span>{displayValue(teamA.name)}</span>
        </div>

        <strong>
          {teamA.score ?? "—"}
        </strong>
      </div>

      <div className="esports-match-team">
        <div className="esports-team-identity">
          {teamB.logo && <img src={teamB.logo} alt="" loading="lazy" />}
          <span>{displayValue(teamB.name)}</span>
        </div>

        <strong>
          {teamB.score ?? "—"}
        </strong>
      </div>

      <div className="esports-match-footer">
        <span>{formatDateTime(match.startTime || match.date)}</span>

        {match.bestOf && <span>BO{match.bestOf}</span>}

        {match.round && <span>{match.round}</span>}
      </div>

      {match.url && (
        <ExternalLink href={match.url} className="esports-card-link">
          View match ↗
        </ExternalLink>
      )}
    </article>
  );
}

function TournamentCard({ tournament }) {
  const status = tournament.status || "upcoming";

  return (
    <article className="esports-tournament-card" key={tournament.id}>
      {tournament.image && (
        <img
          className="esports-tournament-image"
          src={tournament.image}
          alt=""
          loading="lazy"
        />
      )}

      <div className="esports-tournament-content">
        <div className="esports-match-top">
          <span className="esports-game-tag">
            {tournament.gameName || tournament.game || "Esports"}
          </span>

          <span className="esports-match-status">
            {status}
          </span>
        </div>

        <h3>{displayValue(tournament.name, "Unnamed tournament")}</h3>

        <p>
          {displayValue(tournament.organizer, "Organizer TBA")}
        </p>

        <div className="esports-tournament-details">
          <span>
            <strong>Starts</strong>
            {formatDate(tournament.startDate)}
          </span>

          <span>
            <strong>Prize pool</strong>
            {displayValue(tournament.prizePool, "Not announced")}
          </span>

          <span>
            <strong>Teams</strong>
            {displayValue(tournament.teamCount, "TBA")}
          </span>
        </div>

        <ExternalLink href={tournament.url} className="esports-card-link">
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
      <div className="esports-team-card-heading">
        {team.logo ? (
          <img src={team.logo} alt="" loading="lazy" />
        ) : (
          <div className="esports-team-placeholder">
            {(team.name || "T").slice(0, 1).toUpperCase()}
          </div>
        )}

        <div>
          <h3>{displayValue(team.name, "Unknown team")}</h3>
          <p>{displayValue(team.region, "Region TBA")}</p>
        </div>
      </div>

      <div className="esports-team-stats">
        {team.rank != null && (
          <span>
            <strong>#{team.rank}</strong>
            Rank
          </span>
        )}

        {team.wins != null && (
          <span>
            <strong>{team.wins}</strong>
            Wins
          </span>
        )}

        {team.losses != null && (
          <span>
            <strong>{team.losses}</strong>
            Losses
          </span>
        )}
      </div>

      <div className="esports-roster">
        <h4>Roster</h4>

        {players.length > 0 ? (
          players.map((player, index) => {
            const item =
              typeof player === "string"
                ? { name: player }
                : player;

            return (
              <div className="esports-roster-player" key={item.id || `${item.name}-${index}`}>
                <span>{displayValue(item.name, "Unknown player")}</span>
                <span>{displayValue(item.role || item.position, "Player")}</span>
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
        <ExternalLink href={team.url} className="esports-card-link">
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
        description="Standings will appear when tournament or league data is connected."
      />
    );
  }

  return (
    <div className="esports-table-wrap">
      <table className="esports-standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Played</th>
            <th>W</th>
            <th>L</th>
            <th>Points</th>
          </tr>
        </thead>

        <tbody>
          {standings.map((row, index) => (
            <tr key={row.id || row.teamId || row.team || index}>
              <td>{row.rank ?? index + 1}</td>
              <td>
                <div className="esports-standing-team">
                  {row.logo && <img src={row.logo} alt="" loading="lazy" />}
                  <span>{displayValue(row.teamName || row.team || row.name)}</span>
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
  const teams = match.teams || [];

  const first = teams[0] || {
    name: match.team1 || match.homeTeam || "TBD",
    score: match.score1,
  };

  const second = teams[1] || {
    name: match.team2 || match.awayTeam || "TBD",
    score: match.score2,
  };

  return (
    <div className="esports-bracket-match" key={match.id}>
      <div className="esports-bracket-match-top">
        <span>{displayValue(match.label || match.round, "Match")}</span>
        <span>{displayValue(match.status, "")}</span>
      </div>

      <div className={`esports-bracket-competitor ${match.winnerId && match.winnerId === first.id ? "is-winner" : ""}`}>
        <span>{displayValue(first.name)}</span>
        <strong>{first.score ?? "—"}</strong>
      </div>

      <div className={`esports-bracket-competitor ${match.winnerId && match.winnerId === second.id ? "is-winner" : ""}`}>
        <span>{displayValue(second.name)}</span>
        <strong>{second.score ?? "—"}</strong>
      </div>

      {match.url && (
        <ExternalLink href={match.url} className="esports-bracket-link">
          Match details ↗
        </ExternalLink>
      )}
    </div>
  );
}

function BracketView({ brackets }) {
  if (!brackets.length) {
    return (
      <EmptyState
        title="No brackets available"
        description="When bracket data is connected, tournament rounds and matchups will appear here."
      />
    );
  }

  return (
    <div className="esports-bracket-layout">
      {brackets.map((bracket, index) => {
        const rounds = bracket.rounds || [];

        return (
          <section className="esports-bracket-tournament" key={bracket.id || index}>
            <div className="esports-bracket-heading">
              <div>
                <h3>{displayValue(bracket.name, "Tournament bracket")}</h3>
                <p>
                  {displayValue(bracket.format, "Tournament")}
                  {" · "}
                  {displayValue(bracket.status, "Status TBA")}
                </p>
              </div>

              {bracket.url && (
                <ExternalLink href={bracket.url} className="esports-card-link">
                  Full bracket ↗
                </ExternalLink>
              )}
            </div>

            {rounds.length > 0 ? (
              <div className="esports-bracket-rounds">
                {rounds.map((round, roundIndex) => (
                  <div
                    className="esports-bracket-round"
                    key={round.id || round.name || roundIndex}
                  >
                    <h4>{displayValue(round.name, `Round ${roundIndex + 1}`)}</h4>

                    {(round.matches || []).map((match, matchIndex) => (
                      <BracketMatch
                        key={match.id || matchIndex}
                        match={match}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Rounds not available"
                description="The tournament has no round data in the current response."
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
  onRefresh,
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

  const selectedGameInfo =
    ESPORTS_GAMES.find((game) => game.id === selectedGame) ||
    ESPORTS_GAMES[0];

  const loadEsportsData = useCallback(async () => {
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
            ? "The esports data endpoint has not been configured yet."
            : `Esports data request failed (${response.status}).`
        );
      }

      const data = await response.json();

      setEsportsData({
        matches: Array.isArray(data.matches) ? data.matches : [],
        tournaments: Array.isArray(data.tournaments) ? data.tournaments : [],
        brackets: Array.isArray(data.brackets) ? data.brackets : [],
        teams: Array.isArray(data.teams) ? data.teams : [],
        standings: Array.isArray(data.standings) ? data.standings : [],
      });
    } catch (err) {
      setDataError(err.message || "Couldn't load esports data.");
      setEsportsData(EMPTY_ESPORTS);
    } finally {
      setDataLoading(false);
    }
  }, [activeView, selectedGame]);

  useEffect(() => {
    loadEsportsData();
  }, [loadEsportsData]);

  const visibleArticles = useMemo(() => {
    if (selectedGame === "all") return articles;

    const aliases = {
      valorant: ["valorant", "vct"],
      "counter-strike-2": ["counter-strike", "counter strike", "cs2", "cs:go"],
      "league-of-legends": ["league of legends", "lol", "lck", "lcs", "lec", "lpl"],
      "dota-2": ["dota 2", "dota"],
      "rocket-league": ["rocket league"],
      "overwatch-2": ["overwatch 2", "overwatch", "owcs"],
      "rainbow-six-siege": ["rainbow six", "rainbow six siege", "r6 siege"],
      fortnite: ["fortnite"],
      "call-of-duty": ["call of duty", "cod esports", "call of duty league"],
      "apex-legends": ["apex legends", "algs"],
      pubg: ["pubg", "pubg esports"],
      "mobile-legends": ["mobile legends", "mlbb"],
      "rainbow-six-mobile": ["mobile esports"],
    };

    const terms = aliases[selectedGame] || [selectedGame];

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

  const viewInfo = {
    matches: {
      title: "Matches",
      description: "Match schedules, results, scores, and series information.",
      emptyTitle: "No matches available",
      emptyDescription: "Upcoming matches and completed results will appear here when data is available.",
    },
    tournaments: {
      title: "Tournaments",
      description: "Discover competitions, prize pools, events, and schedules.",
      emptyTitle: "No tournaments available",
      emptyDescription: "Tournament listings will appear here when data is available.",
    },
    brackets: {
      title: "Tournament Brackets",
      description: "Follow group stages, elimination rounds, and championship paths.",
      emptyTitle: "No brackets available",
      emptyDescription: "Available tournament brackets will appear here.",
    },
    teams: {
      title: "Teams & Rosters",
      description: "Explore competitive teams, regions, players, and roster changes.",
      emptyTitle: "No teams available",
      emptyDescription: "Team profiles and player rosters will appear here when data is available.",
    },
    standings: {
      title: "Standings",
      description: "League tables, tournament placements, and competitive rankings.",
      emptyTitle: "No standings available",
      emptyDescription: "Rankings and standings will appear here when data is available.",
    },
  };

  const currentViewInfo = viewInfo[activeView];

  return (
    <div className="esports-dashboard">
      <section className="esports-hero">
        <div className="esports-hero-copy">
          <div className="esports-eyebrow">
            <span className="esports-live-dot" />
            THE COMPETITIVE SCENE
          </div>

          <h2>
            Esports <span>Central.</span>
          </h2>

          <p>
            Follow your games, track tournaments, discover teams,
            and keep up with the competitive scene.
          </p>

          <div className="esports-hero-actions">
            <button
              type="button"
              className="esports-primary-button"
              onClick={() => setActiveView("matches")}
            >
              Explore matches <span>↗</span>
            </button>

            <button
              type="button"
              className="esports-secondary-button"
              onClick={() => setActiveView("tournaments")}
            >
              View tournaments
            </button>
          </div>
        </div>

        <div className="esports-hero-mark" aria-hidden="true">
          <div className="esports-hero-mark-inner">F</div>
          <span>FADES ESPORTS</span>
        </div>
      </section>

      <section className="esports-games-section">
        <div className="esports-games-heading">
          <div>
            <h2>Choose your game</h2>
            <p>Browse news and competitive data by title.</p>
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
              className={`esports-game-option ${selectedGame === game.id ? "active" : ""}`}
              onClick={() => setSelectedGame(game.id)}
              aria-pressed={selectedGame === game.id}
            >
              <span className="esports-game-abbreviation">
                {game.short}
              </span>

              <span className="esports-game-option-text">
                <strong>{game.name}</strong>
                <small>{game.category}</small>
              </span>

              {selectedGame === game.id && (
                <span className="esports-game-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <nav className="esports-view-nav" aria-label="Esports sections">
        {ESPORTS_VIEWS.map((view) => (
          <button
            type="button"
            key={view.id}
            className={`esports-view-button ${activeView === view.id ? "active" : ""}`}
            onClick={() => setActiveView(view.id)}
            aria-current={activeView === view.id ? "page" : undefined}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === "news" ? (
        <section className="esports-content-section">
          <SectionHeading
            title={
              selectedGame === "all"
                ? "Latest Esports News"
                : `${selectedGameInfo.name} News`
            }
            description={
              selectedGame === "all"
                ? "The latest stories from across competitive gaming."
                : `Competitive news and reporting for ${selectedGameInfo.name}.`
            }
            count={visibleArticles.length}
          />

          <form
            className="gaming-search"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch(search);
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search esports news..."
              aria-label="Search esports news"
            />

            <button type="submit" className="gaming-search-button">
              Search
            </button>
          </form>

          {error && (
            <div className="gaming-error">
              <h2>Couldn't load esports news</h2>
              <p>{error}</p>

              <button
                type="button"
                className="gaming-refresh"
                onClick={onRetry}
              >
                Try again
              </button>
            </div>
          )}

          {loading && visibleArticles.length === 0 && !error && (
            <div className="gaming-loading">
              <div className="gaming-spinner" />
              <p>Checking esports news feeds…</p>
            </div>
          )}

          {!loading && !error && visibleArticles.length === 0 && (
            <EmptyState
              title="No esports stories found"
              description="Try another game or search term, or refresh the news feed."
            />
          )}

          {visibleArticles.length > 0 && (
            <div className="gaming-article-grid">
              {visibleArticles.map((article) => (
                <article
                  className="gaming-article"
                  key={article.id || article.url}
                >
                  <ExternalLink
                    href={article.url}
                    className="gaming-article-image"
                  >
                    {article.image && (
                      <img
                        src={article.image}
                        alt=""
                        loading="lazy"
                      />
                    )}
                  </ExternalLink>

                  <div className="gaming-article-content">
                    <div className="gaming-article-meta">
                      <span className="gaming-article-source">
                        {article.source || "Esports source"}
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

                    <ExternalLink
                      href={article.url}
                      className="gaming-article-link"
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
        <section className="esports-content-section">
          <SectionHeading
            title={currentViewInfo.title}
            description={currentViewInfo.description}
            count={currentItems.length}
          />

          {dataLoading && (
            <div className="gaming-loading">
              <div className="gaming-spinner" />
              <p>Loading {activeView} data…</p>
            </div>
          )}

          {dataError && !dataLoading && (
            <div className="gaming-error">
              <h2>Esports data unavailable</h2>
              <p>{dataError}</p>
              <p>
                This section needs the structured esports API endpoint.
                News and the rest of the gaming hub can continue working independently.
              </p>

              <button
                type="button"
                className="gaming-refresh"
                onClick={loadEsportsData}
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
        {lastUpdated && <>News updated {lastUpdated.toLocaleTimeString()} · </>}
        {selectedGameInfo.name} · Fades Gaming Esports.
        Match schedules, scores, rosters, and brackets depend on the
        availability and freshness of the connected data sources.
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

        setArticles(Array.isArray(data.articles) ? data.articles : []);
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

        <EsportsDashboard
          articles={articles}
          loading={loading}
          error={error}
          onRefresh={() => loadNews(search)}
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
                  <img src={article.image} alt="" loading="lazy" />
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
        {lastUpdated && <>Updated {lastUpdated.toLocaleTimeString()} · </>}
        Headlines are collected from public RSS feeds. Articles remain the
        property of their original publishers.
      </footer>
    </main>
  );
}
