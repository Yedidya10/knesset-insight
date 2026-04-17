---
applyTo: 'src/app/**'
---

# Pages & Routing Instructions

## Rules

1. **Route groups**:
   - `(public)` — accessible to everyone, no auth needed
   - `(auth)` — login/register pages
   - `(dashboard)` — requires authentication (redirect to login if not authenticated)

2. **Every page with user-facing text** must use `next-intl`:

   ```typescript
   // Server Component
   import { getTranslations } from 'next-intl/server';

   export default async function MembersPage() {
     const t = await getTranslations('members');
     return <h1>{t('list.title')}</h1>;
   }
   ```

3. **Metadata** — use `generateMetadata` with translations for SEO:

   ```typescript
   export async function generateMetadata({ params }: Props) {
     const t = await getTranslations('members');
     return {
       title: t('meta.title'),
       description: t('meta.description'),
     };
   }
   ```

4. **PWA considerations**:
   - Critical pages should be cacheable by the service worker
   - Use `next/dynamic` for heavy components not needed on first paint
   - Add `<link rel="manifest" href="/manifest.json" />` in root layout

5. **Layout** — the root layout sets `dir` and `lang` per locale:

   ```tsx
   <html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'}>
   ```

6. **AI Chat page** — only accessible to authenticated users. Show a CTA to register for anonymous users.
