import type { Metadata } from "next";
import { ArchitectWizard } from "@/components/architect-wizard";

export const metadata: Metadata = {
  title: "Architect Wizard",
  description:
    "Sketch an application's architecture and data model on a canvas, then export an agent-ready build brief.",
};

export default function ArchitectWizardPage() {
  return <ArchitectWizard />;
}
