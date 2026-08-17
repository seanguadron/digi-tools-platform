"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CardArtCropper } from "@/components/card-art-cropper";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { getFloatingPanelPosition } from "@/lib/floating-panel-position";

const LIVE_SIZE = 1024;
const WEBP_QUALITY = 0.92;

type Variant = { id: string; letter: string; cropped: boolean; file: string };

type Entry = {
  key: string;
  sequence: number;
  name: string;
  group: string;
  later: boolean;
  owner: string;
  fileName: string;
  target: string;
  status: string;
  prompt: string;
  variants: Variant[];
};

type Manifest = {
  theme: string;
  style: string;
  entries: Entry[];
  progress: { generated: number; total: number };
};

function isVariant(value: unknown): value is Variant {
  const candidate = value as Partial<Variant> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.file === "string"
  );
}

function isEntry(value: unknown): value is Entry {
  const candidate = value as Partial<Entry> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.key === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.target === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.sequence === "number" &&
    Array.isArray(candidate.variants) &&
    candidate.variants.every(isVariant)
  );
}

function isManifest(value: unknown): value is Manifest {
  const candidate = value as Partial<Manifest> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.style === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isEntry) &&
    typeof candidate.progress?.total === "number"
  );
}

function variantUrl(theme: string, key: string, variantId: string) {
  const params = new URLSearchParams({ theme, key, variant: variantId });
  return `/api/card-art?${params.toString()}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the pasted image"));
    reader.readAsDataURL(file);
  });
}

// The live card image is always a square webp: load the chosen variant, take
// the largest centered square it contains, and re-encode. Anything already
// square (a Higgsfield 1:1 or one of our crops) is a straight resize.
function toLiveWebp(url: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onerror = () => reject(new Error("Could not read the variant image"));
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = LIVE_SIZE;
      canvas.height = LIVE_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is unavailable"));
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        LIVE_SIZE,
        LIVE_SIZE,
      );
      resolve(canvas.toDataURL("image/webp", WEBP_QUALITY));
    };
    image.src = url;
  });
}

export function CardArtStudio({ themes }: { themes: string[] }) {
  const [theme, setTheme] = useState(themes[0] ?? "sci-fi");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [message, setMessage] = useState("Loading the art pack…");
  const [busy, setBusy] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [cropping, setCropping] = useState<{ key: string; variantId: string } | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showLater, setShowLater] = useState(false);
  // Bumped after every write so <img> tags refetch instead of showing a stale
  // cached variant at the same URL.
  const [revision, setRevision] = useState(0);
  // Hovering a thumbnail or a variant chip opens a preview. The toggle picks
  // its shape: the whole card as it will look, or just the image blown up.
  const [peekAsCard, setPeekAsCard] = useState(true);
  const [zoomPeek, setZoomPeek] = useState<{
    url: string;
    label: string;
    name: string;
    code: string;
    left: number;
    top: number;
  } | null>(null);
  const portalTarget = usePortalTarget();

  const refresh = useCallback(
    async (nextTheme: string) => {
      const response = await fetch(`/api/card-art?theme=${encodeURIComponent(nextTheme)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not load the ${nextTheme} pack`);
      }
      // Shape-check before use rather than casting: this crosses the
      // browser boundary like any other external payload (STANDARDS §2.3).
      const payload: unknown = await response.json();
      if (!isManifest(payload)) {
        throw new Error("The card art service returned something unreadable");
      }
      setManifest(payload);
      setRevision((current) => current + 1);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    // Deferred like the other tools' first loads, so nothing sets state
    // during the effect body.
    const timer = window.setTimeout(() => {
      refresh(theme)
        .then(() => {
          if (!cancelled) {
            setMessage("");
          }
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setMessage(error.message);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refresh, theme]);

  const send = useCallback(
    async (body: Record<string, unknown>, success: string) => {
      setBusy(true);
      try {
        const response = await fetch("/api/card-art", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ theme, ...body }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "That did not work");
        }
        await refresh(theme);
        setMessage(success);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "That did not work");
      } finally {
        setBusy(false);
      }
    },
    [refresh, theme],
  );

  const entries = useMemo(() => manifest?.entries ?? [], [manifest]);
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? null;

  const addVariant = useCallback(
    async (key: string, file: File) => {
      const dataUrl = await fileToDataUrl(file);
      await send({ key, op: "add-variant", dataUrl }, `Added a variant to ${key}.`);
    },
    [send],
  );

  // Paste anywhere once a row is armed — the Higgsfield loop is copy image,
  // alt-tab, Ctrl+V, so a per-row input would just add a click.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (!activeKey || busy) {
        return;
      }
      const file = Array.from(event.clipboardData?.files ?? []).find((candidate) =>
        candidate.type.startsWith("image/"),
      );
      if (!file) {
        return;
      }
      event.preventDefault();
      void addVariant(activeKey, file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeKey, addVariant, busy]);

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const entry of entries) {
      if (!seen.includes(entry.group)) {
        seen.push(entry.group);
      }
    }
    return seen;
  }, [entries]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!showLater && entry.later) {
        return false;
      }
      if (group !== "all" && entry.group !== group) {
        return false;
      }
      if (onlyMissing && entry.status === "generated") {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${entry.sequence} ${entry.name} ${entry.fileName}`
        .toLowerCase()
        .includes(query);
    });
  }, [entries, group, onlyMissing, search, showLater]);

  async function copyPrompt(entry: Entry) {
    if (!manifest) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${manifest.style}\n\n${entry.prompt}`);
      setMessage(`Copied the prompt for ${entry.fileName}.`);
    } catch {
      setMessage("Could not copy the prompt.");
    }
  }

  async function makeLive(entry: Entry, variantId: string) {
    try {
      setBusy(true);
      const dataUrl = await toLiveWebp(
        `${variantUrl(theme, entry.key, variantId)}&v=${revision}`,
      );
      setBusy(false);
      await send(
        { key: entry.key, op: "select", variantId, dataUrl },
        `${entry.fileName} is live on the card.`,
      );
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Could not build the card image");
    }
  }

  const progress = manifest?.progress;

  // What the row's thumbnail shows: the image actually on the card once one
  // is live, otherwise the first candidate so progress reads at a glance.
  function thumbnailFor(entry: Entry) {
    if (entry.status === "generated") {
      return `${entry.target}?v=${revision}`;
    }
    const first = entry.variants[0];
    return first ? `${variantUrl(theme, entry.key, first.id)}&v=${revision}` : null;
  }

  return (
    <div className="card-art-studio">
      <header className="card-art-studio-head">
        <div>
          <span className="card-art-kicker">Card Art Studio</span>
          <h1>Paste, pick, and place card art</h1>
          <p>
            Development-only. Images land in <code>card-art-source/</code>, and the
            one you choose is written as webp where the catalog expects it.
          </p>
        </div>
        <div className="card-art-progress">
          <strong>
            {progress ? `${progress.generated}/${progress.total}` : "—"}
          </strong>
          <small>cards with art</small>
        </div>
      </header>

      <div className="card-art-controls">
        <label className="field">
          <span>Pack</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {themes.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Group</span>
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">All groups</option>
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field card-art-search">
          <span>Find</span>
          <input
            type="search"
            value={search}
            placeholder="Name or file"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="card-art-toggle">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(event) => setOnlyMissing(event.target.checked)}
          />
          <span>Needs art only</span>
        </label>
        <label className="card-art-toggle">
          <input
            type="checkbox"
            checked={showLater}
            onChange={(event) => setShowLater(event.target.checked)}
          />
          <span>Include grade variants</span>
        </label>
        <label className="card-art-toggle">
          <input
            type="checkbox"
            checked={peekAsCard}
            onChange={(event) => setPeekAsCard(event.target.checked)}
          />
          <span>Hover shows the card</span>
        </label>
      </div>

      <div className="card-art-paste-bar" aria-live="polite">
        {activeEntry ? (
          <>
            <strong>Ready for {activeEntry.fileName}</strong>
            <span>Copy an image in Higgsfield, then press Ctrl+V anywhere here.</span>
          </>
        ) : (
          <span>Select a card below, then paste an image with Ctrl+V.</span>
        )}
        {message ? <em>{message}</em> : null}
      </div>

      <ol className="card-art-rows">
        {visible.map((entry) => {
          const isActive = entry.key === activeKey;
          const chosen = preview[entry.key] ?? entry.variants[0]?.id ?? null;
          const thumb = thumbnailFor(entry);

          return (
            <li
              className={[
                "card-art-row",
                isActive ? "is-active" : "",
                entry.status === "generated" ? "is-done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={entry.key}
            >
              <button
                className="card-art-row-main"
                type="button"
                onClick={() => setActiveKey(isActive ? null : entry.key)}
                aria-expanded={isActive}
              >
                <span className="card-art-seq">
                  {String(entry.sequence).padStart(3, "0")}
                </span>
                <span
                  className={
                    thumb ? "card-art-thumb has-image" : "card-art-thumb"
                  }
                  onMouseEnter={(event) => {
                    if (!thumb) {
                      return;
                    }
                    setZoomPeek({
                      url: thumb,
                      label: entry.fileName,
                      name: entry.name,
                      code: String(entry.sequence).padStart(3, "0"),
                      ...getFloatingPanelPosition(event.currentTarget),
                    });
                  }}
                  onMouseLeave={() => setZoomPeek(null)}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={thumb} />
                  ) : null}
                </span>
                <span className="card-art-identity">
                  <strong>{entry.name}</strong>
                  <small>{entry.fileName}</small>
                </span>
                <span className="card-art-count">
                  {entry.variants.length > 0 ? `${entry.variants.length}` : "—"}
                </span>
                <span
                  className={
                    entry.status === "generated"
                      ? "card-art-status is-done"
                      : "card-art-status"
                  }
                >
                  {entry.status === "generated" ? "live" : entry.status}
                </span>
              </button>

              {isActive ? (
                <div className="card-art-detail">
                  <div className="card-art-detail-prompt">
                    <p>{entry.prompt}</p>
                    <div className="card-art-detail-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void copyPrompt(entry)}
                      >
                        Copy full prompt
                      </button>
                      {entry.status === "generated" ? (
                        <button
                          className="button button-quiet"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void send(
                              { key: entry.key, op: "clear" },
                              `${entry.fileName} is back to a placeholder.`,
                            )
                          }
                        >
                          Remove from card
                        </button>
                      ) : null}
                    </div>
                    <code>public{entry.target}</code>
                  </div>

                  {entry.variants.length === 0 ? (
                    <p className="card-art-empty">
                      No images yet. Press Ctrl+V to paste one.
                    </p>
                  ) : (
                    <div className="card-art-variants">
                      <div className="card-art-variant-strip">
                        {entry.variants.map((variant) => (
                          <button
                            className={
                              variant.id === chosen
                                ? "card-art-chip is-chosen"
                                : "card-art-chip"
                            }
                            type="button"
                            key={variant.id}
                            onClick={() =>
                              setPreview((current) => ({
                                ...current,
                                [entry.key]: variant.id,
                              }))
                            }
                            onMouseEnter={(event) =>
                              setZoomPeek({
                                url: `${variantUrl(theme, entry.key, variant.id)}&v=${revision}`,
                                label: `${entry.fileName.replace(/\.[a-z0-9]+$/i, "")}-${variant.id}`,
                                name: entry.name,
                                code: String(entry.sequence).padStart(3, "0"),
                                ...getFloatingPanelPosition(event.currentTarget),
                              })
                            }
                            onMouseLeave={() => setZoomPeek(null)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt=""
                              src={`${variantUrl(theme, entry.key, variant.id)}&v=${revision}`}
                            />
                            <span>{variant.id}</span>
                          </button>
                        ))}
                      </div>

                      {chosen ? (
                        <div className="card-art-chosen">
                          <div className="card-art-card-preview">
                            <div className="lineage-card is-selected">
                              <span className="lineage-card-topline">
                                <span>Preview</span>
                                <span>{String(entry.sequence).padStart(3, "0")}</span>
                              </span>
                              <span className="lineage-card-art card-illustration-frame has-generated-image">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  className="card-illustration-image"
                                  alt=""
                                  src={`${variantUrl(theme, entry.key, chosen)}&v=${revision}`}
                                />
                              </span>
                              <span className="lineage-card-copy">
                                <strong>{entry.name}</strong>
                              </span>
                            </div>
                            <small>How it reads on the card</small>
                          </div>

                          <div className="card-art-chosen-actions">
                            <button
                              className="button button-primary"
                              type="button"
                              disabled={busy}
                              onClick={() => void makeLive(entry, chosen)}
                            >
                              Use this on the card
                            </button>
                            <button
                              className="button button-secondary"
                              type="button"
                              disabled={busy || chosen.includes("_cropped")}
                              onClick={() =>
                                setCropping({ key: entry.key, variantId: chosen })
                              }
                            >
                              Crop
                            </button>
                            <button
                              className="button button-quiet"
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void send(
                                  {
                                    key: entry.key,
                                    op: "delete-variant",
                                    variantId: chosen,
                                  },
                                  `Deleted variant ${chosen}.`,
                                )
                              }
                            >
                              Delete variant
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="card-art-empty-row">Nothing matches those filters.</li>
        ) : null}
      </ol>

      {portalTarget && zoomPeek
        ? createPortal(
            <aside
              className={
                peekAsCard ? "card-art-peek is-card" : "card-art-peek"
              }
              style={{ left: zoomPeek.left, top: zoomPeek.top }}
              aria-hidden="true"
            >
              {peekAsCard ? (
                <div className="lineage-card is-selected card-art-peek-card">
                  <span className="lineage-card-topline">
                    <span>Card</span>
                    <span>{zoomPeek.code}</span>
                  </span>
                  <span className="lineage-card-art card-illustration-frame has-generated-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="card-illustration-image" alt="" src={zoomPeek.url} />
                  </span>
                  <span className="lineage-card-copy">
                    <strong>{zoomPeek.name}</strong>
                  </span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={zoomPeek.url} />
              )}
              <small>{zoomPeek.label}</small>
            </aside>,
            portalTarget,
          )
        : null}

      {cropping ? (
        <div className="card-art-crop-layer" role="dialog" aria-modal="true">
          <CardArtCropper
            src={`${variantUrl(theme, cropping.key, cropping.variantId)}&v=${revision}`}
            fileName={
              entries.find((entry) => entry.key === cropping.key)?.fileName ?? ""
            }
            busy={busy}
            onCancel={() => setCropping(null)}
            onSave={(dataUrl) => {
              const target = cropping;
              setCropping(null);
              void send(
                {
                  key: target.key,
                  op: "crop",
                  variantId: target.variantId,
                  dataUrl,
                },
                `Saved a crop of ${target.variantId}.`,
              );
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
