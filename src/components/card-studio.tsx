"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardArtCropper } from "@/components/card-art-cropper";
import { EditorTabs, tabPanelProps } from "@/components/editor-tabs";
import { usePortalTarget } from "@/hooks/use-portal-target";
import { getFloatingPanelPosition } from "@/lib/floating-panel-position";
import { revealElement } from "@/lib/reveal-element";
import { MAX_BIO_LENGTH } from "../../scripts/art-pack.mjs";

const LIVE_SIZE = 1024;
const WEBP_QUALITY = 0.92;

// A card has two halves. CARD_FACET is what the card IS - universal, one
// truth. Every other facet is a world: the same card's picture and bio in
// sci-fi, in fantasy, in whatever comes next.
const CARD_FACET = "card";

type Variant = { id: string; letter: string; cropped: boolean; file: string };

type RelatedLink = { key?: string; label: string };
type RelatedGroup = { label: string; items: RelatedLink[] };

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
  bio: string;
  related: RelatedGroup[];
  variants: Variant[];
};

type Manifest = {
  theme: string;
  style: string;
  entries: Entry[];
  progress: { generated: number; total: number };
};

type PackSummary = {
  id: string;
  name: string;
  installed: boolean;
  draft: boolean;
  generated: number;
  total: number;
};

type CardField = {
  id: string;
  label: string;
  kind: "line" | "text" | "list";
  hint?: string;
  value: string | string[];
};

type CardRecord = {
  key: string;
  kind: string;
  hasRecord: boolean;
  fields: CardField[];
  structural: { label: string; value: string }[];
  note: string;
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

function isRelatedGroup(value: unknown): value is RelatedGroup {
  const candidate = value as Partial<RelatedGroup> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.label === "string" &&
    Array.isArray(candidate.items) &&
    candidate.items.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RelatedLink).label === "string" &&
        ((item as RelatedLink).key === undefined ||
          typeof (item as RelatedLink).key === "string"),
    )
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
    typeof candidate.bio === "string" &&
    typeof candidate.sequence === "number" &&
    Array.isArray(candidate.related) &&
    candidate.related.every(isRelatedGroup) &&
    Array.isArray(candidate.variants) &&
    candidate.variants.every(isVariant)
  );
}

function isManifest(value: unknown): value is Manifest {
  const candidate = value as Partial<Manifest> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.theme === "string" &&
    typeof candidate.style === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isEntry) &&
    typeof candidate.progress?.total === "number" &&
    typeof candidate.progress?.generated === "number"
  );
}

function isCardField(value: unknown): value is CardField {
  const candidate = value as Partial<CardField> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    (candidate.kind === "line" || candidate.kind === "text" || candidate.kind === "list") &&
    (typeof candidate.value === "string" ||
      (Array.isArray(candidate.value) &&
        candidate.value.every((item) => typeof item === "string")))
  );
}

function isCardRecord(value: unknown): value is CardRecord {
  const candidate = value as Partial<CardRecord> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.key === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.note === "string" &&
    typeof candidate.hasRecord === "boolean" &&
    Array.isArray(candidate.fields) &&
    candidate.fields.every(isCardField) &&
    Array.isArray(candidate.structural) &&
    candidate.structural.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { label?: unknown }).label === "string" &&
        typeof (item as { value?: unknown }).value === "string",
    )
  );
}

function isPackSummaryList(value: unknown): value is PackSummary[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      const candidate = item as Partial<PackSummary> | null;
      return (
        typeof candidate === "object" &&
        candidate !== null &&
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.installed === "boolean" &&
        typeof candidate.draft === "boolean" &&
        typeof candidate.generated === "number" &&
        typeof candidate.total === "number"
      );
    })
  );
}

