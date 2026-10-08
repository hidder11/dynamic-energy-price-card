# Optional color QA — v1.8.1-beta.3

## Automated gate

`npm run build && npm test && node --check dist/dynamic-energy-price-card.js && git diff --check`

Result: build succeeded; Node **24 tests, 24 pass, 0 fail**; Python **20 tests, OK**. New card-color tests were run red before implementation and green afterward. They cover semantic override/default/reset behavior, independent favorable colors, valid black, preserved false/zero values, and the optional named/flattened native RGB form schema.

## Rendered browser verification

The built bundle was loaded through `/qa/`, with a minimal `ha-card` surface and demonstration sensor intervals. Both light and dark theme variables were forced explicitly.

| Viewport | Default palette | Custom palette | Existing centered dual-tooltip overlap |
|---|---|---|---|
| 1100 × 740 | Light + dark color/interaction checks pass | Light + dark color/interaction checks pass | None at sampled points |
| 390 × 900 | Light + dark color/interaction checks pass | Light + dark color/interaction checks pass | Timeline index 96 |
| 320 × 900 | Light + dark color/interaction checks pass | Light + dark color/interaction checks pass | Timeline indices 96 and 55 |

Each of the twelve palette/theme/viewport cases checked seven timestamps including left, center, right, highest and lowest import prices. Tooltip rectangles stayed within the chart. Round markers, keyboard Home/Right/Escape, touch inspection, outside dismissal, legend toggles, optional guide removal, absence of page/card overflow, fixed black line overrides and independent fixed fill overrides all passed. The compact table uses its existing internal scrolling where necessary. No runtime errors were recorded.

Computed SVG band fills, legend backgrounds, active-period badges and table-label colors were read back for both palettes/themes. Separate checks verified negative/zero gradient stops, negative markers, resetting empty values, preserving `false` and `0`, and reversed import/export-only threshold strokes. Changing only `cheap_color` left the import-period band on the original theme green.

### Default appearance differential

The previous `HEAD` bundle (v1.8.1-beta.2) was loaded as a temporary alternate custom element. All rendered elements were compared for color, background, fill, stroke, gradient stop color, border color, font and geometry. Twelve cases covered 1100/390/320 widths × light/dark × dual-series/compact-import layouts. Defaults were identical across all cases (188 elements per dual-series card, 122 per compact card; 0.1 px geometry tolerance for the advancing Now marker). The temporary baseline script was removed afterward.

### Existing limitation, deliberately not hidden

The centered tooltip for two tariffs can overlap one marker on narrow cards because placement uses the mean of the two marker heights. This was reproduced in the **previous v1.8.1-beta.2 bundle** at the same point with identical tooltip/marker rectangles. The `_showPoint` method is byte-for-byte unchanged by the color implementation. `qaColorCheck()` records these overlaps as `existingTooltipOverlaps`, rather than claiming a clean non-overlap result. No tooltip behavior was changed; a separate focused fix remains advisable.

## Real screenshot artifacts

All four images were captured from the rendered browser and visually inspected, then copied into the repository. They are referenced by relative paths in the English README:

- `docs/images/default-dark-desktop.png`
- `docs/images/default-light-mobile.png`
- `docs/images/custom-colors-dark-desktop.png`
- `docs/images/custom-colors-light-mobile.png`

The fixture deliberately omits one export interval, so the illustrated data warning is expected, not an execution failure. These are demonstration data, not household readings.

## Reproduce

Serve the **repository root** (not the QA subdirectory):

```sh
python3 -m http.server 18765 --bind 127.0.0.1
```

Open `/qa/`, size the browser viewport, then run in its console:

```js
document.querySelector('main').style.height = '640px';
qaColorCheck(false, false); // original palette, dark
qaColorCheck(false, true);  // original palette, light
qaColorCheck(true, false);  // custom palette, dark
qaColorCheck(true, true);   // custom palette, light
qaSet({ graph_mode: 'import', current_price_mode: 'import', show_title: false,
  export_best_hours: 0, show_export_table: false }); // compact example
```

The native Home Assistant color selector UI itself was not opened in a live Home Assistant instance; the actual returned schema and callbacks were exercised in Node. No commit, push, publication, installation or live dashboard write was performed.
