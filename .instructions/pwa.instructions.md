---
applyTo: "public/**,next.config.ts,src/app/manifest.ts"
---

# PWA (Progressive Web App) Instructions

## Setup

The project uses **serwist** (next-pwa successor) for PWA support.

## Rules

1. **Manifest** — `manifest.json` in project root (or `src/app/manifest.ts` for dynamic):
   - App name in default locale (Hebrew)
   - Icons: 192x192, 512x512, and maskable variants in `public/icons/`
   - `display: "standalone"`
   - `theme_color` matching the primary color `#1E3A5F`
   - `dir: "auto"` to support RTL/LTR

2. **Service Worker** (via serwist):
   - Cache static assets (JS, CSS, images) with cache-first strategy
   - Cache API responses with network-first strategy
   - Cache i18n locale files for offline support
   - Precache critical pages (home, members list)

3. **Offline support**:
   - Static pages should work offline after first visit
   - For dynamic data: show cached data with "last updated" timestamp
   - Show a clear offline banner when network is unavailable (translated in all 4 locales)

4. **Install prompt**:
   - Custom install prompt UI (not browser default)
   - Translation keys: `pwa.install.title`, `pwa.install.description`, `pwa.install.button`
   - Show only on supported browsers, dismiss gracefully

5. **Icons**:
   ```
   public/icons/
   ├── icon-192x192.png
   ├── icon-512x512.png
   ├── icon-maskable-192x192.png
   └── icon-maskable-512x512.png
   ```

6. **next.config.ts** — configure serwist plugin:
   ```typescript
   import withSerwistInit from '@serwist/next';
   
   const withSerwist = withSerwistInit({
     swSrc: 'src/sw.ts',
     swDest: 'public/sw.js',
     disable: process.env.NODE_ENV === 'development',
   });
   ```
