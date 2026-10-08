# Localization QA — local 1.8.1-beta.4

## Scope and result

Dutch and English localization is implemented without changing the approved beta.3 stylesheet, geometry, colors, opacity or configuration switches. No commit, push, release, installation or dashboard change was performed.

- `npm run build`: PASS; standalone `dist/dynamic-energy-price-card.js` generated.
- `npm test`: PASS; 31 Node tests and 20 Python tests (51 total).
- Source, localization module, utilities, browser helper and generated bundle: `node --check` PASS.
- `git diff --check`: PASS.
- TDD red/green checks covered automatic language/title rendering, native callback context, accessible `lang`, and reactive card-picker metadata.

## Native editor contract

The current Home Assistant frontend implementation was inspected, not guessed:

- `getConfigForm()` is called without a `hass` argument.
- `hui-form-editor` invokes the installed callbacks as `this.computeLabel(schema, this.hass.localize)` and `this.computeHelper(schema, this.hass.localize)`.
- Ordinary callbacks can therefore read the native editor's `this.hass`; a frontend-root fallback also supports standalone form consumers. Dynamic schema titles, selector options and hour units resolve from the frontend root.
- All 49 schema entries, including named flattened groups, were traversed and their labels checked in both languages. Helper text, options and units were also checked.
- Flat YAML keys, explicit false, zero, empty RGB resets and black RGB remain supported. The title selector does not persist an automatic localized default as custom text.

Primary references inspected:

```text
https://github.com/home-assistant/developers.home-assistant/blob/master/docs/frontend/custom-ui/custom-card.md
https://raw.githubusercontent.com/home-assistant/frontend/dev/src/panels/lovelace/editor/card-editor/hui-card-element-editor.ts
https://raw.githubusercontent.com/home-assistant/frontend/dev/src/panels/lovelace/editor/config-elements/hui-form-editor.ts
https://raw.githubusercontent.com/home-assistant/frontend/dev/src/panels/lovelace/types.ts
```

This was native-form contract verification plus standalone browser rendering, not an installation into the live Home Assistant editor.

## Browser verification

Tested the built bundle at 960, 390 and 320 px in English and Dutch, in import-only, both-series and export-only graph modes: 18 rendering cases. Seven timestamps per case included left, center, right, highest and lowest prices: 126 tooltip checks. Every tooltip remained within the chart bounds.

The reusable `window.checkLocalization()` helper passed six language/width combinations. It verifies default titles, accessible language, all named flat editor schema entries, translated helpers/options, keyboard Home/End/arrows/Escape, touch and outside dismissal, legend toggling, missing-export announcements, and disabled-guide behavior. Existing `window.qaColorCheck(custom, light)` passed all 12 width/theme/palette cases, including black fixed colors and independent favorable colors.

The production `_styles()` method was compared byte-for-byte against beta.3. An alternate beta.3 custom element was also rendered beside each README example: chart, compact header, table wrapper, tariff path and band geometry matched within 0.1 px; computed fills and strokes matched exactly. The temporary reference bundle was removed afterward.

### Known unchanged baseline limitations

- Centered dual-series tooltips can overlap one marker on narrow screens. Six of the 126 probes encountered this across both languages. The affected 390/320 px timestamps were compared directly with beta.3 and had the same overlap behavior. Single-series probes had no marker overlaps. This localization change intentionally does not redesign the approved tooltip layout.
- At 320 px, the compact table retains its existing horizontal scrolling behavior; the real snapshot measured 22 px of scrollable overflow in Dutch and 26 px in English. No page/header overflow occurs, and all rows remain accessible. The approved 390 px mobile and 960 px desktop README examples have no page or table scrolling.

## README screenshots and provenance

All four approved paths were regenerated from the final built bundle with English card labels:

- `docs/images/revised-default-dark-desktop.png` — 960 × 560
- `docs/images/revised-custom-dark-desktop.png` — 960 × 560
- `docs/images/revised-default-light-mobile.png` — 390 × 540
- `docs/images/revised-custom-light-mobile.png` — 390 × 540

Each capture was visually reviewed and verified for zero horizontal/vertical page and table overflow, a complete compact import summary, one table row and one contiguous four-hour band. Default/custom pairs use identical data, dimensions, selection and example time. Only palette overrides differ.

The snapshot was read from the real Home Assistant `sensor.tibber_prijzen`: 96 quarter-hour intervals for October 8, 2026, saved in `docs/examples/tibber-2026-10-08.json` with source/timezone/cadence metadata. The viewer fixes its example clock at 19:00 Europe/Amsterdam, showing 38.70 ct/kWh and the selected 12:15–16:15 block. `tomorrow_after: 24` is an example-only setting for this one-day snapshot; production still defaults to 14. No data was synthesized for the README images. Deliberately synthetic stress data remains in `qa/`.

## Reproduce

Serve the repository root locally:

```bash
npm run build
npm test
python3 -m http.server 18765 --bind 127.0.0.1
```

Open `/qa/` and run `window.checkLocalization()` in the browser console. Open `/docs/examples/?theme=dark&palette=default` or `?theme=light&palette=custom` for the real README fixture. Wait for `window.exampleReady === true` before measuring or capturing; the JSON snapshot is loaded asynchronously. Use desktop 960 × 560 or mobile 390 × 540 for the approved captures. Stop the temporary server after checking.
