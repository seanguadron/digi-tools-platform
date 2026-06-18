import Link from "next/link";
import { TOOL_REGISTRY } from "@/lib/tool-registry";

const promptTool = TOOL_REGISTRY["prompt-builder"];

export default function HomePage() {
  return (
    <div className="welcome-page">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <div className="product-label">
            <span className="status-dot" aria-hidden="true" />
            Local-first browser tools
          </div>
          <h1 id="welcome-title">
            Make every prompt clearer.
          </h1>
          <p>
            Digi Tools turns rough intent into structured, portable prompts.
            Everything stays in your browser.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={promptTool.href}>
              Open Prompt Builder
            </Link>
            <a className="button button-quiet" href="#how-it-works">
              See how it works
            </a>
          </div>
        </div>

        <div className="prompt-specimen" aria-label="Example prompt structure">
          <div className="specimen-header">
            <div>
              <span>prompt.md</span>
              <strong>Ready to refine</strong>
            </div>
            <span className="file-badge">LOCAL</span>
          </div>
          <pre>
            <code>{`ROLE
You are a senior product designer.

TASK
Review a new onboarding flow.

CONTEXT
The user has no account and data stays local.

DELIVERABLE
Return five prioritized findings with fixes.`}</code>
          </pre>
          <div className="specimen-footer">
            <span>Structured prompt</span>
            <span>412 characters</span>
          </div>
        </div>
      </section>

      <section
        className="workflow-section"
        id="how-it-works"
        aria-labelledby="workflow-title"
      >
        <div className="section-heading">
          <h2 id="workflow-title">From rough request to usable prompt</h2>
          <p>
            The first tool keeps the process visible. Fill the brief, review the
            generated prompt, then copy or download it.
          </p>
        </div>

        <ol className="workflow-list">
          <li>
            <span>1</span>
            <div>
              <h3>Describe the job</h3>
              <p>Start with the outcome, audience, and useful context.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Add guardrails</h3>
              <p>Choose tone, output format, and constraints that matter.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Take the result</h3>
              <p>Copy the prompt or download a plain Markdown file.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="tool-launch" aria-labelledby="tool-launch-title">
        <div>
          <span className="featured-tag">FIRST TOOL</span>
          <h2 id="tool-launch-title">{promptTool.name}</h2>
          <p>{promptTool.tagline}</p>
        </div>
        <Link className="button button-primary" href={promptTool.href}>
          Start a prompt
        </Link>
      </section>
    </div>
  );
}
