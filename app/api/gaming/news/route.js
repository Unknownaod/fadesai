
import Parser from "rss-parser";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "FadesAI-GamingNews/1.0 (+https://fades.lol)",
  },
});

const FEEDS = [
  {
    name: "IGN",
    url: "https://www.ign.com/rss/v2/articles/feed",
  },
  {
    name: "PC Gamer",
    url: "https://www.pcgamer.com/rss/",
  },
  {
    name: "Kotaku",
    url: "https://kotaku.com/feed",
  },
  {
    name: "Rock Paper Shotgun",
    url: "https://www.rockpapershotgun.com/feed",
  },
  {
    name: "Eurogamer",
    url: "https://www.eurogamer.net/feed",
  },
  {
    name: "Nintendo Life",
    url: "https://www.nintendolife.com/feeds/latest",
  },
];

const TOPIC_TERMS = {
  "gaming-releases": [
    "release", "releases", "launch", "launches", "launching",
    "coming soon", "release date", "early access", "available now",
    "out now", "new game", "upcoming game",
  ],
  "gaming-esports": [
    "esports", "e-sports", "tournament", "championship",
    "league", "competitive", "valorant", "counter-strike",
    "counter strike", "league of legends", "dota 2",
    "overwatch", "rainbow six", "worlds",
  ],
  "gaming-updates": [
    "update", "patch", "hotfix", "patch notes", "version",
    "balance changes", "bug fix", "maintenance", "season",
  ],
  "gaming-deals": [
    "deal", "deals", "sale", "discount", "discounted",
    "free to play", "free game", "giveaway", "price drop",
  ],
  "gaming-pc": [
    "pc", "steam", "windows", "pc gaming", "graphics card",
    "gpu", "nvidia", "amd", "steam deck",
  ],
  "gaming-playstation": [
    "playstation", "ps5", "ps4", "ps plus", "playstation plus",
    "sony interactive",
  ],
  "gaming-xbox": [
    "xbox", "game pass", "xbox series", "microsoft gaming",
  ],
  "gaming-nintendo": [
    "nintendo", "switch", "switch 2", "mario", "zelda",
    "pokémon", "pokemon",
  ],
};

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;

  const media = item["media:content"];
  if (media?.$?.url) return media.$.url;

  const thumbnail = item["media:thumbnail"];
  if (thumbnail?.$?.url) return thumbnail.$.url;

  const html = item["content:encoded"] || item.content || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "FadesAI-GamingNews/1.0 (+https://fades.lol)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Feed returned ${response.status}`);
    }

    const xml = await response.text();
    const parsed = await parser.parseString(xml);

    return (parsed.items || []).map((item) => {
      const url = item.link;
      if (!url || !/^https?:\/\//i.test(url)) return null;

      const published = item.isoDate || item.pubDate || null;
      const parsedDate = published ? new Date(published) : null;
      const publishedAt =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : null;

      return {
        id: url,
        title: cleanText(item.title) || "Untitled story",
        description: cleanText(
          item.contentSnippet || item.summary || item.content || ""
        ).slice(0, 400),
        image: getImage(item),
        url,
        publishedAt,
        source: feed.name,
        hostname: getHostname(url),
      };
    }).filter(Boolean);
  } catch (error) {
    console.error(`[Gaming RSS] ${feed.name}:`, error.message);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "gaming";
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));

    let articles = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    // Remove duplicate stories using the canonical article URL.
    const seen = new Set();
    articles = articles.filter((article) => {
      const key = article.url.split("#")[0].replace(/\/+$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (topic !== "gaming" && topic !== "gaming-news") {
      const terms = TOPIC_TERMS[topic];

      if (terms) {
        articles = articles.filter((article) => {
          const text = `${article.title} ${article.description} ${article.hostname}`.toLowerCase();
          return terms.some((term) => text.includes(term));
        });
      }
    }

    if (search) {
      articles = articles.filter((article) => {
        const text = `${article.title} ${article.description} ${article.source}`.toLowerCase();
        return text.includes(search);
      });
    }

    articles.sort((a, b) => {
      const dateA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const dateB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return dateB - dateA;
    });

    return NextResponse.json(
      {
        articles: articles.slice(0, 100),
        topic,
        sourcesChecked: FEEDS.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[Gaming API]", error);
    return NextResponse.json(
      { error: "Unable to collect gaming news right now.", articles: [] },
      { status: 500 }
    );
  }
}
