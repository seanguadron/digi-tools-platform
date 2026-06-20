import { CopyButton } from "@/components/copy-button";
import type { SkillGroup } from "@/lib/skills";

export function SkillsWiki({
  groups,
  total,
}: {
  groups: SkillGroup[];
  total: number;
}) {
  return (
    <div className="tool-page skills-wiki">
      <header className="skills-wiki-header">
        <span className="tool-kicker">Skills library</span>
        <h1>The AI skill stack</h1>
        <p>
          {total} curated skills across design, engineering, and QA. Each is an
          instruction pack you install with the skills CLI — expand one to see
          what it&apos;s for, how to install it, and any modes or sub-skills it
          adds.
        </p>
      </header>

      {groups.map((group) => (
        <section className="skills-group" key={group.id} aria-label={group.label}>
          <div className="skills-group-heading">
            <span>{group.label}</span>
            <small>{group.blurb}</small>
          </div>
          <div className="skills-group-list">
            {group.skills.map((skill) => (
              <details className="skill-panel" key={skill.id}>
                <summary>
                  <span className="skill-panel-main">
                    <strong>{skill.name}</strong>
                    <small>{skill.summary}</small>
                  </span>
                  <span className="skill-panel-marker" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="skill-panel-body">
                  <p className="skill-usefor">{skill.useFor}</p>

                  <div className="skill-section">
                    <span className="skill-section-label">Install</span>
                    {skill.install.map((entry) => (
                      <div className="skill-command" key={entry.command}>
                        <div className="skill-command-row">
                          <code>{entry.command}</code>
                          <CopyButton
                            value={entry.command}
                            label={`Copy ${entry.command}`}
                          />
                        </div>
                        {entry.note ? (
                          <small className="skill-command-note">
                            {entry.note}
                          </small>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {skill.modes && skill.modes.length > 0 ? (
                    <div className="skill-section">
                      <span className="skill-section-label">Modes</span>
                      <ul className="skill-options">
                        {skill.modes.map((mode) => (
                          <li key={mode.name}>
                            <code>{mode.name}</code>
                            <span>{mode.note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {skill.subSkills && skill.subSkills.length > 0 ? (
                    <div className="skill-section">
                      <span className="skill-section-label">Sub-skills</span>
                      <ul className="skill-options">
                        {skill.subSkills.map((sub) => (
                          <li key={sub.name}>
                            <code>{sub.name}</code>
                            <span>{sub.note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <a
                    className="skill-source"
                    href={`https://${skill.source}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {skill.source}
                  </a>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
