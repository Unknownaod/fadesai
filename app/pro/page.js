"use client";

import { useState } from "react";
import Link from "next/link";
import "./pro.css";

const features = [
  {
    title: "Higher limits",
    description: "Get substantially more AI usage than the free plan.",
  },
  {
    title: "Priority access",
    description: "Your requests get priority during busy periods.",
  },
  {
    title: "Longer conversations",
    description: "Keep more context available during extended chats.",
  },
  {
    title: "Faster responses",
    description: "Designed for a smoother experience when you're using Fades heavily.",
  },
  {
    title: "Premium experience",
    description: "Unlock the full Fades experience without the basic-plan restrictions.",
  },
  {
    title: "Built for power users",
    description: "More room to use Fades for work, studying, coding, and everyday questions.",
  },
];

export default function ProPage() {
  const [billing, setBilling] = useState("monthly");

  const monthlyPrice = 9.99;
  const yearlyPrice = 99.99;

  const price =
    billing === "monthly"
      ? monthlyPrice
      : (yearlyPrice / 12).toFixed(2);

  function handleUpgrade() {
    // Stripe checkout will be connected here.
    alert("Stripe checkout will be connected here.");
  }

  return (
    <main className="pro-page">
      <nav className="pro-nav">
        <Link href="/" className="pro-brand">
          <img src="/logo.png" alt="Fades" />
          <span>fades</span>
        </Link>

        <Link href="/" className="back-link">
          Back to Fades
        </Link>
      </nav>

      <section className="pro-hero">
        <div className="pro-badge">
          <span className="badge-dot" />
          Fades Pro
        </div>

        <h1>
          More Fades.
          <br />
          <span>Less limits.</span>
        </h1>

        <p className="hero-description">
          Get more from Fades with higher usage limits,
          priority access, longer conversations, and a
          premium AI experience.
        </p>

        <div className="billing-toggle">
          <button
            className={billing === "monthly" ? "active" : ""}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>

          <button
            className={billing === "yearly" ? "active" : ""}
            onClick={() => setBilling("yearly")}
          >
            Yearly
            <span>Save</span>
          </button>
        </div>

        <div className="pricing-card">
          <div className="pricing-top">
            <div>
              <div className="plan-name">Fades Pro</div>
              <div className="plan-subtitle">
                For people who use Fades more.
              </div>
            </div>

            <div className="price">
              <strong>${price}</strong>
              <span>/ month</span>
            </div>
          </div>

          {billing === "yearly" && (
            <div className="yearly-note">
              Billed ${yearlyPrice} annually.
            </div>
          )}

          <button
            className="upgrade-button"
            onClick={handleUpgrade}
          >
            Upgrade to Pro
            <span>→</span>
          </button>

          <div className="secure-note">
            Secure checkout powered by Stripe
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-heading">
          <span>WHAT YOU GET</span>
          <h2>Built for more.</h2>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="feature-icon">
                ✓
              </div>

              <h3>{feature.title}</h3>

              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="comparison-section">
        <div className="comparison-card">
          <div className="comparison-header">
            <div />
            <div>Free</div>
            <div className="pro-column">Pro</div>
          </div>

          <ComparisonRow
            label="AI access"
            free="Standard"
            pro="Priority"
          />

          <ComparisonRow
            label="Usage limits"
            free="Standard"
            pro="Higher"
          />

          <ComparisonRow
            label="Long conversations"
            free="Limited"
            pro="Extended"
          />

          <ComparisonRow
            label="Priority access"
            free="—"
            pro="✓"
          />

          <ComparisonRow
            label="Premium experience"
            free="—"
            pro="✓"
          />
        </div>
      </section>

      <section className="final-cta">
        <h2>Ready for more?</h2>
        <p>
          Upgrade whenever you're ready. Your account stays
          yours, and you can manage your subscription anytime.
        </p>

        <button
          className="upgrade-button small"
          onClick={handleUpgrade}
        >
          Get Fades Pro
          <span>→</span>
        </button>
      </section>

      <footer className="pro-footer">
        <span>© {new Date().getFullYear()} Fades</span>

        <div>
          <Link href="/">Home</Link>
          <Link href="/settings">Settings</Link>
        </div>
      </footer>
    </main>
  );
}

function ComparisonRow({ label, free, pro }) {
  return (
    <div className="comparison-row">
      <div>{label}</div>
      <div>{free}</div>
      <div className="pro-column">{pro}</div>
    </div>
  );
}
