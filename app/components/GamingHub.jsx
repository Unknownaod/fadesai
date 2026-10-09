
"use client";

import { useCallback, useEffect, useState } from "react";

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
    subtitle: "Competitive gaming, tournaments, and esports teams.",
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

export default function GamingHub({ page = "gaming" }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  const info = PAGE_INFO[page] || PAGE_INFO.gaming;

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ topic: page });
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/gaming/news?${params.toString()}`, {
        cache: "no-store",
      });

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
  }, [page, search]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  return (
    <main className="gaming-hub">
      <header className="gaming-hub-header">
        <div>
          <div className="gaming-eyebrow">FADES AI · GAMING</div>
          <h1>{info.title}</h1>
          <p>{info.subtitle}</p>
        </div>

        <button
          type="button"
          className="gaming-refresh"
          onClick={loadNews}
          disabled={loading}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </header>

      <form
        className="gaming-search"
        onSubmit={(event) => {
          event.preventDefault();
          loadNews();
        }}
      >
        <span>⌕</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search gaming headlines..."
          aria-label="Search gaming headlines"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}>
            Clear
          </button>
        )}
      </form>

      <div className="gaming-feed-status">
        <span>{loading ? "Checking public feeds…" : `${articles.length} stories`}</span>
        {lastUpdated && (
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
        )}
        <span>Sources are credited on each story</span>
      </div>

      {error && (
        <div className="gaming-error">
          <strong>Couldn’t load the feed.</strong>
          <p>{error}</p>
          <button type="button" onClick={loadNews}>Try again</button>
        </div>
      )}

      {loading && articles.length === 0 && (
        <div className="gaming-loading">
          <div className="gaming-loading-icon">🎮</div>
          <h2>Loading gaming news</h2>
          <p>Checking multiple public gaming feeds.</p>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div className="gaming-empty">
          <div>🕹️</div>
          <h2>No stories found</h2>
          <p>Try another search or refresh the feed in a moment.</p>
        </div>
      )}

      <section className="gaming-article-grid">
        {articles.map((article) => (
          <article className="gaming-article" key={article.id || article.url}>
            {article.image ? (
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="gaming-article-image"
                aria-label={`Read ${article.title}`}
              >
                <img src={article.image} alt="" loading="lazy" />
              </a>
            ) : (
              <div className="gaming-article-image gaming-article-placeholder">
                <span>🎮</span>
              </div>
            )}

            <div className="gaming-article-body">
              <div className="gaming-article-meta">
                <span>{article.source || "Gaming source"}</span>
                {article.publishedAt && (
                  <time dateTime={article.publishedAt}>
                    {new Date(article.publishedAt).toLocaleDateString()}
                  </time>
                )}
              </div>

              <h2>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
              </h2>

              {article.description && (
                <p>{article.description}</p>
              )}

              <a
                className="gaming-read-more"
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

      <footer className="gaming-hub-footer">
        Headlines are collected from public RSS feeds. Articles remain the
        property of their original publishers.
      </footer>
    </main>
  );
}
