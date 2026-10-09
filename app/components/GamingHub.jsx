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

  const loadNews = useCallback(
    async (searchTerm = "") => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ topic: page });
        if (searchTerm.trim()) params.set("search", searchTerm.trim());

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
    },
    [page]
  );

  // reload when the page/topic changes (search only runs on submit)
  useEffect(() => {
    setSearch("");
    loadNews("");
  }, [loadNews]);

  const showEmpty = !loading && !error && articles.length === 0;
  const showLoading = loading && articles.length === 0;

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
          <h2>Couldn’t load the feed</h2>
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
            <article className="gaming-article" key={article.id || article.url}>
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
                      {new Date(article.publishedAt).toLocaleDateString()}
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
