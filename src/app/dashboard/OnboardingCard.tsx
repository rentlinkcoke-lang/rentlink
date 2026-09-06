"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OnboardingState } from "@/lib/onboarding";
import { seedSampleAction, clearSampleAction } from "./actions";

export default function OnboardingCard({ state }: { state: OnboardingState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const steps = [
    { done: state.hasProperty, label: "Add your first property", hint: "It gets a code that prefixes every unit's M-Pesa reference.", href: "/dashboard/properties" },
    { done: state.hasUnit, label: "Add units", hint: "Each unit gets its own unique M-Pesa account number automatically.", href: "/dashboard/properties" },
    { done: state.hasTenant, label: "Add a tenant", hint: "RentLink bills their first month the moment you assign them.", href: "/dashboard/properties" },
    { done: state.hasReconciled, label: "See a payment reconcile", hint: "Watch a payment match itself to the right unit, tenant and month.", href: "/dashboard/simulate" },
  ];
  const nextStep = steps.find((s) => !s.done);

  function seed() {
    setError("");
    start(async () => {
      const res = await seedSampleAction();
      if (!res.ok) setError(res.error || "Couldn't add sample data.");
      else router.refresh();
    });
  }
  function clear() {
    start(async () => {
      await clearSampleAction();
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="h2">{state.hasSample ? "Exploring with sample data" : "Get started with RentLink"}</div>
          <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>
            {state.hasSample
              ? "This is demo data so you can see the whole loop — clear it when you're ready for your real properties."
              : "Four steps to your first self-reconciling payment."}
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
            <span className="faint">Progress</span>
            <span style={{ fontWeight: 700, color: "var(--brand-dark)" }}>{state.done} of {state.total}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
            <div style={{ width: `${(state.done / state.total) * 100}%`, height: "100%", background: "var(--brand)", transition: "width .3s" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "6px 20px" }}>
        {steps.map((s, i) => {
          const isNext = s === nextStep;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 0", borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: 999, flexShrink: 0, marginTop: 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: s.done ? "var(--brand)" : "transparent",
                  border: s.done ? "none" : "2px solid var(--border)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                }}
              >
                {s.done ? "✓" : ""}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: s.done ? "var(--ink-faint)" : "var(--ink)", textDecoration: s.done ? "line-through" : "none" }}>
                  {s.label}
                </div>
                {!s.done && <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{s.hint}</div>}
              </div>
              {!s.done && (
                <Link href={s.href} className={isNext ? "btn btn-primary" : "btn btn-ghost"} style={{ fontSize: 12.5, padding: "6px 12px", flexShrink: 0 }}>
                  {isNext ? "Start →" : "Go"}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {(state.isEmpty || state.hasSample) && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          {state.hasSample ? (
            <>
              <div className="faint" style={{ fontSize: 13 }}>You&rsquo;re exploring with sample data.</div>
              <button className="btn btn-ghost" style={{ fontSize: 13, color: "var(--red)" }} onClick={clear} disabled={pending}>
                {pending ? "Clearing…" : "Clear sample data"}
              </button>
            </>
          ) : (
            <>
              <div className="faint" style={{ fontSize: 13 }}>Want to look around first? Load a filled demo account in one click.</div>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={seed} disabled={pending}>
                {pending ? "Adding…" : "Try with sample data"}
              </button>
            </>
          )}
        </div>
      )}
      {error && <div style={{ padding: "0 20px 14px" }}><span className="badge badge-red">{error}</span></div>}
    </div>
  );
}