// A relations group is a labelled set of chips ("Morphs into", "Equips"). The
// label is only next to the chips visually; role="group" + aria-labelledby is
// what carries that grouping to someone browsing by control, who would
// otherwise hear a bare list of card names with no idea what relates them.
function relationsLabelId(entryKey: string, label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `rel-${entryKey.replace(/[^a-zA-Z0-9]+/g, "-")}-${slug}`;
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

function fieldToText(value: string | string[]) {
  return Array.isArray(value) ? value.join("\n") : value;
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

export function CardStudio({
  packs,
  deck = "craft",
}: {
  packs: { id: string; name: string }[];
  // "picture" hides the Card tab (that deck's studio edits art only) and
  // scopes every request to the picture stores on the server.
  deck?: "craft" | "picture";
}) {
  const [theme, setTheme] = useState(packs[0]?.id ?? "sci-fi");
  const [packState, setPackState] = useState<PackSummary[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [message, setMessage] = useState("Loading the deck…");
  const [busy, setBusy] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [facet, setFacet] = useState<string>(packs[0]?.id ?? "sci-fi");
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
  // The Card tab's record and its unsaved edits, loaded per card.
  const [card, setCard] = useState<CardRecord | null>(null);
  const [cardEdits, setCardEdits] = useState<Record<string, string>>({});
  // Unsaved bio text per card, keyed like `preview`, so the saved value stays
  // the default and no effect has to copy it into state.
  const [bioDrafts, setBioDrafts] = useState<Record<string, string>>({});
  const portalTarget = usePortalTarget();

  // Monotonic guard: only the newest load may set the manifest, so a slow
  // response from a pack the user has already left cannot land late and
  // pin the rows to the wrong world.
  const refreshSeq = useRef(0);
  const refresh = useCallback(async (nextTheme: string) => {
    const seq = ++refreshSeq.current;
    const response = await fetch(
      `/api/card-art?theme=${encodeURIComponent(nextTheme)}&deck=${deck}`,
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Could not load the ${nextTheme} pack`);
    }
    // Shape-check before use rather than casting: this crosses the browser
    // boundary like any other external payload (STANDARDS §2.3).
    const payload: unknown = await response.json();
    if (!isManifest(payload)) {
      throw new Error("The card art service returned something unreadable");
    }
    if (seq !== refreshSeq.current) {
      return;
    }
    setManifest(payload);
    setRevision((current) => current + 1);
  }, [deck]);

  const refreshPacks = useCallback(async () => {
    const response = await fetch(`/api/card-art?view=packs&deck=${deck}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | { packs?: unknown }
      | null;
    if (isPackSummaryList(payload?.packs)) {
      setPackState(payload.packs);
    }
  }, [deck]);

  useEffect(() => {
    let cancelled = false;
    // Deferred like the other tools' first loads, so nothing sets state
    // during the effect body.
    const timer = window.setTimeout(() => {
      Promise.all([refresh(theme), refreshPacks()])
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
  }, [refresh, refreshPacks, theme]);

  const send = useCallback(
    async (body: Record<string, unknown>, success: string) => {
      setBusy(true);
      try {
        const response = await fetch("/api/card-art", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Entry-scoped ops target the pack the on-screen rows belong
          // to (the manifest's own theme), never the tab selection - the
          // two can differ for a moment mid-switch, and a write must
          // follow the entries it was clicked on. scaffold-pack passes
          // its own theme explicitly and overrides this default.
          body: JSON.stringify({ deck, theme: manifest?.theme ?? theme, ...body }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "That did not work");
        }
        await refresh(theme);
        setMessage(success);
        return payload;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "That did not work");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [refresh, theme, manifest, deck],
  );

  const entries = useMemo(() => manifest?.entries ?? [], [manifest]);
  // The pack the on-screen rows belong to. For one render after a tab
  // switch this trails `theme`; deriving image URLs from it keeps the
  // entries and their URLs changing in the same frame instead of 404ing.
  const loadedTheme = manifest?.theme ?? theme;
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? null;
  const installedPacks = useMemo(
    () => new Set(packState.filter((pack) => pack.installed).map((pack) => pack.id)),
    [packState],
  );

  // The Card tab loads on demand: 226 catalog records are not worth shipping
  // with the manifest when one is read at a time.
  const openCard = useCallback(async (key: string) => {
    setCard(null);
    setCardEdits({});
    const response = await fetch(
      `/api/card-art?view=card&theme=x&deck=${deck}&key=${encodeURIComponent(key)}`,
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const body = payload as { error?: string } | null;
      setMessage(body?.error ?? "Could not read that card");
      return;
    }
    if (!isCardRecord(payload)) {
      setMessage("The card service returned something unreadable");
      return;
    }
    setCard(payload);
  }, [deck]);

  useEffect(() => {
    if (!activeKey || facet !== CARD_FACET) {
      return;
    }
    // Deferred like the other loads here, so nothing sets state during the
    // effect body.
    const timer = window.setTimeout(() => void openCard(activeKey), 0);
    return () => window.clearTimeout(timer);
  }, [activeKey, facet, openCard]);

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
      if (!activeKey || busy || facet === CARD_FACET) {
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
  }, [activeKey, addVariant, busy, facet]);

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
        `${variantUrl(loadedTheme, entry.key, variantId)}&v=${revision}`,
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

  // A save builds a candidate catalog server-side and runs the real build
  // validator over it, so a breaking edit comes back as the validator's own
  // message instead of landing.
  async function saveCard(key: string) {
    if (!card || Object.keys(cardEdits).length === 0) {
      return;
    }
    const edits: Record<string, string | string[]> = {};
    for (const [id, value] of Object.entries(cardEdits)) {
      const field = card.fields.find((candidate) => candidate.id === id);
      edits[id] = field?.kind === "list" ? value.split("\n") : value;
    }
    const result = await send({ key, op: "save-card", edits }, "Card saved.");
    if (result && isCardRecord(result)) {
      setCard(result);
      setCardEdits({});
    }
  }

  const progress = manifest?.progress;
  const facetPacks = packState.length > 0 ? packState : packs.map((pack) => ({
    ...pack,
    installed: pack.id === theme,
    draft: false,
    generated: 0,
    total: 0,
  }));

  // What the row's thumbnail shows: the image actually on the card once one
  // is live, otherwise the first candidate so progress reads at a glance.
  function thumbnailFor(entry: Entry) {
    if (entry.status === "generated") {
      return `${entry.target}?v=${revision}`;
    }
    const first = entry.variants[0];
    return first ? `${variantUrl(loadedTheme, entry.key, first.id)}&v=${revision}` : null;
  }

  function selectFacet(next: string) {
    setFacet(next);
    // Selecting a world scopes the whole studio to it, so the list's
    // thumbnails and progress describe the same pack as the open tab.
    if (next !== CARD_FACET && installedPacks.has(next) && next !== theme) {
      setTheme(next);
    }
  }

  const entryByKey = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );

  // Jump to a related card: clear whatever filter is hiding it, open it, and
  // scroll its row into view once it exists.
  const jumpTo = useCallback(
    (key: string) => {
      const target = entryByKey.get(key);
      if (!target) {
        return;
      }
      if (target.later) {
        setShowLater(true);
      }
      setGroup("all");
      setSearch("");
      setOnlyMissing(false);
      setActiveKey(key);
      // Opening the destination row unmounts the chip that was just clicked,
      // which drops focus to <body>. Move focus to the row we arrived at, or a
      // keyboard user loses their place and tabs from the top of the page.
      window.setTimeout(() => {
        const row = document.getElementById(`card-row-${key}`);
        revealElement(
          row?.querySelector<HTMLButtonElement>(".card-art-row-main") ?? row,
        );
      }, 60);
    },
    [entryByKey],
  );

  return (
    <div className="card-art-studio">
      <header className="card-art-studio-head">
        <div>
          <span className="card-art-kicker">Card Studio</span>
          <h1>Edit the cards, and dress them for each world</h1>
          <p>
            Development-only. A card&apos;s mechanics live in the catalog; its
            picture and bio live in an art pack, one per world.
          </p>
        </div>
        <div className="card-art-progress">
          <strong>{progress ? `${progress.generated}/${progress.total}` : "—"}</strong>
          <small>{theme} cards with art</small>
        </div>
      </header>

      <div className="card-art-controls">
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
        {activeEntry && facet !== CARD_FACET ? (
          <>
            <strong>Ready for {activeEntry.fileName}</strong>
            <span>Copy an image in Higgsfield, then press Ctrl+V anywhere here.</span>
          </>
        ) : (
          <span>Select a card below to edit it or give it art.</span>
        )}
        {message ? <em>{message}</em> : null}
      </div>

      <ol className="card-art-rows">
        {visible.map((entry) => {
          const isActive = entry.key === activeKey;
          // Only an explicit click chooses a variant. This used to default to
          // variants[0], so a card nobody had clicked showed variant "a" under
          // the words "How it reads on the card" - while the live image was
          // usually a later variant. The panel contradicted the row's own
          // thumbnail and read as "the wrong art is on this card" (owner,
          // 2026-08-20). With no choice made, the preview shows what IS live.
          const chosen = preview[entry.key] ?? null;
          const thumb = thumbnailFor(entry);
          const liveUrl =
            entry.status === "generated" ? `${entry.target}?v=${revision}` : null;
          const previewUrl = chosen
            ? `${variantUrl(loadedTheme, entry.key, chosen)}&v=${revision}`
            : liveUrl;
          const bioDraft = bioDrafts[entry.key] ?? entry.bio;

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
              id={`card-row-${entry.key}`}
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
                  className={thumb ? "card-art-thumb has-image" : "card-art-thumb"}
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
                  {entry.related.length > 0 ? (
                    <div className="card-relations">
                      {entry.related.map((relGroup) => (
                        <div
                          className="card-relations-group"
                          key={relGroup.label}
                          role="group"
                          aria-labelledby={relationsLabelId(entry.key, relGroup.label)}
                        >
                          <span
                            className="card-relations-label"
                            id={relationsLabelId(entry.key, relGroup.label)}
                          >
                            {relGroup.label}
                          </span>
                          <span className="card-relations-chips">
                            {relGroup.items.map((link, linkIndex) => {
                              const relEntry = link.key ? entryByKey.get(link.key) : null;
                              const relThumb = relEntry ? thumbnailFor(relEntry) : null;
                              const chipBody = (
                                <>
                                  {relThumb ? (
                                    <span className="card-relations-thumb">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img alt="" src={relThumb} />
                                    </span>
                                  ) : null}
                                  <span>{link.label}</span>
                                  {relEntry?.status === "generated" ? (
                                    <small className="card-relations-live">live</small>
                                  ) : null}
                                </>
                              );
                              return link.key && relEntry ? (
                                <button
                                  className="card-relations-chip"
                                  type="button"
                                  key={`${link.key}-${linkIndex}`}
                                  onClick={() => jumpTo(link.key as string)}
                                >
                                  {chipBody}
                                </button>
                              ) : (
                                <span
                                  className="card-relations-chip is-static"
                                  key={`${link.label}-${linkIndex}`}
                                >
                                  {chipBody}
                                </span>
                              );
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {/* The shared tab strip, so the facets get the keyboard
                      contract (roving tabindex, arrows, Home/End) and the
                      panel wiring rather than a hand-rolled lookalike. */}
                  <EditorTabs
                    className="card-facet-tabs"
                    idBase={`facet-${entry.key}`}
                    label="Card facets"
                    active={facet}
                    onChange={selectFacet}
                    tabs={[
                      ...(deck === "craft"
                        ? [
                            {
                              id: CARD_FACET,
                              label: "Card",
                              className: "card-facet-tab",
                            },
                          ]
                        : []),
                      ...facetPacks.map((pack) => ({
                        id: pack.id,
                        className: pack.installed
                          ? "card-facet-tab"
                          : "card-facet-tab is-planned",
                        label: (
                          <>
                            {pack.name}
                            {pack.installed ? null : <small>not started</small>}
                          </>
                        ),
                      })),
                    ]}
                  />

                  <div {...tabPanelProps(`facet-${entry.key}`, facet)}>
                  {facet === CARD_FACET ? (
                    <CardFacet
                      record={card}
                      edits={cardEdits}
                      busy={busy}
                      onEdit={(id, value) =>
                        setCardEdits((current) => ({ ...current, [id]: value }))
                      }
                      onReset={() => setCardEdits({})}
                      onSave={() => void saveCard(entry.key)}
                    />
                  ) : installedPacks.has(facet) ? (
                    <>
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

                      <div className="card-bio-editor">
                        <label className="field">
                          <span>
                            Bio in {facetPacks.find((p) => p.id === facet)?.name ?? facet}
                          </span>
                          <textarea
                            rows={3}
                            maxLength={MAX_BIO_LENGTH}
                            value={bioDraft}
                            placeholder="Who this character is in this world. Shown on the card's inspection panel."
                            onChange={(event) =>
                              setBioDrafts((current) => ({
                                ...current,
                                [entry.key]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="card-bio-editor-actions">
                          <small>
                            {bioDraft.length}/{MAX_BIO_LENGTH}
                          </small>
                          <button
                            className="button button-secondary"
                            type="button"
                            disabled={busy || bioDraft === entry.bio}
                            onClick={() =>
                              void send(
                                { key: entry.key, op: "set-bio", bio: bioDraft },
                                `Saved the bio for ${entry.name}.`,
                              ).then((result) => {
                                if (result) {
                                  setBioDrafts((current) => {
                                    const next = { ...current };
                                    delete next[entry.key];
                                    return next;
                                  });
                                }
                              })
                            }
                          >
                            Save bio
                          </button>
                        </div>
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
                                aria-pressed={variant.id === chosen}
                                onClick={() =>
                                  setPreview((current) => ({
                                    ...current,
                                    [entry.key]: variant.id,
                                  }))
                                }
                                onMouseEnter={(event) =>
                                  setZoomPeek({
                                    url: `${variantUrl(loadedTheme, entry.key, variant.id)}&v=${revision}`,
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
                                  src={`${variantUrl(loadedTheme, entry.key, variant.id)}&v=${revision}`}
                                />
                                <span>{variant.id}</span>
                              </button>
                            ))}
                          </div>

                          {previewUrl ? (
                            <div className="card-art-chosen">
                              <div className="card-art-card-preview">
                                <div className="lineage-card is-selected">
                                  <span className="lineage-card-topline">
                                    <span>{chosen ? "Preview" : "On the card"}</span>
                                    <span>
                                      {String(entry.sequence).padStart(3, "0")}
                                    </span>
                                  </span>
                                  <span className="lineage-card-art card-illustration-frame has-generated-image">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      className="card-illustration-image"
                                      alt=""
                                      src={previewUrl}
                                    />
                                  </span>
                                  <span className="lineage-card-copy">
                                    <strong>{entry.name}</strong>
                                  </span>
                                </div>
                                <small>
                                  {chosen
                                    ? `Variant ${chosen} — not on the card yet`
                                    : "This is the live image"}
                                </small>
                              </div>

                              {chosen ? (
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
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </>
                  ) : (
                    <PlannedPackFacet
                      pack={facetPacks.find((candidate) => candidate.id === facet)}
                      busy={busy}
                      onScaffold={() =>
                        void send(
                          { theme: facet, op: "scaffold-pack" },
                          `Scaffolded the ${facet} pack. It is a draft until you write it.`,
                        ).then(refreshPacks)
                      }
                    />
                  )}
                  </div>
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
              className={peekAsCard ? "card-art-peek is-card" : "card-art-peek"}
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
        <CardArtCropper
          src={`${variantUrl(loadedTheme, cropping.key, cropping.variantId)}&v=${revision}`}
          fileName={entries.find((entry) => entry.key === cropping.key)?.fileName ?? ""}
          busy={busy}
          onCancel={() => setCropping(null)}
          onSave={(dataUrl) => {
            const target = cropping;
            setCropping(null);
            void send(
              { key: target.key, op: "crop", variantId: target.variantId, dataUrl },
              `Saved a crop of ${target.variantId}.`,
            );
          }}
        />
      ) : null}
    </div>
  );
}

/** What the card IS: the same in every world, so it lives outside the packs. */
function CardFacet({
  record,
  edits,
  busy,
  onEdit,
  onReset,
  onSave,
}: {
  record: CardRecord | null;
  edits: Record<string, string>;
  busy: boolean;
  onEdit: (id: string, value: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  if (!record) {
    return <p className="card-art-empty">Reading the card…</p>;
  }
  if (!record.hasRecord) {
    return <p className="card-art-empty">{record.note}</p>;
  }

  const dirty = Object.keys(edits).length > 0;

  return (
    <div className="card-facet-body">
      <div className="card-facet-fields">
        {record.fields.map((field) => {
          const current = edits[field.id] ?? fieldToText(field.value);
          return (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              {field.kind === "line" ? (
                <input
                  type="text"
                  value={current}
                  onChange={(event) => onEdit(field.id, event.target.value)}
                />
              ) : (
                <textarea
                  rows={field.kind === "list" ? 4 : 3}
                  value={current}
                  onChange={(event) => onEdit(field.id, event.target.value)}
                />
              )}
              {field.hint ? <small>{field.hint}</small> : null}
            </label>
          );
        })}
      </div>

      <div className="card-facet-side">
        <h2>{record.kind}</h2>
        <dl className="card-facet-structural">
          {record.structural.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="card-facet-note">{record.note}</p>
      </div>

      <div className="card-facet-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={busy || !dirty}
          onClick={onSave}
        >
          Save card
        </button>
        <button
          className="button button-quiet"
          type="button"
          disabled={busy || !dirty}
          onClick={onReset}
        >
          Discard changes
        </button>
        <small>
          A save runs the full catalog validator first, so an edit that would
          break the build is refused rather than written.
        </small>
      </div>
    </div>
  );
}

/** A world that does not exist yet. The tab is here so the plan is visible. */
function PlannedPackFacet({
  pack,
  busy,
  onScaffold,
}: {
  pack?: PackSummary;
  busy: boolean;
  onScaffold: () => void;
}) {
  return (
    <div className="card-facet-planned">
      <h2>{pack?.name ?? "This world"} has not been started</h2>
      <p>
        Scaffolding writes a complete pack file: every card the catalog owes,
        with a placeholder brief and nothing generated. It lands marked as a
        draft, so the build stays green while you write it.
      </p>
      <button
        className="button button-secondary"
        type="button"
        disabled={busy}
        onClick={onScaffold}
      >
        Scaffold the {pack?.name ?? "pack"} pack
      </button>
    </div>
  );
}
