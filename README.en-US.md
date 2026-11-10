# Honkai: Star Rail Reference Site

Browse characters, light cones, relics, enemies, stages, readables and game text in Simplified Chinese, English, Japanese and Korean.

[中文说明](README.zh-CN.md) · [Project overview](README.md)

## Requirements

- Python 3.10 or newer.
- A modern browser with JavaScript enabled.
- Frontend libraries are bundled locally. Node.js and npm installation are not required.

## Run locally

From the project root:

```bash
python main.py serve
```

Open [http://localhost:9000/](http://localhost:9000/). Press `Ctrl+C` to stop the server.

Use a different port:

```bash
python main.py serve --port 3000
```

Access the site over HTTP instead of opening HTML files directly.

## Directory layout

```text
.
├── main.py                     # Local HTTP server entry
├── filelist.txt                # Static asset path list
├── site/
│   ├── pages/
│   │   ├── index.html          # Shared page entry
│   │   └── routes.json         # Routes and page configuration
│   ├── javascripts/
│   │   ├── app.js              # Application entry
│   │   ├── core/               # Language, shared UI and rich text
│   │   ├── data/               # Data loading and relationships
│   │   └── pages/              # Page logic
│   ├── data/
│   │   ├── common/             # Shared configuration and logic
│   │   ├── CH/                 # Simplified Chinese text
│   │   ├── EN/                 # English text
│   │   ├── JP/                 # Japanese text
│   │   ├── KR/                 # Korean text
│   │   └── metadata/           # Version and file indexes
│   ├── stylesheets/            # Page styles
│   ├── images/                 # Images
│   ├── fonts/                  # Fonts
│   ├── UI/                     # Shared UI assets
│   └── plugins/                # Bundled frontend libraries
└── tools/
    ├── game_data.py            # Data update and validation entry
    ├── gamedata/               # Data processing modules
    ├── site_assets.py          # Image reference checks and cleanup
    └── site_pages.py           # Page routing and static export
```

## Static deployment

```bash
python -B tools/site_pages.py export --output dist
```

The output directory must be empty. Publish the contents of `dist/` at the website root. No application backend is required.

## Maintenance

```bash
# Update site data; requires internet access, not needed for everyday browsing
python -B tools/game_data.py update

# Validate existing data
python -B tools/game_data.py validate --collection site/data

# Audit image references
python -B tools/site_assets.py audit

# Delete unreferenced images and empty image directories
python -B tools/site_assets.py prune
```

## Optional HTTPS server

The default server needs no third-party Python packages. For ASGI and HTTPS:

```bash
pip install starlette hypercorn h2
python main.py serve --cert cert.pem --key key.pem
```

## Content notice

Game content and assets belong to their respective rights holders.
