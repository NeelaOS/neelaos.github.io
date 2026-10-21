# neelaos.github.io

The official NeelaOS website: <https://neelaos.github.io/>. Plain HTML, CSS and JavaScript, no framework, no dependencies.

## Updating the site (download link, version, FAQ…)

Everything you'll want to change lives in **[`data/site.json`](data/site.json)**:

| Key | What it controls |
|---|---|
| `release.available` | `false` shows the "coming soon" notice; set to `true` when the ISO is out |
| `release.version`, `release.date`, `release.isoSize`, `release.sha256`, `release.notesUrl` | Version badge, specs, checksum shown on the page and in search/AI metadata |
| `download.isoUrl`, `download.sha256Url` | Direct file links. While empty, every Download button points to `download.releasesLatestUrl` |
| `download.mirrors` | Optional extra links, e.g. `[{ "name": "SourceForge", "url": "https://…" }]` |
| `author`, `links`, `requirements`, `shortcuts`, `devPacks`, `wallpapers`, `faq` | The matching sections of the page |

Then rebuild (Node 18+, nothing to install):

```bash
node build.mjs
```

and commit the generated files. GitHub Pages serves them as they are.

## Automatic release sync

[`.github/workflows/sync-release.yml`](.github/workflows/sync-release.yml) runs every hour (or from **Actions → Sync latest NeelaOS release → Run workflow**). It calls [`scripts/sync-release.mjs`](scripts/sync-release.mjs), which reads the latest release of `links.repo` (NeelaOS/NeelaOS) through the GitHub API and updates `data/site.json`:

- always: `version`, `date`, `notesUrl` (the release page)
- when the release has an `.iso` file attached: `isoFile`, `isoSize`, `isoUrl`, and `available: true`
- when it has a `.sha256` file: `sha256Url` and the checksum itself

Then it rebuilds, commits and triggers a GitHub Pages build. Nothing is committed if the release didn't change.

GitHub limits each release file to 2 GB. If the ISO is hosted somewhere else, put its link in `download.isoUrl` by hand and set `release.available` to `true`; the sync never overwrites those when the release has no `.iso`.

**Instant updates (optional).** To refresh the site the moment a release is published, add a fine-grained token with *Contents: read & write* on `NeelaOS/neelaos.github.io` as the secret `WEBSITE_DISPATCH_TOKEN` in NeelaOS/NeelaOS, and add this workflow there:

```yaml
name: Notify website
on:
  release:
    types: [published]
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.WEBSITE_DISPATCH_TOKEN }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/NeelaOS/neelaos.github.io/dispatches \
            -d '{"event_type":"neelaos-release"}'
```

## How it's put together

```
data/site.json        ← edit this
src/                  ← page templates ({{placeholders}}), rendered by build.mjs
css/style.css         ← styles (minified and inlined into the HTML at build time)
js/main.js            ← interactions: nav, Start menu, cursor, demos, wallpaper picker
img/ fonts/ logo/     ← optimized assets (AVIF + WebP)
build.mjs             ← the builder

index.html, 404.html, sitemap.xml, robots.txt,
llms.txt, llms-full.txt, site.webmanifest   ← generated, don't edit by hand
```

Search engines and AI assistants read the generated static HTML, plus `sitemap.xml`, `llms.txt` and the schema.org data embedded in the page, so the download links are visible to them without running JavaScript.
