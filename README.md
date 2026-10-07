# Dynamic Energy Price Card

A Home Assistant dashboard card for visualizing dynamic electricity prices.

The card shows today's prices, optionally adds tomorrow's prices after a configurable time, highlights the cheapest moments, and displays the current price interval.

## Features

- Prices for today and tomorrow
- Configurable time before tomorrow's prices become visible
- Current interval price and a vertical **Now** marker
- Interactive price details using hover, touch, or keyboard controls
- Configurable cheap, normal, and expensive price levels
- Blue-green coloring for negative prices
- Optional highlighting of the cheapest moments per day
- Optional table with the day, start time, end time, and duration of each cheapest period
- Native Home Assistant visual editor
- Responsive layout for desktop and mobile dashboards

## Requirements

You need a Home Assistant sensor with a `data` attribute containing the price intervals.

Each interval must contain:

```yaml
start_time: "2026-10-07T14:00:00+02:00"
price_per_kwh: 0.2345
```

The card was designed for a Tibber price sensor, but it can use another sensor when it provides the same structure.

## Installation with HACS

1. Open **HACS** in Home Assistant.
2. Open **Dashboard**.
3. Select the three-dot menu in the top-right corner.
4. Select **Custom repositories**.
5. Add:

   ```text
   https://github.com/hidder11/dynamic-energy-price-card
   ```

6. Select **Dashboard** as the category.
7. Install **Dynamic Energy Price Card**.
8. Refresh your browser after installation.

## Add the card to a dashboard

1. Open the dashboard you want to edit.
2. Select **Edit dashboard**.
3. Select **Add card**.
4. Search for **Dynamic Energy Price Card**.
5. Select your price sensor and adjust the options in the visual editor.

You can also add the card manually:

```yaml
type: custom:dynamic-energy-price-card
entity: sensor.tibber_prijzen
title: Dynamic energy prices
cheap_price: 0.15
normal_price: 0.25
expensive_price: 0.40
cheapest_hours: 4
show_cheapest_table: true
tomorrow_after: 14
```

## Configuration

| Option | Required | Default | Description |
|---|---:|---:|---|
| `entity` | Yes | — | Sensor containing the price intervals in its `data` attribute. |
| `title` | No | `Dynamic energy prices` | Title displayed above the graph. |
| `cheap_price` | No | `0.15` | Cheap-price level in EUR/kWh. |
| `normal_price` | No | `0.25` | Normal-price anchor used by the line gradient. |
| `expensive_price` | No | `0.40` | Expensive-price level in EUR/kWh. |
| `cheapest_hours` | No | `0` | Total cheapest duration selected per day. Set to `0` to disable highlighting. |
| `show_cheapest_table` | No | `false` | Shows a table of the selected cheapest periods. Requires `cheapest_hours` to be enabled. |
| `tomorrow_after` | No | `14` | Local hour after which tomorrow's available prices are shown. |

The price levels must be ordered as:

```text
cheap_price < normal_price < expensive_price
```

## Cheapest moments

`cheapest_hours` selects the cheapest individual price intervals whose combined duration reaches the configured number of hours.

The intervals do not need to be consecutive. In the optional table, consecutive selected intervals are combined into a single period.

For example, with quarter-hour prices and `cheapest_hours: 4`, the card selects sixteen quarter-hour intervals per day.

## Tomorrow's prices

Tomorrow's prices are hidden until the local hour configured with `tomorrow_after`. The default is `14`, meaning 14:00 in your Home Assistant timezone.

Tomorrow is only shown when the source sensor already contains valid price intervals for that day.

## Troubleshooting

### The card is not available in the card picker

- Confirm that the repository is installed under **HACS → Dashboard**.
- Refresh the browser completely.
- Check that the resource starts with `/hacsfiles/dynamic-energy-price-card/`.

### No price data is shown

- Confirm that the configured entity exists.
- Open the entity in **Developer Tools → States**.
- Verify that its `data` attribute is an array containing `start_time` and `price_per_kwh`.
- Verify that the timestamps include a valid timezone offset.

### Tomorrow is missing

- Check whether the current local time is later than `tomorrow_after`.
- Check whether the sensor already contains tomorrow's intervals.

## Development

```bash
npm run build
npm test
```

The standalone HACS bundle is written to:

```text
dist/dynamic-energy-price-card.js
```

## License

MIT
