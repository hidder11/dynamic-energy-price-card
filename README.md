# Dynamic Energy Price Card

A standalone Home Assistant dashboard card for comparing dynamic electricity import and export tariffs on one timeline.

Existing configurations remain import-only by default. Export prices come from a second sensor and may be adjusted with a signed offset.

## Features

- Import, export, or dual-series graph modes on one shared time axis
- Independent current-price mode: import, export, both, or hidden
- Solid import line and dashed export line with explicit legend labels
- Clearly separated export dashes with matching graph and legend patterns
- Independent line style (`solid`, `dashed`, or `dotted`), thickness, and optional fixed RGB color for import and export
- Optional per-series area fill with an independent RGB color and configurable vertical fade
- Clickable legend items temporarily show or hide each graph series
- Compact source-freshness, tomorrow-availability, and missing-interval status
- Shared numeric thresholds with reversed export meaning: high export prices are green, low export prices are red
- Real tariff values are preserved; export prices are not sign-inverted
- Export source from a dedicated sensor; `export_price_offset` adjusts that export series
- Today's prices and optional tomorrow prices after a configurable local hour
- Current interval prices and a vertical **Now** marker
- Hover, touch, and keyboard tooltips for every visible series, including safe missing-value display
- Optional per-series average lines with unambiguous labels
- Lowest import periods and highest export periods selected independently per day as loose intervals, one contiguous block, or blocks with a configurable minimum duration
- Adjacent favorable intervals merge into quiet bottom/import and top/export time rails
- Best export periods use a consistent blue highlight in light and dark themes
- One optional table for favorable import and export periods, with explicit colored type labels
- Native Home Assistant visual editor with expandable **General**, **Import**, and **Export** groups
- Progressive native editor subgroups for favorable periods and line/fill appearance
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
show_price_levels: true
import_line_style: solid
import_line_width: 3.5
show_import_fill: true
import_fill_fade: true
import_selection_mode: minimum_blocks
import_minimum_duration: 30
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

### Correct an export entity with an offset

```yaml
type: custom:dynamic-energy-price-card
entity: sensor.dynamic_import_prices
export_entity: sensor.dynamic_export_prices
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
| `export_entity` | No | — | Export sensor with the same data format. Required when export information is shown. |
| `export_price_offset` | No | — | Signed EUR/kWh correction applied to the export entity prices. |
| `graph_mode` | No | `import` | Graph series: `import`, `both`, or `export`. |
| `current_price_mode` | No | `import` | Current metrics: `import`, `both`, `export`, or `none`. |
| `title` | No | `Dynamische energieprijzen` | Card title. |
| `show_title` | No | `true` | Shows the title. When hidden, active favorable-period context uses its position. |
| `show_hover_line` | No | `true` | Shows a guide line for the active tooltip interval. |
| `show_average_line` | No | `false` | Shows a separately labelled average for each visible graph series. |
| `show_price_levels` | No | `true` | Shows the cheap, normal, and expensive reference lines and their price labels. |
| `import_line_style` | No | `solid` | Import line style: `solid`, `dashed`, or `dotted`. |
| `import_line_width` | No | `3.5` | Import line thickness from 1 to 8 px. |
| `import_line_color` | No | — | Optional RGB color override. Empty keeps automatic threshold colors. |
| `show_import_fill` | No | `true` | Shows a transparent fill below the import line. |
| `import_fill_color` | No | — | Optional RGB fill color. Empty uses the Home Assistant primary color. |
| `import_fill_fade` | No | `true` | Fades the import fill towards the bottom of the chart. |
| `import_selection_mode` | No | `individual` | `individual`, `contiguous`, or `minimum_blocks`. |
| `import_minimum_duration` | No | `30` | Minimum block duration in minutes for `minimum_blocks`. |
| `export_line_style` | No | `dashed` | Export line style: `solid`, `dashed`, or `dotted`. |
| `export_line_width` | No | `3.5` | Export line thickness from 1 to 8 px. |
| `export_line_color` | No | — | Optional RGB color override. Empty keeps automatic reversed threshold colors. |
| `show_export_fill` | No | `false` | Shows a transparent fill below the export line. |
| `export_fill_color` | No | — | Optional RGB fill color. Empty uses the export highlight blue. |
| `export_fill_fade` | No | `true` | Fades the export fill towards the bottom of the chart when enabled. |
| `export_selection_mode` | No | `individual` | `individual`, `contiguous`, or `minimum_blocks`. |
| `export_minimum_duration` | No | `30` | Minimum block duration in minutes for `minimum_blocks`. |
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

The visual editor groups configuration under **General**, **Import**, and **Export**. Price thresholds are in **General**. Line appearance settings are stored as flat YAML keys, so existing configurations remain compatible.

An export source is required only when the selected graph mode, current-price mode, or export-period selection uses export data. The card displays a configuration error with recovery guidance when such a source is missing.

## Favorable periods

`cheapest_hours` chooses the lowest-priced import duration per calendar day. `export_best_hours` independently chooses the highest-priced export duration. Each tariff supports three modes:

- `individual`: the best loose intervals;
- `contiguous`: one best contiguous block;
- `minimum_blocks`: the best one or more blocks, where every block meets the configured minimum duration.

Selected import and export periods share one table and remain clearly labelled.

With quarter-hour data and a value of `4`, sixteen intervals are selected per day.

## Interaction and accessibility

- Hover, pointer drag, and touch show all visible series for the nearest interval.
- Missing values in a partially aligned series are shown as `—` without hiding the other series.
- Import and export markers are separate round HTML elements, so they remain circular when the graph resizes.
- The graph is keyboard focusable. Use Left/Right, Home, End, and Escape.
- Tooltip text is mirrored to an `aria-live` region.
- Tapping outside the chart dismisses a touch tooltip.
- Clicking an import or export legend item toggles that graph series without changing the saved configuration.

## Sections view sizing

In a Home Assistant **Sections** view, use the card's **Layout** tab to change its height. The graph grows or shrinks with the allocated space. Enabling either table selects the taller default; tables scroll internally at smaller supported heights.

## Troubleshooting

### No import data

- Confirm that `entity` exists.
- Check **Developer Tools → States**.
- Verify `attributes.data` is an array containing `start_time` and `price_per_kwh`.
- Verify timestamps include a valid timezone offset.

### Export source required

Configure `export_entity`, or change export-dependent modes and selections back to import-only settings.

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
