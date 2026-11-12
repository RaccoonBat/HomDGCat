# Star Rail Reference

A local reference site built with React Hooks, TypeScript, Ant Design, and SCSS.

[简体中文](README.md) · [English](README.en-US.md)

## Features

- Characters and light cones: filters, infinite scrolling, artwork and skill details.
- Relics: Cavern Relic and Planar Ornament categories, set effects and piece stories.
- Monsters: combat variants, level scaling, weaknesses, resistances and skills.
- Readables: world categories, title/body search, and complete text directly in the list.
- Dialogue: body and speaker search in a Web Worker, world and Divergent Universe categories.
- Achievements: the game's achievement categories and completion conditions.
- Records: world categories, track descriptions and acquisition information.
- Dark theme and responsive layouts.

The interface is in Simplified Chinese. The collection retains Chinese, English, Japanese and Korean text. Dialogue without a verified location remains unclassified. Adjacent dialogue IDs do not establish narrative order.

## Requirements and startup

Use Node.js 22.13+ in the 22.x series, or Node.js 24+, with npm. Python is not needed to run the frontend.

From the project root:

```bash
npm ci
npm run dev
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Stop with Ctrl+C. Browsing uses local data and does not contact the source repositories.

## Checks and production build

```bash
npm run check
npm run format
npm run build
npm run preview
```

The preview runs on port 4173. Deploy the contents of dist/ and configure page routes to fall back to index.html. The build copies game data and images, so allow additional disk space comparable to site/.

## Structure

```text
index.html                  Vite HTML entry
src/                        React UI, Hooks, services, types and SCSS
build/site-assets.ts        Static asset middleware and build-copy source
data-update/
  game_data.py              Data command-line entry
  gamedata/                 Download, compilation, history, validation, publication
  generate-dialogue-worlds.mjs   Dialogue classification index generator
site/
  data/                     Game JSON, text shards and metadata
  images/                   Collected game images
    resources/              Images collected from the asset repository
```

site/ stores data and images. Frontend source lives in src/. JSON bundles in site/data/common/logic/ contain the game's Config, Stages and Story records and support dialogue associations.

## Data sources

The local manifest currently identifies version **4.7.0**, Consult site/data/manifest.json for inventory and checksums.

- Configuration and text: a pinned DimbreathBot/TurnBasedGameData snapshot.
- Images: existing collected sprites and pinned Mar-7th/StarRailRes assets under images/resources/.
- Missing monster, trace and readable images: exact SpriteOutput path matches from a pinned umaichanuwu/StarRailTextures snapshot. This texture source is currently at 4.3 and only supplements matching images; it does not change the game data version.
- Historical restoration: metadata/historical-sources.json, including tutorial groups 9333 and 9334 from version 3.8.0.
- Historical version labels and text ID aliases: metadata/versions.json and legacy-text-ids.json.
- Derived dialogue classifications: metadata/dialogue-worlds.json, generated from local game scripts.

These sources serve different purposes. Assets or metadata should not be discarded solely because a current page does not directly reference them.

## Updating game data

All update tools are in data-update/. Updating requires **Python 3.10+**, **Node.js**, **Git**, and network access. The Python code uses the standard library.

Set the target version, data revision and asset revision in data-update/gamedata/source.py. Updates use these pinned revisions; they do not automatically follow the newest remote commit.

```bash
npm run data:update
npm run data:validate
npm run data:dialogues
```

Equivalent Python commands:

```bash
python -B data-update/game_data.py update
python -B data-update/game_data.py validate --collection site/data
python -B data-update/game_data.py --help
```

The updater builds in a temporary directory, validates the result, and publishes the collection with rollback protection. Existing historical metadata and reusable sprites are retained. Development and production build commands check the dialogue index and regenerate it locally when stale.

## Rights

Game content and images belong to their respective rights holders.
