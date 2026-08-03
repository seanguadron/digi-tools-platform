import Link from "next/link";
import { getSkills, getSkillsByLayer } from "@/lib/skills";
import { TOOL_REGISTRY } from "@/lib/tool-registry";

const promptTool = TOOL_REGISTRY["prompt-builder"];
const architectTool = TOOL_REGISTRY["architect-wizard"];
const imageTool = TOOL_REGISTRY["image-editor"];
const vectorTool = TOOL_REGISTRY["vector-editor"];
const skillsTool = TOOL_REGISTRY["skills"];
const pictureTool = TOOL_REGISTRY["picture-deck"];

export default function HomePage() {
  const skillGroups = getSkillsByLayer();
  const skillCount = getSkills().length;

  return (
    <div className="welcome-page">
      <header className="welcome-intro">
        <div className="product-label">
          <span className="status-dot" aria-hidden="true" />
          Local-first browser tools
        </div>
        <h1 id="welcome-title">Sharp tools for working with AI.</h1>
        <p>
          Digi Tools is a local-first toolbox — build prompts for language and
          image models, sketch architectures, edit images and vectors, and
          browse your skill stack. Everything stays in your browser.
        </p>
      </header>

      <div className="home-sections">
        <section
          className="home-feature"
          id="prompts"
          aria-labelledby="home-prompts-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 01 · CRAFT</span>
            <h2 id="home-prompts-title">{promptTool.name}</h2>
            <p>{promptTool.tagline}</p>
            <ul className="home-feature-points">
              <li>Describe the job, add guardrails, take the result.</li>
              <li>Equip role and tactic cards onto a clear C.R.A.F.T. brief.</li>
              <li>Copy, download, or share the finished prompt.</li>
            </ul>
            <Link className="button button-primary" href={promptTool.href}>
              Open the CRAFT Deck
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>prompt.md</span>
              <span className="file-badge">LOCAL</span>
            </div>
            <pre>
              <code>{`ROLE
You are a senior product designer.

TASK
Review a new onboarding flow.

DELIVERABLE
Five prioritized findings with fixes.`}</code>
            </pre>
          </div>
        </section>

        <section
          className="home-feature"
          id="architect"
          aria-labelledby="home-architect-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 02 · Architect</span>
            <h2 id="home-architect-title">{architectTool.name}</h2>
            <p>{architectTool.tagline}</p>
            <ul className="home-feature-points">
              <li>Drop managers, services, workers, and data onto a canvas.</li>
              <li>Connect them with directional, labeled relationships.</li>
              <li>Export a build brief — diagram, build order, open questions.</li>
            </ul>
            <Link className="button button-primary" href={architectTool.href}>
              Open Architect
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>architecture</span>
              <span className="file-badge">CANVAS</span>
            </div>
            <div className="home-spec-arch">
              <span className="home-spec-node">OrderManager</span>
              <span className="home-spec-arrow">owns →</span>
              <span className="home-spec-node">Order</span>
              <span className="home-spec-arrow">uses →</span>
              <span className="home-spec-node">PaymentService</span>
            </div>
          </div>
        </section>

        <section
          className="home-feature"
          id="image-editor"
          aria-labelledby="home-image-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 03 · Image</span>
            <h2 id="home-image-title">{imageTool.name}</h2>
            <p>{imageTool.tagline}</p>
            <ul className="home-feature-points">
              <li>Paint and erase across a stack of raster layers.</li>
              <li>Select, transform, crop, and adjust — with full undo history.</li>
              <li>Open an image, then export a PNG. Nothing leaves your device.</li>
            </ul>
            <Link className="button button-primary" href={imageTool.href}>
              Open Image Editor
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>canvas.png</span>
              <span className="file-badge">LAYERS</span>
            </div>
            <ul className="home-spec-layers">
              <li>
                <span className="home-spec-eye" />
                <span>Text</span>
                <strong>100%</strong>
              </li>
              <li>
                <span className="home-spec-eye" />
                <span>Photo</span>
                <strong>92%</strong>
              </li>
              <li>
                <span className="home-spec-eye" />
                <span>Background</span>
                <strong>100%</strong>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="home-feature"
          id="vector-editor"
          aria-labelledby="home-vector-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 04 · Vector</span>
            <h2 id="home-vector-title">{vectorTool.name}</h2>
            <p>{vectorTool.tagline}</p>
            <ul className="home-feature-points">
              <li>Draw rectangles, ellipses, lines, and polygons on an SVG artboard.</li>
              <li>Select, move, resize, rotate, and restyle — with full undo history.</li>
              <li>Export clean SVG or a rasterized PNG. Nothing leaves your device.</li>
            </ul>
            <Link className="button button-primary" href={vectorTool.href}>
              Open Vector Editor
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>artboard.svg</span>
              <span className="file-badge">VECTOR</span>
            </div>
            <svg
              className="home-spec-vector"
              viewBox="0 0 220 120"
              role="img"
              aria-hidden="true"
            >
              <rect x="16" y="22" width="78" height="58" rx="8" />
              <ellipse cx="150" cy="46" rx="40" ry="27" />
              <polygon points="120,104 150,74 180,104" />
            </svg>
          </div>
        </section>

        <section
          className="home-feature"
          id="skills"
          aria-labelledby="home-skills-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 05 · Skills</span>
            <h2 id="home-skills-title">{skillsTool.name}</h2>
            <p>
              A wiki for the {skillCount} skills in your AI stack — what each one
              does and the commands to install it.
            </p>
            <ul className="home-feature-points">
              <li>Browse by layer: design, engineering, QA, and optional.</li>
              <li>Expand a skill for its purpose and install commands.</li>
              <li>Reference only — no agents, nothing runs here.</li>
            </ul>
            <Link className="button button-primary" href={skillsTool.href}>
              Browse Skills
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>skills</span>
              <span className="file-badge">{skillCount}</span>
            </div>
            <ul className="home-spec-skills">
              {skillGroups.map((group) => (
                <li key={group.id}>
                  <span>{group.label}</span>
                  <strong>{group.skills.length}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="home-feature"
          id="pictures"
          aria-labelledby="home-pictures-title"
        >
          <div className="home-feature-copy">
            <span className="tool-kicker">Tool 06 · PICTURE</span>
            <h2 id="home-pictures-title">{pictureTool.name}</h2>
            <p>{pictureTool.tagline}</p>
            <ul className="home-feature-points">
              <li>Name a subject, then stack light, medium, and style cards.</li>
              <li>One Intensity dial re-grades every card, subtle to extreme.</li>
              <li>Optional Midjourney tail; copy or download the prompt.</li>
            </ul>
            <Link className="button button-primary" href={pictureTool.href}>
              Open the PICTURE Deck
            </Link>
          </div>
          <div className="home-spec" aria-hidden="true">
            <div className="home-spec-header">
              <span>prompt.txt</span>
              <span className="file-badge">IMAGE</span>
            </div>
            <pre>
              <code>{`a lighthouse keeper reading
by lamplight, oil painting,
rain-swept night city, warm
golden-hour glow, muted
palette, wide establishing
shot --ar 3:2 --stylize 250`}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
