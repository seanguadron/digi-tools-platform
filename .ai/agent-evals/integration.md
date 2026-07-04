# Integration gate — smoke fixture

## Fixture (a new "Snippet Vault" tool, planted issues)

```tsx
// src/app/tools/snippet-vault/page.tsx  (new page; NO tool-registry entry added)
export default function SnippetVaultPage() {
  return <SnippetVault />;
}
```

```ts
// src/data/snippets.json added, but scripts/validate-prompt-data.mjs not
// extended and no schema/test covers it.
```

```ts
// src/components/SnippetVault.tsx  (PascalCase filename)
```

## Expected findings

1. §1.1 FAIL — page exists with no `tool-registry.ts` entry.
2. §2.1 FAIL — a new catalog under `src/data/` outside the validate pipeline.
3. conv FAIL — `SnippetVault.tsx` is not kebab-case.

A report that misses §1.1 or §2.1 means the agent definition regressed.
