// The Card Art Studio's write endpoint — the ONE server surface in this app.
//
// It exists so the authoring page can put generated art on disk instead of
// making the owner rename, convert, and move 226 files by hand. It is
// development-only and returns 404 in production (check:security S4 enforces
// that guard on every route handler).
//
// The trust rule that makes this safe: a caller sends an entry KEY from the
// catalog (roles.researcher), never a path. Every filename and directory is
// derived server-side from the catalog by card-art-store, which also asserts
// each resolved path sits inside its own root. See docs/ARCHITECTURE.md.

import { CardArtError, createCardArtStore } from "../../../../scripts/card-art-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One store per deck; the same file mechanics address different catalogs and
// pack directories. The deck is chosen by an explicit request param so a
// caller can never make a craft key land in the picture tree or vice versa -
// theme ids are validated inside each store against its own deck's pack list.
const stores = {
  craft: createCardArtStore(),
  picture: createCardArtStore({ deck: "picture" }),
};

function storeFor(deck: string | null | undefined) {
  const store = stores[(deck || "craft") as keyof typeof stores];
  if (!store) {
    throw new CardArtError(`Unknown deck: ${deck}`, 400);
  }
  return store;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

// `next dev` binds every interface and next.config's allowedDevOrigins does
// NOT gate application routes (it only unblocks /_next assets), so the tools
// being reachable from a phone on the LAN would otherwise expose this writer
// too. Requiring a loopback Host keeps the tools LAN-previewable while
// keeping the authoring endpoint on this machine. A raw client can forge a
// Host header, so this narrows the surface rather than sealing it — the real
// boundary is still "do not run the dev server on a network you distrust".
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalRequest(request: Request) {
  const host = request.headers.get("host") ?? "";
  const name = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0];
  return LOOPBACK.has(name);
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

function failure(error: unknown) {
  if (error instanceof CardArtError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  // Anything else can carry absolute paths from fs errors; log it here and
  // give the caller nothing to map the filesystem with.
  console.error("[card-art]", error);
  return Response.json({ error: "Card art request failed" }, { status: 500 });
}

function requiredParam(value: string | null, name: string) {
  if (!value) {
    throw new CardArtError(`Missing ${name}`, 400);
  }
  return value;
}

export async function GET(request: Request) {
  if (isProduction() || !isLocalRequest(request)) {
    return notFound();
  }

  try {
    const params = new URL(request.url).searchParams;
    const view = params.get("view");
    const store = storeFor(params.get("deck"));

    // The worlds this deck has and which of them exist yet.
    if (view === "packs") {
      return Response.json({ packs: await store.listPacks() });
    }

    const theme = requiredParam(params.get("theme"), "theme");
    const key = params.get("key");
    const variant = params.get("variant");

    // The Card tab: what this card IS, independent of any pack.
    if (view === "card") {
      return Response.json(await store.readCard(requiredParam(key, "key")));
    }

    // Variants live outside public/, so the studio reads them back here.
    if (key || variant) {
      const file = await store.readVariantFile(
        theme,
        requiredParam(key, "key"),
        requiredParam(variant, "variant"),
      );
      const type = file.file.endsWith(".webp")
        ? "image/webp"
        : file.file.endsWith(".jpg")
          ? "image/jpeg"
          : "image/png";
      return new Response(new Uint8Array(file.bytes), {
        headers: {
          "content-type": type,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return Response.json(await store.listEntries(theme));
  } catch (error) {
    return failure(error);
  }
}

// Generous enough for a 4K paste, small enough that an oversized body is
// refused before it is buffered and base64-decoded.
const MAX_BODY_BYTES = 48 * 1024 * 1024;

export async function POST(request: Request) {
  if (isProduction() || !isLocalRequest(request)) {
    return notFound();
  }

  try {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large" }, { status: 413 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const store = storeFor(typeof body.deck === "string" ? body.deck : "craft");
    const theme = typeof body.theme === "string" ? body.theme : "";
    const key = typeof body.key === "string" ? body.key : "";
    const op = typeof body.op === "string" ? body.op : "";
    const variantId = typeof body.variantId === "string" ? body.variantId : "";
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

    // Scaffolding a world names a pack but no card.
    if (op === "scaffold-pack") {
      if (!theme) {
        throw new CardArtError("theme is required", 400);
      }
      return Response.json(await store.scaffoldPack(theme));
    }

    if (!theme || !key) {
      throw new CardArtError("theme and key are required", 400);
    }

    switch (op) {
      case "save-card": {
        const edits = body.edits;
        if (typeof edits !== "object" || edits === null || Array.isArray(edits)) {
          throw new CardArtError("edits must be an object", 400);
        }
        return Response.json(
          await store.saveCard(key, edits as Record<string, string | string[]>),
        );
      }
      case "set-bio":
        return Response.json(
          await store.setBio(theme, key, typeof body.bio === "string" ? body.bio : ""),
        );
      case "add-variant":
        return Response.json(await store.addVariant(theme, key, dataUrl));
      case "crop":
        return Response.json(await store.saveCrop(theme, key, variantId, dataUrl));
      case "delete-variant":
        return Response.json(await store.deleteVariant(theme, key, variantId));
      case "select":
        return Response.json(await store.selectVariant(theme, key, variantId, dataUrl));
      case "clear":
        return Response.json(await store.clearLive(theme, key));
      default:
        throw new CardArtError(`Unknown operation: ${op || "(none)"}`, 400);
    }
  } catch (error) {
    return failure(error);
  }
}
