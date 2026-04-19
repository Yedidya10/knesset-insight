---
applyTo: '**/*.css,**/*.tsx,src/components/**'
---

# Styling & RTL Instructions

## Tailwind CSS RTL Rules

Hebrew and Arabic are RTL. English and Russian are LTR.
The `dir` attribute is set automatically per locale. Use Tailwind **logical properties**:

### Spacing

| ❌ Don't use | ✅ Use instead | Reason               |
| ------------ | -------------- | -------------------- |
| `ml-4`       | `ms-4`         | margin-inline-start  |
| `mr-4`       | `me-4`         | margin-inline-end    |
| `pl-4`       | `ps-4`         | padding-inline-start |
| `pr-4`       | `pe-4`         | padding-inline-end   |

### Positioning

| ❌ Don't use  | ✅ Use instead |
| ------------- | -------------- |
| `left-0`      | `start-0`      |
| `right-0`     | `end-0`        |
| `text-left`   | `text-start`   |
| `text-right`  | `text-end`     |
| `float-left`  | `float-start`  |
| `float-right` | `float-end`    |

### Borders

| ❌ Don't use | ✅ Use instead |
| ------------ | -------------- |
| `border-l`   | `border-s`     |
| `border-r`   | `border-e`     |
| `rounded-l`  | `rounded-s`    |
| `rounded-r`  | `rounded-e`    |

### Flexbox & Grid

- `flex-row` works correctly with `dir` attribute — items are automatically reversed in RTL
- For explicit control: use `rtl:flex-row-reverse` only when auto-direction is insufficient
- **Grid columns**: Always set `grid-cols-1` at mobile. Without it, grid items are not constrained to the container width, causing them to overflow **left** in RTL (since content grows from right-to-left). This makes card content (scores, percentages) invisible. Example: `grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3`

### Icons & Arrows

- Directional icons (chevrons, arrows) must flip in RTL:
  ```tsx
  <ChevronRight className="rtl:rotate-180" />
  ```

### Percentages & Numbers in RTL

Numbers and percentage signs get scrambled in RTL contexts (e.g. `(80%-60)` instead of `(60–80%)`). Apply these rules:

1. **Inline percentage values in JSX** — wrap in `dir="ltr"`:

   ```tsx
   <span className="font-bold tabular-nums" dir="ltr">
     {score}%
   </span>
   ```

2. **Percentage badges / score containers** — add `dir="ltr"` to the parent element:

   ```tsx
   <Badge variant="outline" dir="ltr">
     {t('score', { score: 80 })}
   </Badge>
   ```

3. **i18n strings with embedded percentages** — use Unicode LRI/PDI bidi isolation characters (`\u2066` / `\u2069`) around the numeric part in Hebrew and Arabic locale files:

   ```json
   "tier_label": "הצביעו בדרך כלל בעד \u2066(60–84%)\u2069"
   "score": "\u2066{score}%\u2069 בעד"
   ```

   English and Russian (LTR) locale files do **not** need bidi marks.

4. **Progress bars with percentage width** — the CSS `width` property is not affected by direction, but label text next to bars must follow rule 1.

## Dark Mode

- Always provide `dark:` variants for background and text colors
- Use CSS variables from shadcn/ui theme for consistency
