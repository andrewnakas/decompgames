# Cloudflare deployment

The catalog is static Astro HTML. Pages Functions expose the R2 bucket only for GET, HEAD, and OPTIONS on `/runtime/`, `/data/`, and `/sources/`. There is no game-file upload endpoint.

1. Run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm test`.
2. Build and package the exact engine revisions. Preserve existing releases for rollback.
3. Run `pnpm exec wrangler whoami` to refresh deployment authentication.
4. Run `node scripts/upload-assets.mjs` to publish runtime packages, source archives, and data notices to `decompgames-assets`. This script uses the locally stored Wrangler OAuth token without printing it.
5. Set `PUBLIC_PLAYER_ORIGIN=https://play.decompgames.com`, then run `pnpm build` and `node scripts/check-links.mjs`.
6. Run `pnpm exec wrangler pages deploy dist --project-name decompgames --branch main`.
7. Attach `decompgames.com` and `play.decompgames.com` to the Pages project and point their Cloudflare DNS CNAMEs to `decompgames.pages.dev`.
8. Verify TLS, canonical URLs, the sitemap, byte-range responses, WASM MIME types, and every promoted game on production.

Do not use `--release` until the documented eight-instant/two-import launch gate passes. A development preview must retain clear verification labels.

The upload cache in `.cache/uploads.json` records successful content hashes. Do not edit already published immutable runtime URLs. Publish a new package revision instead.

Cost reviews: check R2 storage and operations weekly, and keep the initial combined hosting budget below $50/month. No paid plan upgrade is required by these scripts.
