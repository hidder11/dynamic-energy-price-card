# Grid-import energy overlay — local verification

Local package version: **1.9.0-beta.3**, based on `989e6f9` (beta.2). No commit, publication, installation or live dashboard/configuration change was made.

## Data provenance

Read-only snapshot from Home Assistant **2026.10.0**, Europe/Amsterdam, on 11 October 2026:

- Grid-import meter: `sensor.xemex_smart_p1_connect_xmxkaac000000601_afgenomen_energie`; `kWh`, `device_class: energy`, `state_class: total_increasing`.
- Real price source: `sensor.tibber_prijzen`.
- Both REST history and hourly recorder statistics were retrieved successfully. Version-matched API implementations were checked in `homeassistant/components/history/__init__.py` and `homeassistant/components/recorder/websocket_api.py` in the Core 2026.10.0 source.
- REST history flags include `significant_changes_only=0`, `minimal_response`, `no_attributes`, and `skip_initial_state`. Skipping the generated initial state avoids treating a query-start timestamp as an actual meter observation.
- 9,104 raw history rows were reduced to 1,291 authentic observations for the standalone snapshot. Every quarter-hour boundary's preceding observation and every reset/unavailable/long-gap edge were retained; no readings were interpolated.
- At frozen snapshot time 21:00:30 CEST, there are 84 completed quarter-hour slots, **74 valid measured deltas** and **10 rejected intervals** containing transient cumulative-meter decreases. Gaps remain visible; later hours have no consumption predictions.
- The utility accepts the last real observation at/before a boundary within a maximum five-minute tolerance, and rejects longer gaps, unavailable readings, negative values and decreases. This is recorded boundary-delta energy, not exact sub-second billing measurement.
- Hourly fallback was also exercised using the authentic recorder rows with history deliberately unavailable. Its legend and tooltip retain the true hour interval; hourly energy is never divided into quarter-hour values.

`docs/examples/consumption.html` replays this real snapshot through the same asynchronous card API interfaces; it is **not the live dashboard**. Export tariff values used by `qa/consumption-checks.js` are explicitly synthetic duplicated-import values solely to test graph modes.

## Automated gates

Passed: `npm run build`, `npm test` (**47 Node + 20 Python tests**), `node --check dist/dynamic-energy-price-card.js`, and `git diff --check`.

New regression tests cover boundary energy deltas, resets/unavailable/gaps, future intervals, hourly statistics, DST, source/config changes, expired cache, pending request invalidation, HA reconnect/disconnect, defaults/flat localized editor, all graph modes, independent fill/line controls and tooltip values/placement.

## Browser verification

`docs/QA-CONSUMPTION-RESULTS.json` records the six-entry matrix: **960 / 390 / 320 px**, each dark/light, with EN/NL and import/export/both within each run. Each entry passed **257 assertions**, including **15 optional-off baseline element comparisons** against the unchanged HEAD bundle: geometry, paths and computed colors matched. The consumption axis reserves only 32 px; consumption does not change the price scale.

Measured checks include 1.5 px default line/no fill, dashed/dotted/solid styling, black colors, flat/fading fills, legend hide/restore, keyboard/touch/dismissal, guides disabled, honest gaps/future tooltip, async fallback and no requests when disabled. Selected tooltip positions stayed inside the chart and avoided every marker in both languages at all tested widths.

Existing localization/color browser checks passed at 960 and 390 px (results in `docs/QA-CONSUMPTION-LEGACY-RESULTS.json`). EN/NL localization/keyboard/touch also passed at 320 px.

### Existing narrow-width limitations (not introduced by the overlay)

- At 320 px the compact favorable-period table needs internal horizontal scrolling. The standalone QA stress fixture's card-content overflow is identical in beta.2 and this build: card width 289, content width 308, table width 332/client width 250. The default appearance was deliberately preserved rather than changing unrelated table/summary CSS.
- Existing price-only dual-series tooltip overlap remains on one 390 px stress-fixture sample; the unchanged baseline already has it. Consumption-enabled placement avoids that overlap.

## Visually inspected real-data captures

- `docs/images/consumption-real-dark-desktop.png` — 960 px dark.
- `docs/images/consumption-real-light-mobile.png` — 390 px light.

Both show a thin muted energy line, independent kWh labels, honest incomplete-history status, and the preserved compact chart/header/table. No page/table overflow in these representative captures.

## Reproduction

Serve the project root: `python3 -m http.server 18768 --bind 127.0.0.1`. Open `/docs/examples/consumption.html?theme=light` (or dark). Import `../../qa/consumption-checks.js` in its console and run `await checkConsumption()`.

For baseline comparison only, generate a temporary `qa/reference-temp.js` from `git show 989e6f9:dist/dynamic-energy-price-card.js`, replacing `dynamic-energy-price-card` with `reference-energy-price-card`. Pass `../../qa/reference-temp.js` to `checkConsumption`, then remove the temporary file. The temporary comparison bundle and QA server were removed/stopped after verification.
