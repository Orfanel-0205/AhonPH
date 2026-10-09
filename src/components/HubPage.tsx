"use client";

import { useEffect, useState } from "react";
import { useAiStatus, useOnline } from "./hooks";

const PHASE_TEXT = {
  checking: "Checking local AI…",
  warming: "Loading models into GPU memory…",
  ready: "Local AI ready",
  "missing-models": "Models missing. Run: ollama pull gemma3:4b && ollama pull qwen3-vl:2b",
  "no-ollama": "Ollama is not running. Start the Ollama app.",
  "no-server": "Hub server not responding.",
};

export function HubPage() {
  const { status, phase } = useAiStatus();
  const online = useOnline();
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/hub/info", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { addresses: string[] }) => setAddresses(d.addresses))
      .catch(() => setAddresses([]));
  }, []);

  const ready = phase === "ready";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-brand-strong">
        Lakbay<span className="text-text">Mate</span> Hub
      </h1>
      <p className="mt-2 text-muted">
        Your laptop&apos;s private AI for the LakbayMate phone app. Models run on this computer&apos;s GPU through Ollama. Nothing is sent to the internet.
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ready ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
            {ready ? "✓ " : "… "}
            {PHASE_TEXT[phase]}
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${online ? "bg-info-soft text-info" : "bg-good-soft text-good"}`}>
            {online ? "Internet: connected (not needed)" : "Internet: off — hub still works"}
          </span>
        </div>
        {status?.reachable ? (
          <table className="mt-4 w-full text-left text-sm tabular">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-semibold">Job</th>
                <th className="py-1 font-semibold">Model</th>
                <th className="py-1 font-semibold">Runs on</th>
                <th className="py-1 font-semibold">Memory</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Taglish logging & advisor", status.text],
                ["Receipt vision (high accuracy)", status.vision],
              ].map(([job, m]) => {
                const model = m as typeof status.text;
                return (
                  <tr key={job as string} className="border-t border-border">
                    <td className="py-2">{job as string}</td>
                    <td className="py-2 font-mono">{model.name}</td>
                    <td className="py-2">{model.loaded ? model.processor : "loads on first use"}</td>
                    <td className="py-2">{model.loaded ? `${model.vramMB.toLocaleString("en-US")} MB` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        <p className="mt-3 text-xs text-muted">Ollama endpoint: {status?.endpoint ?? "127.0.0.1:11434"} (this computer only)</p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">Connect your phone</h2>
        <p className="mt-1 text-sm text-muted">Put the phone on the same Wi-Fi or this laptop&apos;s hotspot. In LakbayMate, open LakbayMate AI and type:</p>
        {addresses.length ? (
          <ul className="mt-3 space-y-2">
            {addresses.map((a) => (
              <li key={a} className="rounded-xl bg-brand-soft px-4 py-3 font-mono text-2xl font-bold text-brand-strong">
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-warn">No network address found. Turn on Wi-Fi or a mobile hotspot.</p>
        )}
      </section>
    </main>
  );
}
