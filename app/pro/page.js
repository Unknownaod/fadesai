"use client";

import { useState } from "react";
import Link from "next/link";
import "./pro.css";

const features = [
{
number: "01",
title: "More usage",
description:
"Higher usage limits give you more space to ask questions, write, code, research, and create.",
},
{
number: "02",
title: "Longer context",
description:
"Keep more of your conversation in context when working through larger ideas and longer tasks.",
},
{
number: "03",
title: "Priority access",
description:
"Get priority access to Fades when demand is high.",
},
{
number: "04",
title: "Built for everyday use",
description:
"From quick questions to serious projects, Pro gives you more room to use Fades throughout the day.",
},
{
number: "05",
title: "One account",
description:
"Everything stays connected to your existing Fades account. Upgrade without starting over.",
},
{
number: "06",
title: "A better Fades",
description:
"Pro is designed for people who want to get more out of the Fades experience.",
},
];

function Check({ muted = false }) {
return (
<span className={muted ? "table-dash" : "table-check"}>
{muted ? "—" : "✓"} </span>
);
}

export default function ProPage() {
const [billing, setBilling] = useState("monthly");

const monthlyPrice = "9.99";
const yearlyPrice = "99.99";

const monthlyEquivalent =
billing === "monthly"
? monthlyPrice
: (Number(yearlyPrice) / 12).toFixed(2);

function handleUpgrade() {
alert("Stripe checkout is coming soon.");
}

return ( <main className="pro-page"> <div className="background-grid" /> <div className="background-glow background-glow-top" /> <div className="background-glow background-glow-left" />


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

  <section className="hero">
    <div className="eyebrow">
      <span className="eyebrow-dot" />
      Fades Pro
    </div>

    <h1>
      More room
      <br />
      <span>to do more.</span>
    </h1>

    <p className="hero-copy">
      A more capable Fades experience for people who
      use AI every day.
    </p>

    <div className="billing-control">
      <button
        type="button"
        className={billing === "monthly" ? "active" : ""}
        onClick={() => setBilling("monthly")}
      >
        Monthly
      </button>

      <button
        type="button"
        className={billing === "yearly" ? "active" : ""}
        onClick={() => setBilling("yearly")}
      >
        Yearly
        <span>Save</span>
      </button>
    </div>

    <div className="pricing-card">
      <div className="pricing-top">
        <div className="pricing-info">
          <div className="pricing-label">FADES PRO</div>

          <h2>
            More Fades.
            <br />
            Less waiting.
          </h2>

          <p>
            Higher limits, longer conversations,
            and priority access.
          </p>
        </div>

        <div className="price">
          <div className="price-value">
            <small>$</small>
            {monthlyEquivalent}
          </div>

          <div className="price-period">
            USD / month
          </div>
        </div>
      </div>

      {billing === "yearly" && (
        <div className="billing-note">
          <Check />
          <span>
            Billed ${yearlyPrice} USD once per year
          </span>
        </div>
      )}

      <div className="card-divider" />

      <div className="included">
        <div className="included-heading">
          Everything in Pro
        </div>

        <div className="included-list">
          <div>
            <Check />
            <span>Higher AI usage limits</span>
          </div>

          <div>
            <Check />
            <span>Longer conversations</span>
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
        <span>Continue with Pro</span>
        <span className="button-arrow">↗</span>
      </button>

      <p className="secure-note">
        Secure checkout · Cancel anytime
      </p>
    </div>

    <div className="hero-footnote">
      <span>For people who use Fades more often.</span>
      <span className="footnote-separator">·</span>
      <span>Built around your workflow.</span>
    </div>
  </section>

  <section className="statement-section">
    <div className="section-line" />

    <div className="statement-grid">
      <div className="section-label">THE IDEA</div>

      <div>
        <h2>
          AI should feel like
          <br />
          <span>it keeps up with you.</span>
        </h2>

        <p>
          Pro gives you more room to work without
          changing the Fades experience you already
          know.
        </p>
      </div>
    </div>
  </section>

  <section className="features-section">
    <div className="section-heading">
      <div className="section-label">PRO FEATURES</div>

      <h2>
        Designed for
        <br />
        <span>more.</span>
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
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>

          <div className="feature-mark">↗</div>
        </article>
      ))}
    </div>
  </section>

  <section className="comparison-section">
    <div className="section-heading centered">
      <div className="section-label">PLANS</div>

      <h2>
        Simple by
        <br />
        <span>design.</span>
      </h2>

      <p>
        Start with Fades for free. Upgrade when
        you need more.
      </p>
    </div>

    <div className="comparison-card">
      <div className="comparison-head">
        <div>FEATURE</div>
        <div>FREE</div>
        <div className="pro-column">PRO</div>
      </div>

      <div className="comparison-row">
        <div>AI access</div>
        <div><Check /></div>
        <div className="pro-column"><Check /></div>
      </div>

      <div className="comparison-row">
        <div>Usage limits</div>
        <div>Standard</div>
        <div className="pro-column">Higher</div>
      </div>

      <div className="comparison-row">
        <div>Conversation context</div>
        <div>Standard</div>
        <div className="pro-column">Extended</div>
      </div>

      <div className="comparison-row">
        <div>Priority access</div>
        <div><Check muted /></div>
        <div className="pro-column"><Check /></div>
      </div>

      <div className="comparison-row">
        <div>Premium experience</div>
        <div><Check muted /></div>
        <div className="pro-column"><Check /></div>
      </div>
    </div>
  </section>

  <section className="final-section">
    <div className="final-orb">
      <img src="/logo.png" alt="Fades" />
    </div>

    <div className="section-label">FADE INTO MORE</div>

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

  <footer className="pro-footer">
    <div className="footer-brand">
      <img src="/logo.png" alt="Fades" />
      <span>fades</span>
    </div>

    <div className="footer-links">
      <Link href="/">Home</Link>
      <Link href="/settings">Settings</Link>
    </div>

    <div className="footer-copy">
      © {new Date().getFullYear()} Fades
    </div>
  </footer>
</main>


);
}
