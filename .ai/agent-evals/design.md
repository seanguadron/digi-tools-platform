# Design gate — smoke fixture

## Fixture (a promo banner, planted issues)

```tsx
// src/components/promo-banner.tsx
export function PromoBanner() {
  return (
    <div
      style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}
      className="rounded-2xl p-8 backdrop-blur-lg"
    >
      <h2 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl text-transparent">
        Unleash your creativity!
      </h2>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {/* four identical KPI tiles, all reading 0 */}
      </div>
    </div>
  );
}
```

## Expected findings

1. Anti-reference — purple gradient + glass blur: PRODUCT.md's named
   anti-references (generic AI SaaS look).
2. Color — raw hex + palettes outside the blue-neutral/cyan direction; no
   theme tokens.
3. Voice — "Unleash your creativity!" violates calm/precise/capable copy.
4. Empty metric tiles — the anti-reference list's dashboard pattern.

A report that misses the gradient/glass anti-reference or the voice
violation means the agent definition regressed.
