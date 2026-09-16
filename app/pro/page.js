"use client";

import { useState } from "react";
import Link from "next/link";
import "./globals.css";

const features = [
  {
    number: "01",
    title: "Higher AI limits",
    description:
      "More room for questions, coding, writing, research, brainstorming, and everyday conversations.",
  },
  {
    number: "02",
    title: "Extended context",
    description:
      "Keep more of your conversation in context when you're working through larger ideas and longer projects.",
  },
  {
    number: "03",
    title: "Priority access",
    description:
      "Get priority access to Fades when demand is high, so you can keep moving when it matters.",
  },
  {
    number: "04",
    title: "Built for daily use",
    description:
      "Use Fades throughout your day without constantly worrying about standard usage limits.",
  },
  {
    number: "05",
    title: "Everything stays together",
    description:
      "Your account, conversations, preferences, and Fades experience stay connected in one place.",
  },
  {
    number: "06",
    title: "A more premium Fades",
    description:
      "A refined experience designed for people who rely on AI more often and expect more from it.",
  },
];

function Check({ muted = false }) {
  return (
    <span
      className={muted ? "table-dash" : "table-check"}
      aria-hidden="true"
    >
      {muted ? "—" : "✓"}
    </span>
  );
}

export default function ProPage() {
  const [billing, setBilling] = useState("monthly");
  const [isLoading, setIsLoading] = useState(false);

  const monthlyPrice = 9.99;
  const yearlyPrice = 99.99;

  const monthlyEquivalent =
    billing === "monthly"
      ? monthlyPrice.toFixed(2)
      : (yearlyPrice / 12).toFixed(2);

  const yearlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);

      /*
       * Connect your Stripe checkout endpoint here.
       *
       * Example:
       *
       * const response = await fetch("/api/stripe/checkout", {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *   },
       *   body: JSON.stringify({
       *     plan: billing,
       *   }),
       * });
       *
       * const { url } = await response.json();
       * window.location.href = url;
       */

      console.log(`Starting ${billing} Fades Pro checkout...`);
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="pro-page">
      <div className="background-grid" />
      <div className="background-noise" />

      <div className="background-glow background-glow-top" />
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-bottom" />

      {/* NAVIGATION */}

      <header className="pro-nav">
        <Link href="/" className="brand-name" aria-label="Fades home">
          <span className="brand-mark">
            <img src="/logo.png" alt="" />
          </span>

          <span>fades</span>
        </Link>

        <Link href="/" className="back-link">
          <span className="back-arrow">←</span>
          Back to Fades
        </Link>
      </header>

      {/* HERO */}

      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            <span>Fades Pro</span>
            <span className="eyebrow-line" />
            <span className="eyebrow-status">Available now</span>
          </div>

          <h1>
            AI that
            <br />
            <span>keeps up.</span>
          </h1>

          <p className="hero-copy">
            More usage. Longer conversations. Priority access.
            <br />
            Everything you need to get more out of Fades.
          </p>

          {/* BILLING */}

          <div className="billing-wrapper">
            <div className="billing-control" role="tablist">
              <button
                type="button"
                className={billing === "monthly" ? "active" : ""}
                onClick={() => setBilling("monthly")}
                aria-pressed={billing === "monthly"}
              >
                Monthly
              </button>

              <button
                type="button"
                className={billing === "yearly" ? "active" : ""}
                onClick={() => setBilling("yearly")}
                aria-pressed={billing === "yearly"}
              >
                Yearly
                <span>Save 17%</span>
              </button>
            </div>
          </div>

          {/* PRICING CARD */}

          <div className="pricing-card">
            <div className="pricing-card-glow" />

            <div className="pricing-card-topline">
              <div className="plan-name">
                <span className="plan-dot" />
                FADES PRO
              </div>

              <span className="popular-badge">PRO</span>
            </div>

            <div className="pricing-top">
              <div className="pricing-info">
                <div className="plan-kicker">
                  For people who use Fades every day
                </div>

                <h2>
                  More room.
                  <br />
                  <span>More Fades.</span>
                </h2>

                <p>
                  A premium Fades experience with more capacity,
                  more context, and priority access.
                </p>
              </div>

              <div className="price">
                <div className="price-value">
                  <small>$</small>
                  {monthlyEquivalent}
                </div>

                <div className="price-period">
                  {billing === "monthly"
                    ? "USD / month"
                    : "USD / month equivalent"}
                </div>
              </div>
            </div>

            {billing === "yearly" && (
              <div className="billing-note">
                <Check />

                <span>
                  Billed ${yearlyPrice.toFixed(2)} USD yearly
                  <strong> · Save ${yearlySavings}</strong>
                </span>
              </div>
            )}

            <div className="card-divider" />

            <div className="included">
              <div className="included-heading">
                <span>WHAT&apos;S INCLUDED</span>
                <span className="included-count">04</span>
              </div>

              <div className="included-list">
                <div>
                  <Check />
                  <span>Higher AI usage limits</span>
                </div>

                <div>
                  <Check />
                  <span>Extended conversation context</span>
                </div>

                <div>
                  <Check />
                  <span>Priority access during high demand</span>
                </div>

                <div>
                  <Check />
                  <span>Premium Fades experience</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={handleUpgrade}
              disabled={isLoading}
            >
              <span>
                {isLoading ? "Opening checkout..." : "Get Fades Pro"}
              </span>

              <span className="button-arrow">
                {isLoading ? "…" : "↗"}
              </span>
            </button>

            <div className="secure-note">
              <span className="secure-icon">✓</span>
              <span>Secure checkout</span>
              <span className="secure-dot">·</span>
              <span>Cancel anytime</span>
            </div>
          </div>

          <div className="hero-footnote">
            <span>No complicated setup</span>
            <span className="footnote-separator">·</span>
            <span>One Fades account</span>
            <span className="footnote-separator">·</span>
            <span>Upgrade when you&apos;re ready</span>
          </div>
        </div>
      </section>

      {/* WHY PRO */}

      <section className="statement-section">
        <div className="section-line" />

        <div className="statement-grid">
          <div className="section-label">
            <span className="label-number">01</span>
            WHY PRO
          </div>

          <div className="statement-content">
            <h2>
              Fades should
              <br />
              <span>keep up with you.</span>
            </h2>

            <p>
              Pro gives you more room to work without changing the
              Fades experience you already know.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}

      <section className="features-section">
        <div className="section-heading">
          <div className="section-label">
            <span className="label-number">02</span>
            PRO FEATURES
          </div>

          <div className="section-heading-row">
            <h2>
              More space.
              <br />
              <span>More possibilities.</span>
            </h2>

            <p>
              Everything Pro gives you,
              <br />
              in one place.
            </p>
          </div>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <article
              className="feature-card"
              key={feature.number}
            >
              <div className="feature-top">
                <div className="feature-number">
                  {feature.number}
                </div>

                <div className="feature-mark" aria-hidden="true">
                  ↗
                </div>
              </div>

              <div className="feature-content">
                <h3>{feature.title}</h3>

                <p>{feature.description}</p>
              </div>

              <div className="feature-bottom-line" />
            </article>
          ))}
        </div>
      </section>

      {/* PLANS */}

      <section className="comparison-section">
        <div className="section-heading centered">
          <div className="section-label">
            <span className="label-number">03</span>
            PLANS
          </div>

          <h2>
            Choose your
            <br />
            <span>Fades experience.</span>
          </h2>

          <p>
            Start free and upgrade whenever you need
            <br />
            more from Fades.
          </p>
        </div>

        <div className="comparison-card">
          <div className="comparison-head">
            <div>FEATURE</div>
            <div>FREE</div>
            <div className="pro-column">
              <span>PRO</span>
              <small>POPULAR</small>
            </div>
          </div>

          <div className="comparison-row">
            <div>AI access</div>

            <div>
              <Check />
            </div>

            <div className="pro-column">
              <Check />
            </div>
          </div>

          <div className="comparison-row">
            <div>Usage limits</div>

            <div>Standard</div>

            <div className="pro-column">
              <strong>Higher</strong>
            </div>
          </div>

          <div className="comparison-row">
            <div>Conversation context</div>

            <div>Standard</div>

            <div className="pro-column">
              <strong>Extended</strong>
            </div>
          </div>

          <div className="comparison-row">
            <div>Priority access</div>

            <div>
              <Check muted />
            </div>

            <div className="pro-column">
              <Check />
            </div>
          </div>

          <div className="comparison-row">
            <div>Premium experience</div>

            <div>
              <Check muted />
            </div>

            <div className="pro-column">
              <Check />
            </div>
          </div>

          <div className="comparison-footer">
            <span>Need more?</span>

            <button
              type="button"
              onClick={handleUpgrade}
            >
              Upgrade to Pro <span>↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}

      <section className="final-section">
        <div className="final-orb">
          <div className="final-orb-ring" />
          <div className="final-orb-inner">
            <img src="/logo.png" alt="Fades" />
          </div>
        </div>

        <div className="section-label">
          <span className="label-number">04</span>
          FADE INTO MORE
        </div>

        <h2>
          Keep going
          <br />
          <span>with Fades.</span>
        </h2>

        <p>
          More room for questions, ideas, projects,
          <br />
          and everything in between.
        </p>

        <button
          type="button"
          className="final-button"
          onClick={handleUpgrade}
          disabled={isLoading}
        >
          {isLoading ? "Opening checkout..." : "Get Fades Pro"}
          <span>↗</span>
        </button>
      </section>

      {/* FOOTER */}

      <footer className="pro-footer">
        <Link href="/" className="footer-brand">
          <span className="footer-logo">
            <img src="/logo.png" alt="" />
          </span>

          <span>fades</span>
        </Link>

        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>

        <div className="footer-copy">
          © {new Date().getFullYear()} Fades
        </div>
      </footer>
    </main>
  );
}
