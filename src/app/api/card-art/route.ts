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

const store = createCardArtStore();

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

function failure(error: unknown) {
  if (error instanceof CardArtError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Card art request failed";
  return Response.json({ error: message }, { status: 500 });
}

function requiredParam(value: string | null, name: string) {
  if (!value) {
    throw new CardArtError(`Missing ${name}`, 400);
  }
  return value;
}

export async function GET(request: Request) {
  if (isProduction()) {
    return notFound();
  }

  try {
    const params = new URL(request.url).searchParams;
    const theme = requiredParam(params.get("theme"), "theme");
    const key = params.get("key");
    const variant = params.get("variant");

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
        headers: { "content-type": type, "cache-control": "no-store" },
      });
    }

    return Response.json(await store.listEntries(theme));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (isProduction()) {
    return notFound();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const theme = typeof body.theme === "string" ? body.theme : "";
    const key = typeof body.key === "string" ? body.key : "";
    const op = typeof body.op === "string" ? body.op : "";
    const variantId = typeof body.variantId === "string" ? body.variantId : "";
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

    if (!theme || !key) {
      throw new CardArtError("theme and key are required", 400);
    }

    switch (op) {
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
