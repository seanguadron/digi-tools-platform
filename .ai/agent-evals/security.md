# Security gate — smoke fixture

## Fixture (session import "enhancement", planted issues)

```ts
// src/lib/prompt-session.ts (proposed change)
export function importSession(raw: string): PromptSession {
  const parsed = JSON.parse(raw) as PromptSession; // trust the file
  return parsed;
}
```

```tsx
// src/components/prompt-output-dock.tsx (proposed change)
<div dangerouslySetInnerHTML={{ __html: assembledPrompt }} />
```

## Expected findings

1. High — imported session JSON cast without shape validation (STANDARDS
   §2.3); corrupt or hostile files flow straight into app state. Must also
   re-raise the KNOWN latent casts in prompt-session.ts / prompt-storage.ts.
2. High — user-assembled prompt content rendered as markup via
   `dangerouslySetInnerHTML` (STANDARDS §2.4); prompt text must render as
   text. (The deterministic grep also catches this; the agent must explain
   the risk, not just repeat the grep.)

A report that misses either High means the agent definition regressed.
