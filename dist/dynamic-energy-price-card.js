// Dynamic Energy Price Card — HACS dashboard bundle
function zonedParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function localDayKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localHour(value, timeZone) {
  return Number(zonedParts(value, timeZone).hour);
}

function addDaysToKey(dayKey, days) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function classifyPrice(price, threshold = 0.25) {
  return Number(price) < Number(threshold) ? 'cheap' : 'expensive';
}

function classifyPriceLevel(price, cheapPrice = 0.15, normalPrice = 0.25, expensivePrice = 0.40) {
  const value = Number(price);
  if (value < 0) return 'negative';
  if (value <= Number(cheapPrice)) return 'cheap';
  if (value <= Number(expensivePrice)) return 'normal';
  return 'expensive';
}

function isCheapestHoursEnabled(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function groupSelectedPeriods(points, selected, intervalMinutes) {
  const intervalMs = Number(intervalMinutes) * 60000;
  const periods = [];
  const chosen = points
    .filter((point) => selected.has(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  for (const point of chosen) {
    const last = periods.at(-1);
    const endTimestamp = point.timestamp + intervalMs;
    if (last && last.dayKey === point.dayKey && last.endTimestamp === point.timestamp) {
      last.endTimestamp = endTimestamp;
      last.durationMinutes += Number(intervalMinutes);
    } else {
      periods.push({
        dayKey: point.dayKey,
        startTimestamp: point.timestamp,
        endTimestamp,
        durationMinutes: Number(intervalMinutes),
      });
    }
  }
  return periods;
}

function createPriceTicks(minimum, maximum, count = 5) {
  const size = Math.max(2, Math.trunc(count));
  const step = (Number(maximum) - Number(minimum)) / (size - 1);
  return Array.from({ length: size }, (_, index) => Number((Number(maximum) - step * index).toFixed(10)));
}

function normalizePoints(data, timeZone) {
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      const timestamp = new Date(entry?.start_time).getTime();
      const price = Number(entry?.price_per_kwh);
      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) return null;
      return {
        startTime: entry.start_time,
        timestamp,
        price,
        dayKey: localDayKey(timestamp, timeZone),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function getVisiblePoints(data, now = new Date(), timeZone = 'Europe/Amsterdam', tomorrowAfterHour = 14) {
  const today = localDayKey(now, timeZone);
  const tomorrow = addDaysToKey(today, 1);
  const showTomorrow = localHour(now, timeZone) >= Number(tomorrowAfterHour);
  return normalizePoints(data, timeZone).filter(
    (point) => point.dayKey === today || (showTomorrow && point.dayKey === tomorrow),
  );
}

function splitByLocalDay(points) {
  const groups = new Map();
  for (const point of points) {
    if (!groups.has(point.dayKey)) groups.set(point.dayKey, []);
    groups.get(point.dayKey).push(point);
  }
  return groups;
}

function inferIntervalMinutes(points) {
  const differences = [];
  for (let index = 1; index < points.length; index += 1) {
    const minutes = (points[index].timestamp - points[index - 1].timestamp) / 60000;
    if (minutes > 0 && minutes <= 180) differences.push(minutes);
  }
  if (!differences.length) return 60;
  differences.sort((a, b) => a - b);
  return differences[Math.floor(differences.length / 2)];
}

function findCurrentPoint(points, now = new Date()) {
  if (!points.length) return null;
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const intervalMs = inferIntervalMinutes(points) * 60000;
  return points.find((point) => point.timestamp <= timestamp && timestamp < point.timestamp + intervalMs) ?? null;
}

function selectCheapestDuration(points, totalMinutes = 240) {
  const selected = new Set();
  if (!points.length || totalMinutes <= 0) return selected;
  const intervalMinutes = inferIntervalMinutes(points);
  const count = Math.min(points.length, Math.ceil(totalMinutes / intervalMinutes));
  const ordered = [...points].sort(
    (left, right) => left.price - right.price || left.timestamp - right.timestamp,
  );
  for (const point of ordered.slice(0, count)) selected.add(point.timestamp);
  return selected;
}

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 330;
const PLOT = { left: 44, right: 12, top: 20, bottom: 34 };

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatPrice = (value, digits = 2) => new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(Number(value) * 100);

const formatTime = (timestamp, timeZone) => new Intl.DateTimeFormat('nl-NL', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(timestamp));

const formatDay = (timestamp, timeZone) => new Intl.DateTimeFormat('nl-NL', {
  timeZone,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}).format(new Date(timestamp));

const smoothPath = (coordinates) => {
  if (!coordinates.length) return '';
  if (coordinates.length === 1) return `M ${coordinates[0][0]} ${coordinates[0][1]}`;
  let path = `M ${coordinates[0][0]} ${coordinates[0][1]}`;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const middle = (previous[0] + current[0]) / 2;
    path += ` C ${middle} ${previous[1]}, ${middle} ${current[1]}, ${current[0]} ${current[1]}`;
  }
  return path;
};

class DynamicEnergyPriceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // static getConfigElement() {
  //   return document.createElement('dynamic-energy-price-card-editor');
  // }
  static getConfigForm() {
  const labels = {
    entity: 'Prijsentity',
    title: 'Titel',
    cheap_price: 'Goedkoop',
    normal_price: 'Normaal',
    expensive_price: 'Duur',
    cheapest_hours: 'Goedkoopste uren per dag',
    show_cheapest_table: 'Tabel goedkoopste momenten',
    tomorrow_after: 'Morgenprijzen tonen vanaf',
  };

  return {
    schema: [
      {
        name: 'entity',
        required: true,
        selector: {
          entity: {
            domain: 'sensor',
          },
        },
      },

      {
        name: 'title',
        selector: {
          text: {},
        },
      },

      {
        name: 'cheap_price',
        required: true,
        selector: {
          number: {
            min: 0,
            max: 1,
            step: 0.01,
            mode: 'slider',
            unit_of_measurement: '€/kWh',
          },
        },
      },

      {
        name: 'normal_price',
        required: true,
        selector: {
          number: {
            min: 0,
            max: 1,
            step: 0.01,
            mode: 'slider',
            unit_of_measurement: '€/kWh',
          },
        },
      },

      {
        name: 'expensive_price',
        required: true,
        selector: {
          number: {
            min: 0,
            max: 1,
            step: 0.01,
            mode: 'slider',
            unit_of_measurement: '€/kWh',
          },
        },
      },

      {
        name: 'cheapest_hours',
        selector: {
          number: {
            min: 0,
            max: 24,
            step: 1,
            mode: 'slider',
            unit_of_measurement: 'uur',
          },
        },
      },

      {
        name: 'show_cheapest_table',
        selector: {
          boolean: {},
        },
      },

      {
        name: 'tomorrow_after',
        required: true,
        selector: {
          number: {
            min: 0,
            max: 23,
            step: 1,
            mode: 'slider',
            unit_of_measurement: 'uur',
          },
        },
      },
    ],

    computeLabel: (schema) => {
      return labels[schema.name] ?? schema.name;
    },

    computeHelper: (schema) => {
      switch (schema.name) {
        case 'cheap_price':
          return 'Onder deze prijs wordt een uur als goedkoop gemarkeerd.';
        case 'normal_price':
          return 'Prijsgrens tussen normaal en duur.';
        case 'expensive_price':
          return 'Vanaf deze prijs wordt een uur als duur gemarkeerd.';
        case 'cheapest_hours':
          return '0 schakelt de markering van goedkoopste uren uit.';
        case 'show_cheapest_table':
          return 'Toont aaneengesloten goedkoopste momenten onder de grafiek.';
        case 'tomorrow_after':
          return 'Vanaf dit uur worden beschikbare morgenprijzen getoond.';
        default:
          return undefined;
      }
    },
  };
}

  static getStubConfig() {
    return {
      entity: 'sensor.tibber_prijzen',
      title: 'Dynamische energieprijzen',
      cheap_price: 0.15,
      normal_price: 0.25,
      expensive_price: 0.40,
      cheapest_hours: 0,
      show_cheapest_table: false,
      tomorrow_after: 14,
    };
  }

  setConfig(config) {
    if (!config?.entity) throw new Error('Een Tibber-prijsentity is verplicht.');
    this._config = {
      title: 'Dynamische energieprijzen',
      cheap_price: 0.15,
      normal_price: 0.25,
      expensive_price: 0.40,
      cheapest_hours: 0,
      show_cheapest_table: false,
      tomorrow_after: 14,
      ...config,
    };
    const levels = [this._config.cheap_price, this._config.normal_price, this._config.expensive_price].map(Number);
    if (!levels.every(Number.isFinite) || !(levels[0] < levels[1] && levels[1] < levels[2])) {
      throw new Error('Prijsniveaus moeten oplopen: goedkoop < normaal < duur.');
    }
    this._lastSignature = null;
    this._activeIndex = null;
  }

  getCardSize() {
    return 6;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const state = hass.states[this._config.entity];
    const minute = Math.floor(Date.now() / 60000);
    const signature = `${state?.last_updated ?? 'missing'}|${minute}|${hass.themes?.darkMode ?? false}`;
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this._render();
    }
  }

  connectedCallback() {
    if (this._hass && this._config) this._render();
  }

  _render() {
    const state = this._hass?.states?.[this._config.entity];
    if (!state) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Entiteit niet gevonden',
        `Controleer ${escapeHtml(this._config.entity)} in de cardconfiguratie.`,
      );
      return;
    }

    const timeZone = this._hass.config.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const rawData = state.attributes?.data;
    const points = getVisiblePoints(rawData, now, timeZone, this._config.tomorrow_after);
    if (!points.length) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Nog geen prijsgegevens',
        'De Tibber-prijsentity bevat geen kwartierprijzen voor vandaag.',
      );
      return;
    }

    const groups = splitByLocalDay(points);
    const cheapestEnabled = isCheapestHoursEnabled(this._config.cheapest_hours);
    const selected = new Set();
    if (cheapestEnabled) {
      for (const dayPoints of groups.values()) {
        for (const timestamp of selectCheapestDuration(dayPoints, Number(this._config.cheapest_hours) * 60)) {
          selected.add(timestamp);
        }
      }
    }

    const intervalMinutes = inferIntervalMinutes(points);
    const intervalMs = intervalMinutes * 60000;
    const cheapPrice = Number(this._config.cheap_price);
    const normalPrice = Number(this._config.normal_price);
    const expensivePrice = Number(this._config.expensive_price);
    const svgWidth = SVG_WIDTH;
    const svgHeight = SVG_HEIGHT;
    const plotWidth = svgWidth - PLOT.left - PLOT.right;
    const plotHeight = svgHeight - PLOT.top - PLOT.bottom;
    const start = points[0].timestamp;
    const end = points.at(-1).timestamp + intervalMs;
    const span = Math.max(intervalMs, end - start);
    const rawMin = Math.min(cheapPrice, ...points.map((point) => point.price));
    const rawMax = Math.max(expensivePrice, ...points.map((point) => point.price));
    const range = Math.max(0.04, rawMax - rawMin);
    const minimum = Math.max(-1, rawMin - range * 0.12);
    const maximum = rawMax + range * 0.12;
    const yRange = maximum - minimum;
    const xFor = (timestamp) => PLOT.left + ((timestamp - start) / span) * plotWidth;
    const yFor = (price) => PLOT.top + ((maximum - price) / yRange) * plotHeight;
    const coordinates = points.map((point) => [xFor(point.timestamp), yFor(point.price)]);
    const path = smoothPath(coordinates);
    const areaPath = `${path} L ${xFor(points.at(-1).timestamp)} ${PLOT.top + plotHeight} L ${xFor(start)} ${PLOT.top + plotHeight} Z`;

    const hatchRects = points
      .filter((point) => selected.has(point.timestamp))
      .map((point) => {
        const x = xFor(point.timestamp);
        const width = Math.max(1.5, xFor(point.timestamp + intervalMs) - x);
        return `<rect x="${x.toFixed(2)}" y="${PLOT.top}" width="${width.toFixed(2)}" height="${plotHeight}" fill="var(--cheapest-fill)" class="cheapest-slot" />`;
      })
      .join('');

    const offsetForPrice = (price) => Math.max(0, Math.min(100, ((yFor(price) - PLOT.top) / plotHeight) * 100));
    const expensiveOffset = offsetForPrice(expensivePrice);
    const normalOffset = offsetForPrice(normalPrice);
    const cheapOffset = offsetForPrice(cheapPrice);
    const zeroOffset = offsetForPrice(0);
    const negativeGradientStops = minimum < 0
      ? `<stop offset="${zeroOffset}%" stop-color="var(--zero-color)" />
         <stop offset="100%" stop-color="var(--negative-color)" />`
      : `<stop offset="100%" stop-color="var(--cheap)" />`;

    const nowTimestamp = now.getTime();
    const nowX = xFor(nowTimestamp);
    const nowVisible = nowTimestamp >= start && nowTimestamp <= end;
    const nowMarker = nowVisible
      ? `<line class="now-line" x1="${nowX}" y1="${PLOT.top}" x2="${nowX}" y2="${PLOT.top + plotHeight}" />`
      : '';
    const nowLabel = nowVisible
      ? `<span class="chart-label now-label" style="left:${Math.max(6, Math.min(94, (nowX / svgWidth) * 100))}%">Nu</span>`
      : '';

    const yTicks = createPriceTicks(minimum, maximum, 5);
    const yLabels = yTicks.map((price) => {
      const y = yFor(price);
      return `<span class="chart-label y-label" style="top:${(y / svgHeight) * 100}%">${formatPrice(price, 0)}</span>`;
    }).join('');

    const cheapY = yFor(cheapPrice);
    const normalY = yFor(normalPrice);
    const expensiveY = yFor(expensivePrice);
    const levelLines = `
      <line x1="${PLOT.left}" y1="${cheapY}" x2="${svgWidth - PLOT.right}" y2="${cheapY}" class="level-line cheap-level" />
      <line x1="${PLOT.left}" y1="${normalY}" x2="${svgWidth - PLOT.right}" y2="${normalY}" class="level-line normal-level" />
      <line x1="${PLOT.left}" y1="${expensiveY}" x2="${svgWidth - PLOT.right}" y2="${expensiveY}" class="level-line expensive-level" />`;
    const levelLabels = `
      <span class="chart-label level-label cheap-label" style="top:${(cheapY / svgHeight) * 100}%">${formatPrice(cheapPrice)} ct</span>
      <span class="chart-label level-label normal-label" style="top:${(normalY / svgHeight) * 100}%">${formatPrice(normalPrice)} ct</span>
      <span class="chart-label level-label expensive-label" style="top:${(expensiveY / svgHeight) * 100}%">${formatPrice(expensivePrice)} ct</span>`;

    const labelHourStep = groups.size > 1 ? 6 : 3;
    const xLabels = points.filter((point) => {
      const parts = zonedParts(point.timestamp, timeZone);
      return Number(parts.minute) === 0 && Number(parts.hour) % labelHourStep === 0;
    }).map((point) => `<span class="chart-label x-label" style="left:${(xFor(point.timestamp) / svgWidth) * 100}%">${formatTime(point.timestamp, timeZone)}</span>`).join('');

    const dayMarkers = [...groups.entries()].map(([dayKey, dayPoints], index) => {
      const x = xFor(dayPoints[0].timestamp);
      return index === 0 ? '' : `<line x1="${x}" y1="${PLOT.top}" x2="${x}" y2="${PLOT.top + plotHeight}" class="day-divider" />`;
    }).join('');
    const dayLabels = [...groups.entries()].map(([dayKey, dayPoints], index) => {
      const x = Math.max(PLOT.left + 8, xFor(dayPoints[0].timestamp) + 10);
      return `<span class="chart-label day-label" style="left:${(x / svgWidth) * 100}%">${index === 0 ? 'Vandaag' : 'Morgen'} · ${formatDay(dayPoints[0].timestamp, timeZone)}</span>`;
    }).join('');

    const todayKey = localDayKey(now, timeZone);
    const tomorrowKey = addDaysToKey(todayKey, 1);
    const tomorrowPoints = groups.get(tomorrowKey) || [];
    const showTomorrow = localHour(now, timeZone) >= Number(this._config.tomorrow_after);
    const tomorrowMinutes = tomorrowPoints.length * intervalMinutes;
    let availability = `Morgen vanaf ${String(this._config.tomorrow_after).padStart(2, '0')}:00`;
    if (showTomorrow && tomorrowPoints.length) {
      availability = tomorrowMinutes >= 24 * 60 ? 'Morgen compleet' : 'Morgen deels bekend';
    } else if (showTomorrow) {
      availability = 'Morgen nog niet bekend';
    }

    const currentPoint = findCurrentPoint(points, now);
    const currentPrice = currentPoint?.price ?? null;
    const currentClass = currentPrice === null
      ? 'unavailable'
      : classifyPriceLevel(currentPrice, cheapPrice, normalPrice, expensivePrice);
    const currentPriceText = currentPrice === null ? '—' : formatPrice(currentPrice);
    const currentIsSelected = cheapestEnabled && currentPoint ? selected.has(currentPoint.timestamp) : false;
    const currentBadge = currentIsSelected
      ? '<div class="current-window active">Goedkoopst</div>'
      : '';
    const legend = cheapestEnabled
      ? `<div class="legend" aria-label="Legenda">
          <span><i class="swatch selection"></i>Goedkoopste ${escapeHtml(this._config.cheapest_hours)} uur/dag</span>
        </div>`
      : '';
    const cheapestPeriods = groupSelectedPeriods(points, selected, intervalMinutes);
    const cheapestRows = cheapestPeriods.map((period) => {
      const hours = Math.floor(period.durationMinutes / 60);
      const minutes = period.durationMinutes % 60;
      const duration = hours && minutes
        ? `${hours} u ${minutes} min`
        : hours
          ? `${hours} uur`
          : `${minutes} min`;
      const day = period.dayKey === todayKey ? 'Vandaag' : period.dayKey === tomorrowKey ? 'Morgen' : period.dayKey;
      return `<tr>
        <td>${day}</td>
        <td>${formatTime(period.startTimestamp, timeZone)}</td>
        <td>${formatTime(period.endTimestamp, timeZone)}</td>
        <td>${duration}</td>
      </tr>`;
    }).join('');
    const cheapestTable = cheapestEnabled && this._config.show_cheapest_table
      ? `<div class="cheapest-table-wrap">
          <table class="cheapest-table">
            <thead><tr><th>Dag</th><th>Start</th><th>Einde</th><th>Duur</th></tr></thead>
            <tbody>${cheapestRows}</tbody>
          </table>
        </div>`
      : '';
    this._chart = {
      points, selected, intervalMs, timeZone, xFor, yFor, start, span,
      cheapPrice, normalPrice, expensivePrice, svgWidth, svgHeight,
    };

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-content">
          <header class="header">
            <div class="heading">
              <h2>${escapeHtml(this._config.title)}</h2>
            </div>
            <div class="current-block">
              <div class="current ${currentClass}" aria-label="Huidige prijs ${currentPrice === null ? 'onbekend' : `${currentPriceText} cent per kilowattuur`}">
                <strong>${currentPriceText}</strong><span>ct/kWh</span>
              </div>
              ${currentBadge}
            </div>
          </header>
          ${legend}
          <div class="chart" tabindex="0" role="img" aria-label="Elektriciteitsprijzen per kwartier. Gebruik de pijltjestoetsen om prijzen te bekijken.">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.16" />
                  <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0.01" />
                </linearGradient>
                <linearGradient id="price-line-gradient" x1="0" y1="${PLOT.top}" x2="0" y2="${PLOT.top + plotHeight}" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="var(--expensive)" />
                  <stop offset="${expensiveOffset}%" stop-color="var(--expensive)" />
                  <stop offset="${normalOffset}%" stop-color="var(--normal)" />
                  <stop offset="${cheapOffset}%" stop-color="var(--cheap)" />
                  ${negativeGradientStops}
                </linearGradient>
              </defs>
              ${hatchRects}
              ${levelLines}
              <path d="${areaPath}" class="area" />
              <path d="${path}" class="price-line" />
              ${dayMarkers}
              ${nowMarker}
              <line class="hover-line" x1="0" y1="${PLOT.top}" x2="0" y2="${PLOT.top + plotHeight}" hidden />
              <circle class="hover-dot" cx="0" cy="0" r="6" hidden />
            </svg>
            ${yLabels}
            ${levelLabels}
            ${dayLabels}
            ${nowLabel}
            ${xLabels}
            <div class="tooltip" hidden></div>
          </div>
          ${cheapestTable}
          <div class="sr-only" aria-live="polite"></div>
        </div>
      </ha-card>
      <style>${this._styles()}</style>`;

    this._bindInteractions();
  }

  _stateCard(title, message) {
    return `<ha-card><div class="state"><strong>${title}</strong><span>${message}</span></div></ha-card>
      <style>${this._styles()}</style>`;
  }

  _bindInteractions() {
    const chart = this.shadowRoot.querySelector('.chart');
    if (!chart) return;
    chart.addEventListener('pointermove', (event) => this._pointFromPointer(event));
    chart.addEventListener('pointerdown', (event) => this._pointFromPointer(event));
    chart.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') this._hideTooltip();
    });
    chart.addEventListener('focus', () => {
      const nearest = this._chart.points.reduce((best, point, index) => (
        Math.abs(point.timestamp - Date.now()) < Math.abs(this._chart.points[best].timestamp - Date.now()) ? index : best
      ), 0);
      this._showPoint(nearest);
    });
    chart.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') return this._hideTooltip();
      if (event.key === 'Home') this._activeIndex = 0;
      else if (event.key === 'End') this._activeIndex = this._chart.points.length - 1;
      else {
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        this._activeIndex = Math.max(0, Math.min(this._chart.points.length - 1, (this._activeIndex ?? 0) + delta));
      }
      this._showPoint(this._activeIndex);
    });
  }

  _pointFromPointer(event) {
    const chart = this.shadowRoot.querySelector('.chart');
    const bounds = chart.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * this._chart.svgWidth;
    const timestamp = this._chart.start + Math.max(0, Math.min(1, (svgX - PLOT.left) / (this._chart.svgWidth - PLOT.left - PLOT.right))) * this._chart.span;
    let low = 0;
    let high = this._chart.points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this._chart.points[middle].timestamp < timestamp) low = middle + 1;
      else high = middle;
    }
    const previous = Math.max(0, low - 1);
    const index = Math.abs(this._chart.points[low].timestamp - timestamp) < Math.abs(this._chart.points[previous].timestamp - timestamp) ? low : previous;
    this._showPoint(index);
  }

  _showPoint(index) {
    const point = this._chart.points[index];
    if (!point) return;
    this._activeIndex = index;
    const nextTime = point.timestamp + this._chart.intervalMs;
    const x = this._chart.xFor(point.timestamp);
    const y = this._chart.yFor(point.price);
    const selected = this._chart.selected.has(point.timestamp);
    const priceClass = classifyPriceLevel(
      point.price,
      this._chart.cheapPrice,
      this._chart.normalPrice,
      this._chart.expensivePrice,
    );
    const priceLabel = {
      negative: 'Negatieve prijs',
      cheap: 'Goedkoop',
      normal: 'Normaal',
      expensive: 'Duur',
    }[priceClass];
    const line = this.shadowRoot.querySelector('.hover-line');
    const dot = this.shadowRoot.querySelector('.hover-dot');
    const tooltip = this.shadowRoot.querySelector('.tooltip');
    line.hidden = false;
    dot.hidden = false;
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('class', `hover-dot ${priceClass}`);
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${formatPrice(point.price)} ct/kWh</strong>
      <span>${formatTime(point.timestamp, this._chart.timeZone)}–${formatTime(nextTime, this._chart.timeZone)}</span>
      <small>${priceLabel}${selected ? ' · goedkoopste 4 uur' : ''}</small>`;
    const percentage = (x / this._chart.svgWidth) * 100;
    tooltip.style.left = `${Math.max(13, Math.min(87, percentage))}%`;
    tooltip.style.top = `${Math.max(8, (y / this._chart.svgHeight) * 100 - 5)}%`;
    const live = this.shadowRoot.querySelector('.sr-only');
    live.textContent = `${formatTime(point.timestamp, this._chart.timeZone)} tot ${formatTime(nextTime, this._chart.timeZone)}, ${formatPrice(point.price)} cent per kilowattuur${selected ? ', onderdeel van de goedkoopste vier uur' : ''}.`;
  }

  _hideTooltip() {
    this.shadowRoot.querySelector('.tooltip')?.setAttribute('hidden', '');
    this.shadowRoot.querySelector('.hover-line')?.setAttribute('hidden', '');
    this.shadowRoot.querySelector('.hover-dot')?.setAttribute('hidden', '');
  }

  _styles() {
    return `
      :host {
        --cheap: var(--success-color, #19a974);
        --normal: #f2a93b;
        --expensive: var(--error-color, #e45c4f);
        --zero-color: #18a999;
        --negative-color: #168aad;
        --cheapest-fill: color-mix(in srgb, var(--cheap) 13%, transparent);
        --cheapest-stripe: color-mix(in srgb, var(--cheap) 42%, transparent);
        display: block;
      }
      ha-card { overflow: hidden; }
      .card-content { padding: 16px 16px 12px; color: var(--primary-text-color); }
      .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .heading { min-width: 0; }
      h2 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; }
      .heading p { margin: 5px 0 0; color: var(--secondary-text-color); font-size: 12px; }
      .current-block { display: grid; justify-items: end; gap: 5px; flex: none; }
      .current { display: grid; grid-template-columns: auto auto; align-items: baseline; column-gap: 5px; padding: 7px 10px; border-radius: 8px; background: var(--secondary-background-color); font-variant-numeric: tabular-nums; }
      .current strong { font-size: 22px; line-height: 1; }
      .current span { font-size: 11px; color: var(--secondary-text-color); }
      .current.negative strong { color: var(--negative-color); }
      .current.cheap strong { color: var(--cheap); }
      .current.normal strong { color: var(--normal); }
      .current.expensive strong { color: var(--expensive); }
      .current.unavailable strong { color: var(--secondary-text-color); }
      .current-window { color: var(--secondary-text-color); font-size: 10px; font-weight: 600; }
      .current-window.active { color: var(--cheap); }
      .legend { display: flex; flex-wrap: wrap; gap: 7px 16px; margin: 14px 0 2px; color: var(--secondary-text-color); font-size: 11px; }
      .legend span { display: inline-flex; align-items: center; gap: 6px; }
      .swatch { width: 15px; height: 4px; border-radius: 4px; background: var(--divider-color); }
      .swatch.cheap { background: var(--cheap); }
      .swatch.expensive { background: var(--expensive); }
      .swatch.selection { height: 11px; border-radius: 2px; background: var(--cheapest-fill); border: 1px solid color-mix(in srgb, var(--cheap) 45%, transparent); }
      .chart { position: relative; height: 300px; outline: none; touch-action: pan-y; }
      .chart:focus-visible { box-shadow: inset 0 0 0 2px var(--primary-color); border-radius: 8px; }
      svg { display: block; width: 100%; height: 100%; overflow: hidden; }
      .chart-label { position: absolute; z-index: 1; pointer-events: none; font-variant-numeric: tabular-nums; white-space: nowrap; text-shadow: 0 1px 2px var(--card-background-color), 0 0 4px var(--card-background-color); }
      .x-label { bottom: 4px; transform: translateX(-50%); color: var(--secondary-text-color); font-size: 10px; }
      .y-label { left: 1px; transform: translateY(-50%); color: var(--secondary-text-color); font-size: 10px; }
      .day-label { top: 8px; color: var(--primary-text-color); font-size: 11px; font-weight: 700; }
      .now-label { top: 8px; transform: translateX(-50%); color: var(--primary-text-color); font-size: 10px; font-weight: 700; }
      .level-label { right: 3px; transform: translateY(-135%); color: var(--secondary-text-color); font-size: 10px; }
      .day-divider { stroke: var(--primary-text-color); stroke-opacity: 0.28; stroke-dasharray: 4 5; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .area { fill: url(#price-area); stroke: none; }
      .price-line { fill: none; stroke: url(#price-line-gradient); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
      .level-line { stroke-opacity: 0.55; stroke-dasharray: 5 5; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .cheap-level { stroke: var(--cheap); }
      .normal-level { stroke: var(--normal); }
      .expensive-level { stroke: var(--expensive); }
      .cheap-label { color: var(--cheap); }
      .normal-label { color: var(--normal); }
      .expensive-label { color: var(--expensive); }
      .now-line { stroke: var(--primary-text-color); stroke-opacity: 0.72; stroke-dasharray: 3 3; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
      .hover-line { stroke: var(--primary-text-color); stroke-opacity: 0.48; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .hover-dot { fill: var(--card-background-color); stroke-width: 3; vector-effect: non-scaling-stroke; }
      .hover-dot.negative { stroke: var(--negative-color); }
      .hover-dot.cheap { stroke: var(--cheap); }
      .hover-dot.normal { stroke: var(--normal); }
      .hover-dot.expensive { stroke: var(--expensive); }
      .tooltip { position: absolute; z-index: 2; transform: translate(-50%, -108%); min-width: 126px; padding: 9px 11px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); box-shadow: 0 5px 16px rgba(0, 0, 0, 0.2); pointer-events: none; font-variant-numeric: tabular-nums; }
      .tooltip strong, .tooltip span, .tooltip small { display: block; white-space: nowrap; }
      .tooltip strong { font-size: 14px; }
      .tooltip span { margin-top: 2px; font-size: 12px; }
      .tooltip small { margin-top: 3px; color: var(--secondary-text-color); font-size: 10px; }
      .cheapest-table-wrap { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider-color); overflow-x: auto; }
      .cheapest-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
      .cheapest-table th, .cheapest-table td { padding: 6px 8px; text-align: left; white-space: nowrap; }
      .cheapest-table th { color: var(--secondary-text-color); font-size: 10px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; }
      .cheapest-table tbody tr { border-top: 1px solid var(--divider-color); }
      .cheapest-table td:last-child, .cheapest-table th:last-child { text-align: right; }
      .state { display: grid; gap: 5px; padding: 20px; }
      .state span { color: var(--secondary-text-color); }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      [hidden] { display: none !important; }
      @media (max-width: 520px) {
        .card-content { padding: 12px 12px 10px; }
        .header { gap: 10px; }
        h2 { font-size: 17px; }
        .current strong { font-size: 19px; }
        .legend { gap: 6px 10px; }
        .chart { height: 260px; }
      }
      @media (prefers-reduced-motion: reduce) { .tooltip { transition: none; } }
    `;
  }
}

if (!customElements.get('dynamic-energy-price-card')) {
  customElements.define('dynamic-energy-price-card', DynamicEnergyPriceCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'dynamic-energy-price-card')) {
  window.customCards.push({
    type: 'dynamic-energy-price-card',
    name: 'Dynamische energieprijzen',
    description: 'Tibber-kwartierprijzen met goedkoopste vier uur per dag.',
    preview: true,
  });
}
