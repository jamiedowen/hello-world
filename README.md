# Wurm Unlimited Deed Planner

A free-standing, single-page deed planner for Wurm Unlimited. Plot terrain, walls,
fences, houses, deed boundaries and points of interest on a zoomable/pannable tile
grid, right in your browser. No build step, no dependencies, no server required.

Open `index.html` directly, or serve the folder with any static file server:

```sh
python3 -m http.server 8000
```

then visit `http://localhost:8000/`.

## Features

- **Terrain tool** — paint tiles with grass, dirt, sand, rock, water, floors, roads, etc.
- **Wall/Fence tool** — click near a tile edge to place wood/stone walls, fences,
  palisades, hedges, doors, or gates. Click the same type again to remove it.
- **House tool** — drag a rectangle to stamp a floored, fully-walled building in one go.
- **Deed Area tool** — paint the tiles inside your deed; the boundary is highlighted
  and tile count / rough upkeep estimate are shown live.
- **Markers** — drop labelled pins for wells, forges, altars, etc.
- **Pan & zoom** — mouse wheel to zoom (centered on the cursor), right-click/middle-click/
  space+drag/the Pan tool to pan.
- **Undo/redo** (Ctrl+Z / Ctrl+Y), resizable grid, adjustable grid/coordinate overlays.
- **Save/load** named plans to your browser (localStorage), plus JSON export/import
  and PNG export. Work also autosaves as you go.

Everything lives in three files: `index.html`, `style.css`, `app.js`.
