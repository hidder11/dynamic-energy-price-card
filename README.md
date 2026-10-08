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
- Optional semantic RGB price palette and independent favorable import/export period colors; leaving them empty preserves the original appearance
- Clickable legend items temporarily show or hide each graph series
- Data status appears only when price intervals are missing or tomorrow's published data is incomplete
- Shared numeric thresholds with reversed export meaning: high export prices are green, low export prices are red
- Real tariff values are preserved; export prices are not sign-inverted
- Export source from a dedicated sensor; `export_price_offset` adjusts that export series
- Today's prices and optional tomorrow prices after a configurable local hour
- Current interval prices and a vertical **Now** marker
- Hover, touch, and keyboard tooltips for every visible series, positioned beside rather than over the selected price point
- Optional per-series average lines with unambiguous labels
- Lowest import periods and highest export periods selected independently per day as loose intervals, one contiguous block, or blocks with a configurable minimum duration
- Adjacent favorable intervals merge into subtle full-height background bands
- Best export periods use a consistent blue highlight in light and dark themes
- One optional table for favorable import and export periods, with explicit colored type labels
- Native Home Assistant visual editor with expandable **General**, **Import**, and **Export** groups
- Progressive native editor subgroups for favorable periods and line/fill appearance
- Native card sizing in Home Assistant Sections views
- Responsive current-price metrics and chart from 320 px card width
- No external runtime dependencies

## Examples

These are real browser captures of the built card with Tibber tariff data for October 8, 2026, rendered on a standalone Home Assistant-style card surface. All examples show import only, a hidden title, and one contiguous four-hour favorable period. The table fits without scrolling. These example settings do not change an existing dashboard configuration.

### Original palette — dark desktop

The original automatic price palette and green favorable-period highlight:

![Original colors and one continuous favorable period on dark desktop](docs/images/revised-default-dark-desktop.png)

### Original palette — compact light mobile

The same compact summary, chart and favorable-period table on mobile:

<img src="docs/images/revised-default-light-mobile.png" alt="Original palette and compact import summary on light mobile" width="390">

### Custom price colors and independent period highlights

Blue and rose price colors with an independent purple favorable-period highlight. Changing these colors does not change the layout or selected period.

![Custom colors with an independent purple period highlight on dark desktop](docs/images/revised-custom-dark-desktop.png)

<img src="docs/images/revised-custom-light-mobile.png" alt="Custom price and favorable-period colors on light mobile" width="390">

Example settings:

```yaml
show_title: false
cheapest_hours: 4
import_selection_mode: contiguous
show_cheapest_table: true
cheap_color: [130, 90, 240]
normal_color: [50, 140, 210]
expensive_color: [225, 90, 125]
import_favorable_color: [140, 100, 230]
```

Export-period colors can be customized independently with `export_favorable_color`. Leave any color empty to retain its original default.

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
| `cheap_color` | No | Theme success color | Optional RGB override for favorable price semantics: low import / high export. |
| `normal_color` | No | `#f2a93b` | Optional RGB override for normal prices. |
| `expensive_color` | No | Theme error color | Optional RGB override for unfavorable price semantics: high import / low export. |
| `zero_color` | No | `#18a999` | Optional RGB override for the zero-price anchor in the import gradient. |
| `negative_color` | No | `#168aad` | Optional RGB override for negative import prices and markers. |
| `import_favorable_color` | No | Theme success color | Independent favorable import bands, legend, active-period badges, and table labels. Not linked to `cheap_color`. |
| `export_favorable_color` | No | `#1976d2` | Independent favorable export bands, legend, active-period badges, and table labels. Also supplies the automatic export fill color unless `export_fill_color` is set. |
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

The visual editor groups configuration under **General**, **Import**, and **Export**. Price thresholds and the expandable **Price colors** (`Prijskleuren`) subgroup are in **General**. Independent period colors are in each tariff's **Favorable periods** subgroup. All settings are stored as flat YAML keys, so existing configurations remain compatible.

Colors are optional RGB arrays with three channels from 0 to 255. Remove a key or clear its color selector to restore the original automatic/theme-derived default; empty arrays and null values also fall back safely. `[0, 0, 0]` is valid black. Changing a price color does not change the independent favorable-period highlights. Price colors are shared by gradients, current-price values, reference lines, and hover markers, with the existing reversed export meaning. `zero_color` changes the zero anchor in the import gradient without changing the existing price classification. Fixed `import_line_color` / `export_line_color` still override the line and marker colors; explicit fill colors remain independent. No default palette, opacity, spacing, or layout changes are required.

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
