"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./pro.css";

const API_URL = "https://api.fades.lol";

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

  const [isLoading, setIsLoading] =
    useState(false);

  const [isCheckingAccount, setIsCheckingAccount] =
    useState(true);

  const [isPro, setIsPro] =
    useState(false);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

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

  /*
  =========================================================
  CHECK CURRENT ACCOUNT
  =========================================================
  */

  useEffect(() => {
    let cancelled = false;

    async function checkAccount() {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setIsLoggedIn(false);
          setIsPro(false);
          return;
        }

        if (!response.ok) {
          setIsLoggedIn(false);
          setIsPro(false);
          return;
        }

        const data =
          await response.json();

        /*
        ---------------------------------------------------
        Support either:

        {
          user: {...}
        }

        or:

        {
          success: true,
          user: {...}
        }

        ---------------------------------------------------
        */

        const user =
          data?.user || data;

        setIsLoggedIn(
          Boolean(user?.id)
        );

        setIsPro(
          user?.plan === "pro"
        );
      } catch (error) {
        console.error(
          "[FADES PRO] Account check failed:",
          error
        );

        if (!cancelled) {
          setIsLoggedIn(false);
          setIsPro(false);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingAccount(false);
        }
      }
    }

    checkAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
  =========================================================
  STRIPE CHECKOUT
  =========================================================
  */

  const handleUpgrade = async () => {
    if (isLoading) {
      return;
    }

    /*
    -------------------------------------------------------
    Already subscribed
    -------------------------------------------------------
    */

    if (isPro) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `${API_URL}/billing/checkout`,
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            billing,
          }),
        }
      );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "The billing server returned an invalid response."
        );
      }

      /*
      -------------------------------------------------------
      Not logged in
      -------------------------------------------------------
      */

      if (response.status === 401) {
        alert(
          "Please log in to your Fades account before upgrading to Pro."
        );

        setIsLoading(false);

        return;
      }

      /*
      -------------------------------------------------------
      Already subscribed
      -------------------------------------------------------
      */

      if (
        response.status === 400 &&
        data?.error
          ?.toLowerCase()
          .includes("already")
      ) {
        setIsPro(true);

        alert(
          "Your account already has Fades Pro."
        );

        setIsLoading(false);

        return;
      }

      /*
      -------------------------------------------------------
      Backend error
      -------------------------------------------------------
      */

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to start Fades Pro checkout."
        );
      }

      /*
      -------------------------------------------------------
      Stripe checkout URL
      -------------------------------------------------------
      */

      if (!data?.url) {
        throw new Error(
          "Stripe did not return a checkout URL."
        );
      }

      /*
      -------------------------------------------------------
      Redirect to Stripe
      -------------------------------------------------------
      */

      window.location.href =
        data.url;
    } catch (error) {
      console.error(
        "[FADES PRO] Checkout failed:",
        error
      );

      alert(
        error?.message ||
          "Unable to start checkout. Please try again."
      );

      setIsLoading(false);
    }
  };

  /*
  =========================================================
  STRIPE CUSTOMER PORTAL
  =========================================================
  */

  const handlePortal = async () => {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `${API_URL}/billing/portal`,
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "The billing server returned an invalid response."
        );
      }

      /*
      -------------------------------------------------------
      Not logged in
      -------------------------------------------------------
      */

      if (response.status === 401) {
        alert(
          "Please log in to manage your subscription."
        );

        setIsLoading(false);

        return;
      }

      /*
      -------------------------------------------------------
      No Stripe customer
      -------------------------------------------------------
      */

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to open subscription management."
        );
      }

      /*
      -------------------------------------------------------
      Stripe portal URL
      -------------------------------------------------------
      */

      if (!data?.url) {
        throw new Error(
          "Stripe did not return a portal URL."
        );
      }

      /*
      -------------------------------------------------------
      Redirect to Stripe Customer Portal
      -------------------------------------------------------
      */

      window.location.href =
        data.url;
    } catch (error) {
      console.error(
        "[FADES PRO] Portal failed:",
        error
      );

      alert(
        error?.message ||
          "Unable to open subscription management."
      );

      setIsLoading(false);
    }
  };

  /*
  =========================================================
  PRIMARY ACTION
  =========================================================
  */

  const primaryAction = isPro
    ? handlePortal
    : handleUpgrade;

  const primaryButtonText =
    isCheckingAccount
      ? "Checking account..."
      : isLoading
      ? isPro
        ? "Opening portal..."
        : "Opening checkout..."
      : isPro
      ? "Manage Subscription"
      : "Get Fades Pro";

  return (
    <main className="pro-page">
      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div className="background-grid" />
      <div className="background-noise" />

      <div className="background-glow background-glow-top" />
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-bottom" />

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <header className="pro-nav">
        <Link
          href="/"
          className="brand-name"
          aria-label="Fades home"
        >
          <span className="brand-mark">
            <img
              src="/logo.png"
              alt=""
            />
          </span>

          <span>fades</span>
        </Link>

        <Link
          href="/"
          className="back-link"
        >
          <span
            className="back-arrow"
            aria-hidden="true"
          >
            ←
          </span>

          <span>Back to Fades</span>
        </Link>
      </header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />

            <span>Fades Pro</span>

            <span className="eyebrow-line" />

            <span className="eyebrow-status">
              {isCheckingAccount
                ? "Checking account"
                : isPro
                ? "Active subscription"
                : "Available now"}
            </span>
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

          {/* =================================================
              SUBSCRIPTION STATUS
          ================================================= */}

          {!isCheckingAccount &&
            isPro && (
              <div className="pro-status-card">
                <div className="pro-status-icon">
                  ✓
                </div>

                <div className="pro-status-content">
                  <strong>
                    You&apos;re subscribed to Fades Pro
                  </strong>

                  <span>
                    Your Pro subscription is active.
                    Manage billing, payment methods,
                    or cancellation through Stripe.
                  </span>
                </div>
              </div>
            )}

          {/* =================================================
              BILLING TOGGLE
          ================================================= */}

          {!isPro && (
            <div className="billing-wrapper">
              <div
                className="billing-control"
                role="group"
                aria-label="Billing period"
              >
                <button
                  type="button"
                  className={
                    billing === "monthly"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setBilling("monthly")
                  }
                  aria-pressed={
                    billing === "monthly"
                  }
                  disabled={isLoading}
                >
                  Monthly
                </button>

                <button
                  type="button"
                  className={
                    billing === "yearly"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setBilling("yearly")
                  }
                  aria-pressed={
                    billing === "yearly"
                  }
                  disabled={isLoading}
                >
                  Yearly

                  <span>Save 17%</span>
                </button>
              </div>
            </div>
          )}

          {/* =================================================
              PRICING CARD
          ================================================= */}

          <div className="pricing-card">
            <div
              className="pricing-card-glow"
              aria-hidden="true"
            />

            <div className="pricing-card-topline">
              <div className="plan-name">
                <span className="plan-dot" />

                FADES PRO
              </div>

              <span className="popular-badge">
                PRO
              </span>
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
                  A premium Fades experience with more
                  capacity, more context, and priority access.
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

            {billing === "yearly" &&
              !isPro && (
                <div className="billing-note">
                  <Check />

                  <span>
                    Billed $
                    {yearlyPrice.toFixed(
                      2
                    )}
                    {" "}
                    USD yearly
                    <strong>
                      {" "}
                      · Save $
                      {yearlySavings}
                    </strong>
                  </span>
                </div>
              )}

            {isPro && (
              <div className="billing-note">
                <Check />

                <span>
                  Your Fades Pro subscription is
                  <strong> active</strong>
                </span>
              </div>
            )}

            <div className="card-divider" />

            {/* =================================================
                INCLUDED
            ================================================= */}

            <div className="included">
              <div className="included-heading">
                <span>
                  WHAT&apos;S INCLUDED
                </span>

                <span className="included-count">
                  04
                </span>
              </div>

              <div className="included-list">
                <div>
                  <Check />

                  <span>
                    Higher AI usage limits
                  </span>
                </div>

                <div>
                  <Check />

                  <span>
                    Extended conversation context
                  </span>
                </div>

                <div>
                  <Check />

                  <span>
                    Priority access during high demand
                  </span>
                </div>

                <div>
                  <Check />

                  <span>
                    Premium Fades experience
                  </span>
                </div>
              </div>
            </div>

            {/* =================================================
                PRIMARY BILLING BUTTON
            ================================================= */}

            <button
              type="button"
              className="primary-button"
              onClick={primaryAction}
              disabled={
                isLoading ||
                isCheckingAccount
              }
            >
              <span>
                {primaryButtonText}
              </span>

              <span
                className="button-arrow"
                aria-hidden="true"
              >
                {isLoading
                  ? "…"
                  : isPro
                  ? "↗"
                  : "↗"}
              </span>
            </button>

            <div className="secure-note">
              <span
                className="secure-icon"
                aria-hidden="true"
              >
                ✓
              </span>

              <span>
                {isPro
                  ? "Manage through Stripe"
                  : "Secure checkout"}
              </span>

              <span
                className="secure-dot"
                aria-hidden="true"
              >
                ·
              </span>

              <span>
                {isPro
                  ? "Cancel anytime"
                  : "Cancel anytime"}
              </span>
            </div>
          </div>

          <div className="hero-footnote">
            <span>
              {isPro
                ? "Your subscription is active"
                : "No complicated setup"}
            </span>

            <span
              className="footnote-separator"
              aria-hidden="true"
            >
              ·
            </span>

            <span>
              One Fades account
            </span>

            <span
              className="footnote-separator"
              aria-hidden="true"
            >
              ·
            </span>

            <span>
              {isPro
                ? "Manage your subscription anytime"
                : "Upgrade when you're ready"}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY PRO
      ===================================================== */}

      <section className="statement-section">
        <div className="section-line" />

        <div className="statement-grid">
          <div className="section-label">
            <span className="label-number">
              01
            </span>

            <span>WHY PRO</span>
          </div>

          <div className="statement-content">
            <h2>
              Fades should
              <br />
              <span>keep up with you.</span>
            </h2>

            <p>
              Pro gives you more room to work without
              changing the Fades experience you already know.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section className="features-section">
        <div className="section-heading">
          <div className="section-label">
            <span className="label-number">
              02
            </span>

            <span>PRO FEATURES</span>
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
          {features.map(
            (feature) => (
              <article
                className="feature-card"
                key={feature.number}
              >
                <div className="feature-top">
                  <div className="feature-number">
                    {feature.number}
                  </div>

                  <div
                    className="feature-mark"
                    aria-hidden="true"
                  >
                    ↗
                  </div>
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
                  className="feature-bottom-line"
                  aria-hidden="true"
                />
              </article>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          PLAN COMPARISON
      ===================================================== */}

      <section className="comparison-section">
        <div className="section-heading centered">
          <div className="section-label">
            <span className="label-number">
              03
            </span>

            <span>PLANS</span>
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
            <div>
              Conversation context
            </div>

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
            <div>
              Premium experience
            </div>

            <div>
              <Check muted />
            </div>

            <div className="pro-column">
              <Check />
            </div>
          </div>

          <div className="comparison-footer">
            <span>
              {isPro
                ? "Already subscribed?"
                : "Need more?"}
            </span>

            <button
              type="button"
              onClick={
                isPro
                  ? handlePortal
                  : handleUpgrade
              }
              disabled={
                isLoading ||
                isCheckingAccount
              }
            >
              {isLoading
                ? "Opening..."
                : isPro
                ? "Manage Subscription"
                : "Upgrade to Pro"}

              <span aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="final-section">
        <div className="final-orb">
          <div
            className="final-orb-ring"
            aria-hidden="true"
          />

          <div className="final-orb-inner">
            <img
              src="/logo.png"
              alt="Fades"
            />
          </div>
        </div>

        <div className="section-label">
          <span className="label-number">
            04
          </span>

          <span>FADE INTO MORE</span>
        </div>

        <h2>
          {isPro ? (
            <>
              You&apos;re already
              <br />
              <span>with Fades Pro.</span>
            </>
          ) : (
            <>
              Keep going
              <br />
              <span>with Fades.</span>
            </>
          )}
        </h2>

        <p>
          {isPro ? (
            <>
              Your Pro subscription is active.
              <br />
              Manage your subscription whenever you need.
            </>
          ) : (
            <>
              More room for questions, ideas, projects,
              <br />
              and everything in between.
            </>
          )}
        </p>

        <button
          type="button"
          className="final-button"
          onClick={
            isPro
              ? handlePortal
              : handleUpgrade
          }
          disabled={
            isLoading ||
            isCheckingAccount
          }
        >
          {isLoading
            ? "Opening..."
            : isPro
            ? "Manage Subscription"
            : "Get Fades Pro"}

          <span aria-hidden="true">
            ↗
          </span>
        </button>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="pro-footer">
        <Link
          href="/"
          className="footer-brand"
        >
          <span className="footer-logo">
            <img
              src="/logo.png"
              alt=""
            />
          </span>

          <span>fades</span>
        </Link>

        <nav
          className="footer-links"
          aria-label="Footer navigation"
        >
          <Link href="/">
            Home
          </Link>

          <Link href="/settings">
            Settings
          </Link>

          <Link href="/privacy">
            Privacy
          </Link>

          <Link href="/terms">
            Terms
          </Link>
        </nav>

        <div className="footer-copy">
          © {new Date().getFullYear()} Fades
        </div>
      </footer>
    </main>
  );
}

