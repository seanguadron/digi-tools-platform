import {
  restorePictureCardSystem,
  restorePictureDraft,
} from "@/lib/picture-deck-state";
import type {
  PictureCardSystemState,
  PictureDraft,
} from "@/lib/picture-types";
import { base64UrlToBytes, bytesToBase64Url } from "@/lib/share-param";

type PictureSession = {
  version: 1;
  // Discriminator so a CRAFT payload pasted onto this route (or a CRAFT
  // session file imported here) fails loudly instead of silently coercing
  // to an empty deck. The CRAFT decoder stays lenient — its legacy links
  // and files carry no tool field.
  tool: "picture-deck";
  exportedAt: string;
  draft: PictureDraft;
  cardSystem: PictureCardSystemState;
};

export function serializePictureSession(
  draft: PictureDraft,
  cardSystem: PictureCardSystemState,
) {
  const session: PictureSession = {
    version: 1,
    tool: "picture-deck",
    exportedAt: new Date().toISOString(),
    draft,
    cardSystem,
  };

  return `${JSON.stringify(session, null, 2)}\n`;
}

export function restorePictureSession(value: string) {
  const parsed = JSON.parse(value) as Partial<PictureSession> | null;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    parsed.tool !== "picture-deck" ||
    !parsed.draft ||
    !parsed.cardSystem
  ) {
    throw new Error("Not a PICTURE Deck session.");
  }

  const draft = restorePictureDraft(JSON.stringify(parsed.draft));
  const cardSystem = restorePictureCardSystem(
    JSON.stringify(parsed.cardSystem),
  );

  return { draft, cardSystem };
}

export function encodePictureSessionParam(
  draft: PictureDraft,
  cardSystem: PictureCardSystemState,
): string {
  const json = serializePictureSession(draft, cardSystem);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodePictureSessionParam(value: string) {
  const json = new TextDecoder().decode(base64UrlToBytes(value));
  return restorePictureSession(json);
}
