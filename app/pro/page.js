"use client";

import { useState } from "react";
import Link from "next/link";
import "./pro.css";

const features = [
  {
    icon: "✦",
    title: "More AI",
    description:
      "Higher usage limits give you more room to ask, create, code, and explore.",
  },
  {
    icon: "↯",
    title: "Priority access",
    description:
      "Get priority access to Fades when demand is high.",
  },
  {
    icon: "∞",
    title: "Longer conversations",
    description:
      "Keep more context across longer conversations with Fades AI.",
  },
  {
    icon: "◌",
    title: "Faster experience",
    description:
      "A smoother experience designed for people who use Fades every day.",
  },
  {
    icon: "⌘",
    title: "Built for everything",
    description:
      "Use Fades for studying, writing, coding, brainstorming, and everyday questions.",
  },
  {
    icon: "✓",
    title: "No complicated setup",
    description:
      "Upgrade your existing Fades account and keep everything in one place.",
  },
];

function ComparisonRow({ name, free, pro }) {
  return (
    <div className="comparison-row">
      <div className="comparison-name">{name}</div>
      <div className="comparison-value">{free}</div>
      <div className="comparison-value comparison-pro">
        {pro}
      </div>
    </div>
  );
}

export default function ProPage() {
  const [billing, setBilling] = useState("monthly");

  const monthlyPrice = "9.99";
  const yearlyPrice = "99.99";

  const price =
    billing === "monthly"
      ? monthlyPrice
      : (Number(yearlyPrice) / 12).toFixed(2);

  function handleUpgrade() {
    // Stripe checkout will be connected here.
    alert("Stripe checkout is coming soon.");
  }

  return (
    <main className="pro-page">

      {/* Background effects */}
      <div className="pro-glow pro-glow-one" />
      <div className="pro-glow pro-glow-two" />

      {/* Navigation */}
      <header className="pro-nav">
        <Link href="/" className="pro-brand">
          <img
            src="/logo.png"
            alt="Fades"
          />

          <span>fades</span>
        </Link>

        <Link href="/" className="back-button">
          <span>←</span>
          Back to Fades
        </Link>
      </header>

      {/* Hero */}
      <section className="hero">

        <div className="hero-pill">
          <span className="hero-pill-icon">✦</span>
          Fades Pro
        </div>

        <h1>
          Fades,{" "}
          <span>without the limits.</span>
        </h1>

        <p className="hero-subtitle">
          More room to think, create, and get things done.
          Upgrade to Fades Pro for a more powerful AI
          experience.
        </p>

        {/* Billing */}
        <div className="billing-switch">
          <button
            className={
              billing === "monthly"
                ? "billing-active"
                : ""
            }
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>

          <button
            className={
              billing === "yearly"
                ? "billing-active"
                : ""
            }
            onClick={() => setBilling("yearly")}
          >
            Yearly

            <span className="save-pill">
              Save
            </span>
          </button>
        </div>

        {/* Pricing card */}
        <div className="pricing-wrapper">

          <div className="pricing-card">

            <div className="pricing-card-top">

              <div className="pricing-title-area">
                <div className="mini-label">
                  FADES PRO
                </div>

                <h2>
                  Everything you need.
                </h2>

                <p>
                  Built for people who use Fades
                  more often.
                </p>
              </div>

              <div className="price-area">
                <div className="price-line">
                  <span className="currency">
                    $
                  </span>

                  <span className="price">
                    {price}
                  </span>
                </div>

                <span className="price-period">
                  USD / month
                </span>
              </div>

            </div>

            {billing === "yearly" && (
              <div className="annual-message">
                <span>✓</span>
                Billed ${yearlyPrice} once per year
              </div>
            )}

            <div className="pricing-divider" />

            <div className="included-title">
              Pro includes
            </div>

            <div className="included-grid">

              <div>
                <span>✓</span>
                Higher AI limits
              </div>

              <div>
                <span>✓</span>
                Priority access
              </div>

              <div>
                <span>✓</span>
                Longer conversations
              </div>

              <div>
                <span>✓</span>
                Premium experience
              </div>

            </div>

            <button
              className="checkout-button"
              onClick={handleUpgrade}
            >
              <span>Upgrade to Pro</span>
              <span className="checkout-arrow">
                →
              </span>
            </button>

            <div className="checkout-note">
              Secure checkout · Cancel anytime
            </div>

          </div>

        </div>

      </section>

      {/* Feature section */}
      <section className="features-section">

        <div className="section-intro">
          <div className="section-eyebrow">
            WHY PRO
          </div>

          <h2>
            More of what makes
            <br />
            <span>Fades useful.</span>
          </h2>

          <p>
            Pro is designed around the way people
            actually use AI — more conversations,
            more questions, and more room to create.
          </p>
        </div>

        <div className="features-grid">

          {features.map((feature) => (
            <div
              className="feature-card"
              key={feature.title}
            >
              <div className="feature-icon">
                {feature.icon}
              </div>

              <h3>
                {feature.title}
              </h3>

              <p>
                {feature.description}
              </p>
            </div>
          ))}

        </div>

      </section>

      {/* Comparison */}
      <section className="comparison-section">

        <div className="section-intro centered">
          <div className="section-eyebrow">
            COMPARE
          </div>

          <h2>
            Simple plans.
          </h2>

          <p>
            Start free and upgrade whenever you
            need more.
          </p>
        </div>

        <div className="comparison-card">

          <div className="comparison-header">
            <div />
            <div>Free</div>
            <div className="comparison-pro">
              Pro
            </div>
          </div>

          <ComparisonRow
            name="AI access"
            free="✓"
            pro="✓"
          />

          <ComparisonRow
            name="Usage limits"
            free="Standard"
            pro="Higher"
          />

          <ComparisonRow
            name="Conversation length"
            free="Standard"
            pro="Extended"
          />

          <ComparisonRow
            name="Priority access"
            free="—"
            pro="✓"
          />

          <ComparisonRow
            name="Premium experience"
            free="—"
            pro="✓"
          />

        </div>

      </section>

      {/* CTA */}
      <section className="final-section">

        <div className="final-logo">
          <img
            src="/logo.png"
            alt="Fades"
          />
        </div>

        <h2>
          Make more with Fades.
        </h2>

        <p>
          Upgrade to Pro and get more room for
          everything you're already using Fades for.
        </p>

        <button
          className="final-button"
          onClick={handleUpgrade}
        >
          Get Fades Pro
          <span>→</span>
        </button>

      </section>

      {/* Footer */}
      <footer className="pro-footer">

        <div className="footer-brand">
          <img
            src="/logo.png"
            alt="Fades"
          />

          <span>
            fades
          </span>
        </div>

        <div className="footer-links">
          <Link href="/">
            Home
          </Link>

          <Link href="/settings">
            Settings
          </Link>
        </div>

        <div className="copyright">
          © {new Date().getFullYear()} Fades
        </div>

      </footer>

    </main>
  );
}
