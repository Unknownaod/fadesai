"use client";

import { useState } from "react";
import Link from "next/link";
import "./pro.css";

const features = [
{
number: "01",
title: "Higher AI limits",
description:
"More room for questions, coding, writing, research, and everyday conversations.",
},
{
number: "02",
title: "Extended context",
description:
"Keep more of your conversations available when you're working through larger ideas.",
},
{
number: "03",
title: "Priority access",
description:
"Get priority access to Fades during periods of high demand.",
},
{
number: "04",
title: "Built for daily use",
description:
"Use Fades throughout your day without constantly running into standard limits.",
},
{
number: "05",
title: "Everything stays together",
description:
"Your existing account, conversations, preferences, and Fades experience stay connected.",
},
{
number: "06",
title: "More Fades",
description:
"A premium experience designed for people who rely on AI more often.",
},
];

function Check({ muted = false }) {
return (
<span
className={muted ? "table-dash" : "table-check"}
aria-hidden="true"
>
{muted ? "—" : "✓"} </span>
);
}

export default function ProPage() {
const [billing, setBilling] = useState("monthly");

const monthlyPrice = 9.99;
const yearlyPrice = 99.99;

const monthlyEquivalent =
billing === "monthly"
? monthlyPrice.toFixed(2)
: (yearlyPrice / 12).toFixed(2);

const yearlySavings = (
monthlyPrice * 12 -
yearlyPrice
).toFixed(2);

function handleUpgrade() {
alert("Stripe checkout is coming soon.");
}

return ( <main className="pro-page"> <div className="background-grid" /> <div className="background-glow background-glow-top" /> <div className="background-glow background-glow-left" />


  {/* NAVIGATION */}

  <header className="pro-nav">
    <Link href="/" className="brand">
      <img src="/logo.png" alt="Fades" />
      <span>fades</span>
    </Link>

    <Link href="/" className="back-link">
      <span>←</span>
      Back to Fades
    </Link>
  </header>

  {/* HERO */}

  <section className="hero">
    <div className="eyebrow">
      <span className="eyebrow-dot" />
      Fades Pro
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

    {/* BILLING SELECTOR */}

    <div className="billing-control">
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
        <span>Save</span>
      </button>
    </div>

    {/* PRICING CARD */}

    <div className="pricing-card">
      <div className="pricing-card-topline">
        <span>FADES PRO</span>

        <span className="popular-badge">
          PRO
        </span>
      </div>

      <div className="pricing-top">
        <div className="pricing-info">
          <h2>
            More room.
            <br />
            More Fades.
          </h2>

          <p>
            A premium Fades experience for people
            who use AI every day.
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
            · Save ${yearlySavings}
          </span>
        </div>
      )}

      <div className="card-divider" />

      <div className="included">
        <div className="included-heading">
          Included with Pro
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
            <span>Priority access</span>
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
      >
        <span>
          Get Fades Pro
        </span>

        <span className="button-arrow">
          ↗
        </span>
      </button>

      <p className="secure-note">
        Secure checkout · Cancel anytime
      </p>
    </div>

    <div className="hero-footnote">
      <span>No complicated setup</span>
      <span className="footnote-separator">·</span>
      <span>One Fades account</span>
      <span className="footnote-separator">·</span>
      <span>Upgrade when you're ready</span>
    </div>
  </section>

  {/* STATEMENT */}

  <section className="statement-section">
    <div className="section-line" />

    <div className="statement-grid">
      <div className="section-label">
        WHY PRO
      </div>

      <div>
        <h2>
          Fades should
          <br />
          <span>keep up with you.</span>
        </h2>

        <p>
          Pro gives you more room to work without
          changing the Fades experience you already
          know.
        </p>
      </div>
    </div>
  </section>

  {/* FEATURES */}

  <section className="features-section">
    <div className="section-heading">
      <div className="section-label">
        PRO FEATURES
      </div>

      <h2>
        More space.
        <br />
        <span>More possibilities.</span>
      </h2>
    </div>

    <div className="features-grid">
      {features.map((feature) => (
        <article
          className="feature-card"
          key={feature.number}
        >
          <div className="feature-number">
            {feature.number}
          </div>

          <div className="feature-content">
            <h3>
              {feature.title}
            </h3>

            <p>
              {feature.description}
            </p>
          </div>

          <div
            className="feature-mark"
            aria-hidden="true"
          >
            ↗
          </div>
        </article>
      ))}
    </div>
  </section>

  {/* COMPARISON */}

  <section className="comparison-section">
    <div className="section-heading centered">
      <div className="section-label">
        PLANS
      </div>

      <h2>
        Choose your
        <br />
        <span>Fades experience.</span>
      </h2>

      <p>
        Start free and upgrade whenever you need
        more from Fades.
      </p>
    </div>

    <div className="comparison-card">
      <div className="comparison-head">
        <div>FEATURE</div>
        <div>FREE</div>
        <div className="pro-column">
          PRO
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

        <div>
          Standard
        </div>

        <div className="pro-column">
          Higher
        </div>
      </div>

      <div className="comparison-row">
        <div>Conversation context</div>

        <div>
          Standard
        </div>

        <div className="pro-column">
          Extended
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
    </div>
  </section>

  {/* FINAL CTA */}

  <section className="final-section">
    <div className="final-orb">
      <img
        src="/logo.png"
        alt="Fades"
      />
    </div>

    <div className="section-label">
      FADE INTO MORE
    </div>

    <h2>
      Keep going
      <br />
      <span>with Fades.</span>
    </h2>

    <p>
      More room for questions, ideas, projects,
      and everything in between.
    </p>

    <button
      type="button"
      className="final-button"
      onClick={handleUpgrade}
    >
      Get Fades Pro
      <span>↗</span>
    </button>
  </section>

  {/* FOOTER */}

  <footer className="pro-footer">
    <div className="footer-brand">
      <img
        src="/logo.png"
        alt="Fades"
      />

      <span>fades</span>
    </div>

    <div className="footer-links">
      <Link href="/">
        Home
      </Link>

      <Link href="/settings">
        Settings
      </Link>
    </div>

    <div className="footer-copy">
      © {new Date().getFullYear()} Fades
    </div>
  </footer>
</main>


);
}
