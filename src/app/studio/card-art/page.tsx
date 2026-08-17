import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardArtStudio } from "@/components/card-art-studio";
import { ART_THEME_IDS } from "../../../../scripts/generate-craft-art-docs.mjs";

// An authoring surface, not a tool: deliberately absent from the tool registry
// so it has no nav tab, no home card, and nothing links to it. It only exists
// while the dev server is running — the production build 404s, matching the
// route handler it talks to (enforced by check:security S4).
export const metadata: Metadata = {
  title: "Card Art Studio",
  description: "Development-only authoring surface for card art.",
  robots: { index: false, follow: false },
};

export default function CardArtStudioPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CardArtStudio themes={[...ART_THEME_IDS]} />;
}
