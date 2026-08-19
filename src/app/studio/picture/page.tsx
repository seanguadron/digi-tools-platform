import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardStudio } from "@/components/card-studio";
import { PICTURE_ART_PACKS } from "../../../../scripts/art-pack.mjs";

// The PICTURE deck's authoring surface: the same Card Studio component in
// picture mode - one Gallery pack, no Card tab (this deck's studio edits art
// and flavor only; the catalog stays script-managed). Development-only like
// /studio/cards: no registry entry, no nav tab, production 404s, and the
// route handler it talks to enforces the same loopback + dev-only guards.
export const metadata: Metadata = {
  title: "Picture Studio",
  description: "Development-only authoring surface for the PICTURE deck's art.",
  robots: { index: false, follow: false },
};

export default function PictureStudioPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <CardStudio
      deck="picture"
      packs={PICTURE_ART_PACKS.map((pack) => ({ ...pack }))}
    />
  );
}
