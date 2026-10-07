# Dynamic Energy Price Card

A standalone Home Assistant dashboard card for comparing dynamic electricity import and export tariffs on one timeline.

Existing configurations remain import-only by default. Export prices come from a second sensor and may be adjusted with a signed offset.

## Features

- Import, export, or dual-series graph modes on one shared time axis
- Independent current-price mode: import, export, both, or hidden
- Solid import line and dashed export line with explicit legend labels
- Shared numeric thresholds with reversed export meaning: high export prices are green, low export prices are red
- Real tariff values are preserved; export prices are not sign-inverted
- Export source from a dedicated sensor; `export_price_offset` adjusts that export series
- Today's prices and optional tomorrow prices after a configurable local hour
- Current interval prices and a vertical **Now** marker
- Hover, touch, and keyboard tooltips for every visible series, including safe missing-value display
- Optional per-series average lines with unambiguous labels
- Lowest import periods and highest export periods selected independently per day
- Separate optional tables for cheapest import and best export periods
- Native Home Assistant visual editor with expandable **Afname** and **Teruglevering** groups
- Native card sizing in Home Assistant Sections views
- Responsive current-price metrics and chart from 320 px card width
- No external runtime dependencies

## Data requirements

The required `entity` is the import source. Its `data` attribute must be an array whose entries contain:

```yaml
start_time: "2026-10-07T14:00:00+02:00"
price_per_kwh: 0.2345
```

An optional `export_entity` uses the same format. It is required when export prices are shown. The offset is applied to that entity:

```text
export price = export entity price + export_price_offset
```

Offsets may be negative. The import entity is never used as the base for an export offset.

## Installation with HACS

1. Open **HACS** in Home Assistant.
2. Open **Dashboard**.
3. Select the three-dot menu and **Custom repositories**.
4. Add `https://github.com/hidder11/dynamic-energy-price-card` as a **Dashboard** repository.
5. Install **Dynamic Energy Price Card** and refresh the browser.

## Add the card

Use the Home Assistant visual editor, or add YAML manually.

### Import-only configuration

This preserves the card's original appearance and behavior:

```yaml
type: custom:dynamic-energy-price-card
entity: sensor.tibber_prijzen
title: Dynamic energy prices
show_title: true
show_hover_line: true
show_average_line: false
cheap_price: 0.15
normal_price: 0.25
expensive_price: 0.40
cheapest_hours: 4
show_cheapest_table: true
tomorrow_after: 14
```

### Import and export entities

```yaml
type: custom:dynamic-energy-price-card
entity: sensor.dynamic_import_prices
export_entity: sensor.dynamic_export_prices
graph_mode: both
current_price_mode: both
show_average_line: true
cheap_price: 0.15
normal_price: 0.25
expensive_price: 0.40
cheapest_hours: 4
export_best_hours: 4
show_cheapest_table: true
show_export_table: true
tomorrow_after: 14
```

### Export prices derived with an offset

```yaml
type: custom:dynamic-energy-price-card
entity: sensor.dynamic_import_prices
export_price_offset: -0.12
graph_mode: both
current_price_mode: export
export_best_hours: 3
show_export_table: true
```

## Configuration

| Option | Required | Default | Description |
|---|---:|---:|---|
| `entity` | Yes | — | Import sensor containing intervals in `attributes.data`. |
| `export_entity` | No | — | Export sensor with the same data format. Takes precedence over the offset. |
| `export_price_offset` | No | — | Signed EUR/kWh value used to derive export prices from import prices. |
| `graph_mode` | No | `import` | Graph series: `import`, `both`, or `export`. |
| `current_price_mode` | No | `import` | Current metrics: `import`, `both`, `export`, or `none`. |
| `title` | No | `Dynamische energieprijzen` | Card title. |
| `show_title` | No | `true` | Shows the title. When hidden, active favorable-period context uses its position. |
| `show_hover_line` | No | `true` | Shows a guide line for the active tooltip interval. |
| `show_average_line` | No | `false` | Shows a separately labelled average for each visible graph series. |
| `cheap_price` | No | `0.15` | Low threshold in EUR/kWh. Low import is favorable; low export is unfavorable. |
| `normal_price` | No | `0.25` | Middle gradient anchor in EUR/kWh. |
| `expensive_price` | No | `0.40` | High threshold in EUR/kWh. High import is unfavorable; high export is favorable. |
| `cheapest_hours` | No | `0` | Lowest import duration selected per day. `0` disables it. |
| `export_best_hours` | No | `0` | Highest export duration selected per day. `0` disables it. |
| `show_cheapest_table` | No | `false` | Shows selected import periods when `cheapest_hours` is enabled. |
| `show_export_table` | No | `false` | Shows selected export periods when `export_best_hours` is enabled. |
| `tomorrow_after` | No | `14` | Local hour after which available tomorrow intervals become visible. |

Thresholds must be ordered as:

```text
cheap_price < normal_price < expensive_price
```

An export source is required only when the selected graph mode, current-price mode, or export-period selection uses export data. The card displays a configuration error with recovery guidance when such a source is missing.

## Favorable periods

`cheapest_hours` chooses the lowest-priced import intervals per calendar day. `export_best_hours` independently chooses the highest-priced export intervals per calendar day. Intervals do not need to be consecutive; consecutive selected intervals are combined into one table row.

With quarter-hour data and a value of `4`, sixteen intervals are selected per day.

## Interaction and accessibility

- Hover, pointer drag, and touch show all visible series for the nearest interval.
- Missing values in a partially aligned series are shown as `—` without hiding the other series.
- Import and export markers are separate round HTML elements, so they remain circular when the graph resizes.
- The graph is keyboard focusable. Use Left/Right, Home, End, and Escape.
- Tooltip text is mirrored to an `aria-live` region.
- Tapping outside the chart dismisses a touch tooltip.

## Sections view sizing

In a Home Assistant **Sections** view, use the card's **Layout** tab to change its height. The graph grows or shrinks with the allocated space. Enabling either table selects the taller default; tables scroll internally at smaller supported heights.

## Troubleshooting

### No import data

- Confirm that `entity` exists.
- Check **Developer Tools → States**.
- Verify `attributes.data` is an array containing `start_time` and `price_per_kwh`.
- Verify timestamps include a valid timezone offset.

### Export source required

Configure either `export_entity` or `export_price_offset`, or change export-dependent modes and selections back to import-only settings.

### Tomorrow is missing

Check the configured `tomorrow_after` hour and whether the source sensor already contains tomorrow's intervals.

## Development

```bash
npm test
npm run build
```

The build writes the standalone HACS bundle to:

```text
dist/dynamic-energy-price-card.js
```

Do not edit the generated bundle directly.

## License

MIT
