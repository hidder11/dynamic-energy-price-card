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

function calculateAveragePrice(points) {
  if (!points.length) return null;
  return points.reduce((total, point) => total + Number(point.price), 0) / points.length;
}

function offsetPriceData(data, offset) {
  const amount = Number(offset);
  if (!Array.isArray(data) || !Number.isFinite(amount)) return [];
  return data.map((entry) => ({
    ...entry,
    price_per_kwh: Number((Number(entry?.price_per_kwh) + amount).toFixed(10)),
  }));
}

function mergePriceSeries(importPoints = [], exportPoints = []) {
  const merged = new Map();
  for (const point of importPoints) {
    merged.set(point.timestamp, {
      timestamp: point.timestamp,
      startTime: point.startTime,
      dayKey: point.dayKey,
      importPrice: point.price,
    });
  }
  for (const point of exportPoints) {
    const existing = merged.get(point.timestamp) ?? {
      timestamp: point.timestamp,
      startTime: point.startTime,
      dayKey: point.dayKey,
    };
    existing.exportPrice = point.price;
    merged.set(point.timestamp, existing);
  }
  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
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
  return selectDurationByPrice(points, totalMinutes, 'lowest');
}

function selectHighestDuration(points, totalMinutes = 240) {
  return selectDurationByPrice(points, totalMinutes, 'highest');
}

function selectDurationByPrice(points, totalMinutes, direction) {
  const selected = new Set();
  if (!points.length || totalMinutes <= 0) return selected;
  const intervalMinutes = inferIntervalMinutes(points);
  const count = Math.min(points.length, Math.ceil(totalMinutes / intervalMinutes));
  const ordered = [...points].sort(
    direction === 'highest'
      ? (left, right) => right.price - left.price || left.timestamp - right.timestamp
      : (left, right) => left.price - right.price || left.timestamp - right.timestamp,
  );
  for (const point of ordered.slice(0, count).sort((left, right) => left.timestamp - right.timestamp)) {
    selected.add(point.timestamp);
  }
  return selected;
}

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 330;
const PLOT = { left: 44, right: 12, top: 20, bottom: 34 };
const IMPORT_MODES = new Set(['import', 'both']);
const EXPORT_MODES = new Set(['export', 'both']);

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

const seriesPath = (timeline, key, xFor, yFor, intervalMs) => {
  const segments = [];
  let segment = [];
  let previousTimestamp = null;
  for (const point of timeline) {
    const price = point[key];
    if (!Number.isFinite(price) || (previousTimestamp !== null && point.timestamp - previousTimestamp > intervalMs * 1.5)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (Number.isFinite(price)) {
      segment.push([xFor(point.timestamp), yFor(price)]);
      previousTimestamp = point.timestamp;
    } else {
      previousTimestamp = null;
    }
  }
  if (segment.length) segments.push(segment);
  return segments.map(smoothPath).join(' ');
};

const modeOptions = (includeNone = false) => [
  { value: 'import', label: 'Afname' },
  { value: 'both', label: 'Afname en teruglevering' },
  { value: 'export', label: 'Teruglevering' },
  ...(includeNone ? [{ value: 'none', label: 'Geen' }] : []),
];

class DynamicEnergyPriceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onOutsidePointer = (event) => {
      const chart = this.shadowRoot?.querySelector('.chart');
      if (chart && !event.composedPath().includes(chart)) this._hideTooltip();
    };
  }

  static getConfigForm() {
    const labels = {
      entity: 'Prijsentity afname',
      export_entity: 'Prijsentity teruglevering',
      export_price_offset: 'Correctie op terugleverprijs',
      graph_mode: 'Grafiek',
      current_price_mode: 'Actuele prijzen',
      title: 'Titel',
      show_title: 'Titel tonen',
      show_hover_line: 'Verticale hoverlijn',
      show_average_line: 'Gemiddelde prijslijn',
      cheap_price: 'Goedkoop',
      normal_price: 'Normaal',
      expensive_price: 'Duur',
      cheapest_hours: 'Goedkoopste uren per dag',
      export_best_hours: 'Beste terugleveruren per dag',
      show_cheapest_table: 'Tabel goedkoopste momenten',
      show_export_table: 'Tabel beste teruglevermomenten',
      tomorrow_after: 'Morgenprijzen tonen vanaf',
    };
    const numberSelector = (unit) => ({
      number: { min: 0, max: 24, step: 1, mode: 'slider', unit_of_measurement: unit },
    });
    const thresholdSelector = {
      number: { min: -1, max: 1, step: 0.01, mode: 'slider', unit_of_measurement: '€/kWh' },
    };

    return {
      schema: [
        {
          name: 'graph_mode',
          selector: { select: { mode: 'dropdown', options: modeOptions() } },
        },
        {
          name: 'current_price_mode',
          selector: { select: { mode: 'dropdown', options: modeOptions(true) } },
        },
        { name: 'title', selector: { text: {} } },
        { name: 'show_title', selector: { boolean: {} } },
        { name: 'show_hover_line', selector: { boolean: {} } },
        { name: 'show_average_line', selector: { boolean: {} } },
        { name: 'tomorrow_after', required: true, selector: numberSelector('uur') },
        {
          type: 'expandable',
          name: 'import_settings',
          title: 'Afname',
          flatten: true,
          schema: [
            {
              name: 'entity',
              required: true,
              selector: { entity: { domain: 'sensor' } },
            },
            { name: 'cheapest_hours', selector: numberSelector('uur') },
            { name: 'show_cheapest_table', selector: { boolean: {} } },
            { name: 'cheap_price', required: true, selector: thresholdSelector },
            { name: 'normal_price', required: true, selector: thresholdSelector },
            { name: 'expensive_price', required: true, selector: thresholdSelector },
          ],
        },
        {
          type: 'expandable',
          name: 'export_settings',
          title: 'Teruglevering',
          flatten: true,
          schema: [
            { name: 'export_entity', selector: { entity: { domain: 'sensor' } } },
            {
              name: 'export_price_offset',
              selector: { number: { min: -1, max: 1, step: 0.001, mode: 'box', unit_of_measurement: '€/kWh' } },
            },
            { name: 'export_best_hours', selector: numberSelector('uur') },
            { name: 'show_export_table', selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (schema) => {
        if (!schema?.name) return schema?.title ?? '';
        return labels[schema.name] ?? schema.name;
      },
      computeHelper: (schema) => ({
        graph_mode: 'Kies welke tarieven in de gedeelde tijdgrafiek staan.',
        current_price_mode: 'Staat los van de gekozen grafiekweergave.',
        show_title: 'Verberg de titel om actieve gunstige-urencontext op die plek te tonen.',
        show_hover_line: 'Toont een verticale hulplijn bij het actieve prijsinterval.',
        show_average_line: 'Toont per zichtbare tariefreeks een gelabeld gemiddelde.',
        cheap_price: 'Onder deze prijs is afname goedkoop; voor teruglevering is laag juist ongunstig.',
        normal_price: 'Middelste prijsgrens voor beide tarieven.',
        expensive_price: 'Boven deze prijs is afname duur en teruglevering gunstig.',
        cheapest_hours: '0 schakelt de selectie van goedkope afname-uren uit.',
        show_cheapest_table: 'Toont aaneengesloten goedkope afnamemomenten onder de grafiek.',
        export_entity: 'Prijsbron voor teruglevering. Verplicht zodra teruglevering wordt getoond.',
        export_price_offset: 'Terugleverprijs = prijs uit terugleverentity + verschil. Negatieve waarden zijn toegestaan.',
        export_best_hours: '0 schakelt de selectie van beste terugleveruren uit.',
        show_export_table: 'Toont aaneengesloten beste teruglevermomenten onder de grafiek.',
        tomorrow_after: 'Vanaf dit uur worden beschikbare morgenprijzen getoond.',
      })[schema.name],
    };
  }

  static getStubConfig() {
    return {
      entity: 'sensor.tibber_prijzen',
      graph_mode: 'import',
      current_price_mode: 'import',
      title: 'Dynamische energieprijzen',
      show_title: true,
      show_hover_line: true,
      show_average_line: false,
      cheap_price: 0.15,
      normal_price: 0.25,
      expensive_price: 0.40,
      cheapest_hours: 0,
      show_cheapest_table: false,
      export_best_hours: 0,
      show_export_table: false,
      tomorrow_after: 14,
    };
  }

  setConfig(config) {
    if (!config?.entity) throw new Error('Een prijsentity voor afname is verplicht.');
    this._config = {
      title: 'Dynamische energieprijzen',
      graph_mode: 'import',
      current_price_mode: 'import',
      show_title: true,
      show_hover_line: true,
      show_average_line: false,
      cheap_price: 0.15,
      normal_price: 0.25,
      expensive_price: 0.40,
      cheapest_hours: 0,
      show_cheapest_table: false,
      export_best_hours: 0,
      show_export_table: false,
      tomorrow_after: 14,
      ...config,
    };
    if (!['import', 'both', 'export'].includes(this._config.graph_mode)) this._config.graph_mode = 'import';
    if (!['import', 'both', 'export', 'none'].includes(this._config.current_price_mode)) this._config.current_price_mode = 'import';
    const levels = [this._config.cheap_price, this._config.normal_price, this._config.expensive_price].map(Number);
    if (!levels.every(Number.isFinite) || !(levels[0] < levels[1] && levels[1] < levels[2])) {
      throw new Error('Prijsniveaus moeten oplopen: goedkoop < normaal < duur.');
    }
    this._lastSignature = null;
    this._activeIndex = null;
  }

  _hasExportSource() {
    return Boolean(this._config?.export_entity);
  }

  _exportRequired() {
    return EXPORT_MODES.has(this._config?.graph_mode)
      || EXPORT_MODES.has(this._config?.current_price_mode)
      || isCheapestHoursEnabled(this._config?.export_best_hours);
  }

  _hasAnyTable() {
    const hasCheapestTable = isCheapestHoursEnabled(this._config?.cheapest_hours)
      && Boolean(this._config?.show_cheapest_table);
    const hasExportTable = isCheapestHoursEnabled(this._config?.export_best_hours)
      && Boolean(this._config?.show_export_table);
    return hasCheapestTable || hasExportTable;
  }

  getCardSize() {
    return this._hasAnyTable() ? 9 : 6;
  }

  getGridOptions() {
    const hasCheapestTable = isCheapestHoursEnabled(this._config?.cheapest_hours)
      && Boolean(this._config?.show_cheapest_table);
    const hasExportTable = isCheapestHoursEnabled(this._config?.export_best_hours)
      && Boolean(this._config?.show_export_table);
    const hasAnyTable = hasCheapestTable || hasExportTable;
    return {
      rows: hasCheapestTable ? 9 : 6,
      columns: 12,
      min_rows: hasCheapestTable ? 6 : 4,
      min_columns: 9,
      ...(hasAnyTable ? { rows: 9, min_rows: 6 } : {}),
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const importState = hass.states[this._config.entity];
    const exportState = this._config.export_entity ? hass.states[this._config.export_entity] : null;
    const minute = Math.floor(Date.now() / 60000);
    const signature = `${importState?.last_updated ?? 'missing'}|${exportState?.last_updated ?? 'none'}|${minute}|${hass.themes?.darkMode ?? false}`;
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this._render();
    }
  }

  connectedCallback() {
    window.addEventListener('pointerdown', this._onOutsidePointer);
    if (this._hass && this._config) this._render();
  }

  disconnectedCallback() {
    window.removeEventListener('pointerdown', this._onOutsidePointer);
  }

  _render() {
    const importState = this._hass?.states?.[this._config.entity];
    if (!importState) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Afname-entiteit niet gevonden',
        `Controleer ${escapeHtml(this._config.entity)} in de cardconfiguratie.`,
      );
      return;
    }
    if (this._exportRequired() && !this._hasExportSource()) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Terugleverbron ontbreekt',
        'Stel export_entity in, of kies alleen afname.',
      );
      return;
    }
    const exportState = this._config.export_entity ? this._hass?.states?.[this._config.export_entity] : null;
    if (this._exportRequired() && this._config.export_entity && !exportState) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Teruglever-entiteit niet gevonden',
        `Controleer ${escapeHtml(this._config.export_entity)} in de cardconfiguratie.`,
      );
      return;
    }

    const timeZone = this._hass.config.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const rawImportData = importState.attributes?.data;
    const importPoints = getVisiblePoints(rawImportData, now, timeZone, this._config.tomorrow_after);
    if (!importPoints.length) {
      this.shadowRoot.innerHTML = this._stateCard(
        'Nog geen prijsgegevens',
        'De afname-entiteit bevat geen prijsintervallen voor vandaag.',
      );
      return;
    }

    const hasExportOffset = this._config.export_price_offset !== undefined
      && this._config.export_price_offset !== null
      && this._config.export_price_offset !== ''
      && Number.isFinite(Number(this._config.export_price_offset));
    const exportOffset = hasExportOffset ? Number(this._config.export_price_offset) : 0;
    const rawExportData = exportState
      ? offsetPriceData(exportState.attributes?.data, exportOffset)
      : null;
    const exportPoints = rawExportData
      ? getVisiblePoints(rawExportData, now, timeZone, this._config.tomorrow_after)
      : [];
    const timeline = mergePriceSeries(importPoints, exportPoints);
    const graphShowsImport = IMPORT_MODES.has(this._config.graph_mode);
    const graphShowsExport = EXPORT_MODES.has(this._config.graph_mode);
    const currentShowsImport = IMPORT_MODES.has(this._config.current_price_mode);
    const currentShowsExport = EXPORT_MODES.has(this._config.current_price_mode);

    const importGroups = splitByLocalDay(importPoints);
    const exportGroups = splitByLocalDay(exportPoints);
    const cheapestEnabled = isCheapestHoursEnabled(this._config.cheapest_hours);
    const exportBestEnabled = isCheapestHoursEnabled(this._config.export_best_hours);
    const importSelected = new Set();
    const exportSelected = new Set();
    if (cheapestEnabled) {
      for (const dayPoints of importGroups.values()) {
        for (const timestamp of selectCheapestDuration(dayPoints, Number(this._config.cheapest_hours) * 60)) importSelected.add(timestamp);
      }
    }
    if (exportBestEnabled) {
      for (const dayPoints of exportGroups.values()) {
        for (const timestamp of selectHighestDuration(dayPoints, Number(this._config.export_best_hours) * 60)) exportSelected.add(timestamp);
      }
    }

    const intervalMinutes = inferIntervalMinutes(importPoints);
    const intervalMs = intervalMinutes * 60000;
    const cheapPrice = Number(this._config.cheap_price);
    const normalPrice = Number(this._config.normal_price);
    const expensivePrice = Number(this._config.expensive_price);
    const svgWidth = SVG_WIDTH;
    const svgHeight = SVG_HEIGHT;
    const plotWidth = svgWidth - PLOT.left - PLOT.right;
    const plotHeight = svgHeight - PLOT.top - PLOT.bottom;
    const start = timeline[0].timestamp;
    const end = timeline.at(-1).timestamp + intervalMs;
    const span = Math.max(intervalMs, end - start);
    const visiblePrices = timeline.flatMap((point) => [
      ...(graphShowsImport && Number.isFinite(point.importPrice) ? [point.importPrice] : []),
      ...(graphShowsExport && Number.isFinite(point.exportPrice) ? [point.exportPrice] : []),
    ]);
    const rawMin = Math.min(cheapPrice, ...visiblePrices);
    const rawMax = Math.max(expensivePrice, ...visiblePrices);
    const range = Math.max(0.04, rawMax - rawMin);
    const minimum = Math.max(-1, rawMin - range * 0.12);
    const maximum = rawMax + range * 0.12;
    const yRange = maximum - minimum;
    const xFor = (timestamp) => PLOT.left + ((timestamp - start) / span) * plotWidth;
    const yFor = (price) => PLOT.top + ((maximum - price) / yRange) * plotHeight;
    const importPath = graphShowsImport ? seriesPath(timeline, 'importPrice', xFor, yFor, intervalMs) : '';
    const exportPath = graphShowsExport ? seriesPath(timeline, 'exportPrice', xFor, yFor, intervalMs) : '';
    const importAreaPath = graphShowsImport && importPath && timeline.every((point) => Number.isFinite(point.importPrice))
      ? `${importPath} L ${xFor(timeline.at(-1).timestamp)} ${PLOT.top + plotHeight} L ${xFor(start)} ${PLOT.top + plotHeight} Z`
      : '';

    const selectionRects = timeline.map((point) => {
      const x = xFor(point.timestamp);
      const width = Math.max(1.5, xFor(point.timestamp + intervalMs) - x);
      const rects = [];
      if (graphShowsImport && importSelected.has(point.timestamp)) {
        rects.push(`<rect x="${x.toFixed(2)}" y="${PLOT.top}" width="${width.toFixed(2)}" height="${plotHeight}" fill="var(--cheapest-fill)" class="cheapest-slot" />`);
      }
      if (graphShowsExport && exportSelected.has(point.timestamp)) {
        rects.push(`<rect x="${x.toFixed(2)}" y="${PLOT.top}" width="${width.toFixed(2)}" height="${plotHeight}" fill="var(--export-best-fill)" class="export-best-slot" />`);
      }
      return rects.join('');
    }).join('');

    const offsetForPrice = (price) => Math.max(0, Math.min(100, ((yFor(price) - PLOT.top) / plotHeight) * 100));
    const expensiveOffset = offsetForPrice(expensivePrice);
    const normalOffset = offsetForPrice(normalPrice);
    const cheapOffset = offsetForPrice(cheapPrice);
    const zeroOffset = offsetForPrice(0);
    const importNegativeStops = minimum < 0
      ? `<stop offset="${zeroOffset}%" stop-color="var(--zero-color)" /><stop offset="100%" stop-color="var(--negative-color)" />`
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

    const averages = [];
    if (this._config.show_average_line && graphShowsImport) {
      const value = calculateAveragePrice(importPoints);
      if (value !== null) averages.push({ key: 'import', label: 'Gem. afname', value, y: yFor(value) });
    }
    if (this._config.show_average_line && graphShowsExport) {
      const value = calculateAveragePrice(exportPoints);
      if (value !== null) averages.push({ key: 'export', label: 'Gem. teruglevering', value, y: yFor(value) });
    }
    const averageLine = averages.map((average) => `<line class="average-line ${average.key}-average" x1="${PLOT.left}" y1="${average.y}" x2="${svgWidth - PLOT.right}" y2="${average.y}" />`).join('');
    const averageLabel = averages.map((average, index) => `<span class="chart-label average-label ${average.key}-average-label" style="top:${(average.y / svgHeight) * 100}%;left:${50 + index * 132}px">${average.label} ${formatPrice(average.value)} ct</span>`).join('');
    const hoverLine = this._config.show_hover_line
      ? `<line class="hover-line" x1="0" y1="${PLOT.top}" x2="0" y2="${PLOT.top + plotHeight}" hidden />`
      : '';

    const yTicks = createPriceTicks(minimum, maximum, 5);
    const yLabels = yTicks.map((price) => {
      const y = yFor(price);
      return `<span class="chart-label y-label" style="top:${(y / svgHeight) * 100}%">${formatPrice(price, 0)}</span>`;
    }).join('');
    const cheapY = yFor(cheapPrice);
    const normalY = yFor(normalPrice);
    const expensiveY = yFor(expensivePrice);
    const bothGraph = graphShowsImport && graphShowsExport;
    const levelClass = bothGraph ? 'neutral-level' : graphShowsExport ? 'export-level' : 'import-level';
    const levelLines = `
      <line x1="${PLOT.left}" y1="${cheapY}" x2="${svgWidth - PLOT.right}" y2="${cheapY}" class="level-line cheap-level" data-level-class="${levelClass}" />
      <line x1="${PLOT.left}" y1="${normalY}" x2="${svgWidth - PLOT.right}" y2="${normalY}" class="level-line normal-level" data-level-class="${levelClass}" />
      <line x1="${PLOT.left}" y1="${expensiveY}" x2="${svgWidth - PLOT.right}" y2="${expensiveY}" class="level-line expensive-level" data-level-class="${levelClass}" />`;
    const levelLabels = `
      <span class="chart-label level-label ${levelClass}" style="top:${(cheapY / svgHeight) * 100}%">${formatPrice(cheapPrice)} ct</span>
      <span class="chart-label level-label ${levelClass}" style="top:${(normalY / svgHeight) * 100}%">${formatPrice(normalPrice)} ct</span>
      <span class="chart-label level-label ${levelClass}" style="top:${(expensiveY / svgHeight) * 100}%">${formatPrice(expensivePrice)} ct</span>`;

    const groups = splitByLocalDay(importPoints);
    const labelHourStep = groups.size > 1 ? 6 : 3;
    const xLabels = importPoints.filter((point) => {
      const parts = zonedParts(point.timestamp, timeZone);
      return Number(parts.minute) === 0 && Number(parts.hour) % labelHourStep === 0;
    }).map((point) => `<span class="chart-label x-label" style="left:${(xFor(point.timestamp) / svgWidth) * 100}%">${formatTime(point.timestamp, timeZone)}</span>`).join('');
    const dayMarkers = [...groups.values()].map((dayPoints, index) => {
      const x = xFor(dayPoints[0].timestamp);
      return index === 0 ? '' : `<line x1="${x}" y1="${PLOT.top}" x2="${x}" y2="${PLOT.top + plotHeight}" class="day-divider" />`;
    }).join('');
    const dayLabels = [...groups.values()].map((dayPoints, index) => {
      const x = Math.max(PLOT.left + 8, xFor(dayPoints[0].timestamp) + 10);
      return `<span class="chart-label day-label" style="left:${(x / svgWidth) * 100}%">${index === 0 ? 'Vandaag' : 'Morgen'} · ${formatDay(dayPoints[0].timestamp, timeZone)}</span>`;
    }).join('');

    const todayKey = localDayKey(now, timeZone);
    const tomorrowKey = addDaysToKey(todayKey, 1);
    const tomorrowPoints = groups.get(tomorrowKey) || [];
    const showTomorrow = localHour(now, timeZone) >= Number(this._config.tomorrow_after);
    const tomorrowMinutes = tomorrowPoints.length * intervalMinutes;
    let availability = `Morgen vanaf ${String(this._config.tomorrow_after).padStart(2, '0')}:00`;
    if (showTomorrow && tomorrowPoints.length) availability = tomorrowMinutes >= 24 * 60 ? 'Morgen compleet' : 'Morgen deels bekend';
    else if (showTomorrow) availability = 'Morgen nog niet bekend';

    const currentImport = findCurrentPoint(importPoints, now);
    const currentExport = findCurrentPoint(exportPoints, now);
    const currentCards = [];
    if (currentShowsImport) currentCards.push(this._currentMetric('Afname', currentImport, 'import', importSelected, cheapestEnabled));
    if (currentShowsExport) currentCards.push(this._currentMetric('Teruglevering', currentExport, 'export', exportSelected, exportBestEnabled));
    const currentBlock = currentCards.length ? `<div class="current-block">${currentCards.join('')}</div>` : '';

    const showTitle = this._config.show_title !== false;
    const contextLabels = [];
    if (cheapestEnabled) contextLabels.push(`<span><i class="swatch selection"></i>Goedkoopste ${escapeHtml(this._config.cheapest_hours)} uur/dag</span>`);
    if (exportBestEnabled) contextLabels.push(`<span><i class="swatch export-selection"></i>Beste teruglevering ${escapeHtml(this._config.export_best_hours)} uur/dag</span>`);
    const heading = showTitle
      ? `<div class="heading"><h2>${escapeHtml(this._config.title)}</h2></div>`
      : contextLabels.length
        ? `<div class="heading"><div class="header-cheapest">${contextLabels.join('')}</div></div>`
        : '';
    const seriesLegend = [];
    if (graphShowsImport) seriesLegend.push('<span><i class="swatch import-series"></i>Afname</span>');
    if (graphShowsExport) seriesLegend.push('<span><i class="swatch export-series"></i>Teruglevering</span>');
    const legendItems = [...seriesLegend, ...(showTitle ? contextLabels : [])];
    const legend = cheapestEnabled || exportBestEnabled || legendItems.length > 1
      ? `<div class="legend" aria-label="Legenda">${legendItems.join('')}</div>`
      : '';

    const cheapestTable = cheapestEnabled && this._config.show_cheapest_table
      ? this._periodTable('Goedkoopste afname', importPoints, importSelected, intervalMinutes, timeZone, todayKey, tomorrowKey, 'cheapest-table')
      : '';
    const exportTable = exportBestEnabled && this._config.show_export_table
      ? this._periodTable('Beste teruglevering', exportPoints, exportSelected, inferIntervalMinutes(exportPoints), timeZone, todayKey, tomorrowKey, 'export-table')
      : '';

    this._chart = {
      timeline, importSelected, exportSelected, intervalMs, timeZone, xFor, yFor, start, span,
      cheapPrice, normalPrice, expensivePrice, svgWidth, svgHeight, graphShowsImport, graphShowsExport,
    };

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-content">
          <header class="header">${heading}${currentBlock}</header>
          ${legend}
          <div class="chart" tabindex="0" role="img" aria-label="Elektriciteitsprijzen per interval. Gebruik de pijltjestoetsen om prijzen te bekijken.">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.14" />
                  <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0.01" />
                </linearGradient>
                <linearGradient id="price-line-gradient" x1="0" y1="${PLOT.top}" x2="0" y2="${PLOT.top + plotHeight}" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="var(--expensive)" /><stop offset="${expensiveOffset}%" stop-color="var(--expensive)" />
                  <stop offset="${normalOffset}%" stop-color="var(--normal)" /><stop offset="${cheapOffset}%" stop-color="var(--cheap)" />${importNegativeStops}
                </linearGradient>
                <linearGradient id="export-line-gradient" x1="0" y1="${PLOT.top}" x2="0" y2="${PLOT.top + plotHeight}" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="var(--cheap)" /><stop offset="${expensiveOffset}%" stop-color="var(--cheap)" />
                  <stop offset="${normalOffset}%" stop-color="var(--normal)" /><stop offset="${cheapOffset}%" stop-color="var(--expensive)" />
                  <stop offset="100%" stop-color="var(--expensive)" />
                </linearGradient>
              </defs>
              ${selectionRects}${levelLines}${averageLine}
              ${importAreaPath ? `<path d="${importAreaPath}" class="area" />` : ''}
              ${importPath ? `<path d="${importPath}" class="price-line import-line" />` : ''}
              ${exportPath ? `<path d="${exportPath}" class="price-line export-line" />` : ''}
              ${dayMarkers}${nowMarker}${hoverLine}
            </svg>
            <span class="hover-dot" data-series="import" hidden></span>
            <span class="hover-dot export-dot" data-series="export" hidden></span>
            ${yLabels}${levelLabels}${averageLabel}${dayLabels}${nowLabel}${xLabels}
            <div class="tooltip" hidden></div>
          </div>
          ${cheapestTable}${exportTable}
          <div class="sr-only" aria-live="polite"></div>
        </div>
      </ha-card>
      <style>${this._styles()}</style>`;
    this._bindInteractions();
  }

  _currentMetric(label, point, type, selected, enabled) {
    const price = point?.price ?? null;
    const priceClass = price === null
      ? 'unavailable'
      : this._priceClass(price, type);
    const priceText = price === null ? '—' : formatPrice(price);
    const favorable = enabled && point ? selected.has(point.timestamp) : false;
    const badge = favorable
      ? type === 'import'
        ? '<div class="current-window active">Goedkoopst</div>'
        : '<div class="current-window active">Beste opbrengst</div>'
      : '';
    return `<div class="current-metric ${type}">
      <span class="current-label">${label}</span>
      <div class="current ${priceClass}" aria-label="Huidige ${label.toLowerCase()}prijs ${price === null ? 'onbekend' : `${priceText} cent per kilowattuur`}">
        <strong>${priceText}</strong><span>ct/kWh</span>
      </div>${badge}
    </div>`;
  }

  _periodTable(title, points, selected, intervalMinutes, timeZone, todayKey, tomorrowKey, className) {
    const rows = groupSelectedPeriods(points, selected, intervalMinutes).map((period) => {
      const hours = Math.floor(period.durationMinutes / 60);
      const minutes = period.durationMinutes % 60;
      const duration = hours && minutes ? `${hours} u ${minutes} min` : hours ? `${hours} uur` : `${minutes} min`;
      const day = period.dayKey === todayKey ? 'Vandaag' : period.dayKey === tomorrowKey ? 'Morgen' : period.dayKey;
      return `<tr><td>${day}</td><td>${formatTime(period.startTimestamp, timeZone)}</td><td>${formatTime(period.endTimestamp, timeZone)}</td><td>${duration}</td></tr>`;
    }).join('');
    return `<section class="price-table-wrap ${className}-wrap"><h3>${title}</h3>
      <table class="cheapest-table ${className}"><thead><tr><th>Dag</th><th>Start</th><th>Einde</th><th>Duur</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
  }

  _priceClass(price, type) {
    const base = classifyPriceLevel(price, this._config.cheap_price, this._config.normal_price, this._config.expensive_price);
    if (type !== 'export') return base;
    if (base === 'expensive') return 'cheap';
    if (base === 'cheap' || base === 'negative') return 'expensive';
    return 'normal';
  }

  _stateCard(title, message) {
    return `<ha-card><div class="state"><strong>${title}</strong><span>${message}</span></div></ha-card><style>${this._styles()}</style>`;
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
      const nearest = this._chart.timeline.reduce((best, point, index) => (
        Math.abs(point.timestamp - Date.now()) < Math.abs(this._chart.timeline[best].timestamp - Date.now()) ? index : best
      ), 0);
      this._showPoint(nearest);
    });
    chart.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') return this._hideTooltip();
      if (event.key === 'Home') this._activeIndex = 0;
      else if (event.key === 'End') this._activeIndex = this._chart.timeline.length - 1;
      else {
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        this._activeIndex = Math.max(0, Math.min(this._chart.timeline.length - 1, (this._activeIndex ?? 0) + delta));
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
    let high = this._chart.timeline.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this._chart.timeline[middle].timestamp < timestamp) low = middle + 1;
      else high = middle;
    }
    const previous = Math.max(0, low - 1);
    const index = Math.abs(this._chart.timeline[low].timestamp - timestamp) < Math.abs(this._chart.timeline[previous].timestamp - timestamp) ? low : previous;
    this._showPoint(index);
  }

  _showPoint(index) {
    const point = this._chart.timeline[index];
    if (!point) return;
    this._activeIndex = index;
    const nextTime = point.timestamp + this._chart.intervalMs;
    const x = this._chart.xFor(point.timestamp);
    const line = this.shadowRoot.querySelector('.hover-line');
    line?.removeAttribute('hidden');
    if (line) {
      line.setAttribute('x1', x);
      line.setAttribute('x2', x);
    }

    const entries = [];
    const liveEntries = [];
    const showDot = (type, price, selected, hours, favorableLabel) => {
      const dot = this.shadowRoot.querySelector(`[data-series="${type}"]`);
      if (!Number.isFinite(price)) {
        dot?.setAttribute('hidden', '');
        entries.push(`<span><b>${type === 'import' ? 'Afname' : 'Teruglevering'}</b> —</span>`);
        liveEntries.push(`${type === 'import' ? 'afname' : 'teruglevering'} niet beschikbaar`);
        return;
      }
      const y = this._chart.yFor(price);
      const priceClass = this._priceClass(price, type);
      dot.removeAttribute('hidden');
      dot.style.left = `${(x / this._chart.svgWidth) * 100}%`;
      dot.style.top = `${(y / this._chart.svgHeight) * 100}%`;
      dot.setAttribute('class', `hover-dot${type === 'export' ? ' export-dot' : ''} ${priceClass}`);
      const favorable = selected.has(point.timestamp);
      entries.push(`<span><i class="tooltip-series ${type}"></i><b>${type === 'import' ? 'Afname' : 'Teruglevering'}</b> ${formatPrice(price)} ct/kWh</span>${favorable ? `<small>${favorableLabel} ${escapeHtml(hours)} uur</small>` : ''}`);
      liveEntries.push(`${type === 'import' ? 'afname' : 'teruglevering'} ${formatPrice(price)} cent per kilowattuur${favorable ? `, ${favorableLabel} ${hours} uur` : ''}`);
    };
    if (this._chart.graphShowsImport) showDot('import', point.importPrice, this._chart.importSelected, this._config.cheapest_hours, 'goedkoopste');
    if (this._chart.graphShowsExport) showDot('export', point.exportPrice, this._chart.exportSelected, this._config.export_best_hours, 'beste');

    const tooltip = this.shadowRoot.querySelector('.tooltip');
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${formatTime(point.timestamp, this._chart.timeZone)}–${formatTime(nextTime, this._chart.timeZone)}</strong>${entries.join('')}`;
    const percentage = (x / this._chart.svgWidth) * 100;
    tooltip.style.left = `${Math.max(15, Math.min(85, percentage))}%`;
    tooltip.style.top = '48%';
    const live = this.shadowRoot.querySelector('.sr-only');
    live.textContent = `${formatTime(point.timestamp, this._chart.timeZone)} tot ${formatTime(nextTime, this._chart.timeZone)}, ${liveEntries.join(', ')}.`;
  }

  _hideTooltip() {
    this.shadowRoot.querySelector('.tooltip')?.setAttribute('hidden', '');
    this.shadowRoot.querySelector('.hover-line')?.setAttribute('hidden', '');
    this.shadowRoot.querySelector('[data-series="import"]')?.setAttribute('hidden', '');
    this.shadowRoot.querySelector('[data-series="export"]')?.setAttribute('hidden', '');
  }

  _styles() {
    return `
      :host {
        --cheap: var(--success-color, #19a974);
        --normal: #f2a93b;
        --expensive: var(--error-color, #e45c4f);
        --zero-color: #18a999;
        --negative-color: #168aad;
        --export-best: #1976d2;
        --cheapest-fill: color-mix(in srgb, var(--cheap) 13%, transparent);
        --export-best-fill: color-mix(in srgb, var(--export-best) 18%, transparent);
        display: block;
        height: 100%;
      }
      ha-card { overflow: hidden; height: 100%; }
      .card-content { display: flex; flex-direction: column; box-sizing: border-box; min-height: 0; height: 100%; padding: 16px 16px 12px; color: var(--primary-text-color); }
      .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .heading { min-width: 0; }
      h2 { margin: 0; font-size: 20px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; }
      .header-cheapest { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 12px; min-height: 34px; color: var(--secondary-text-color); font-size: 12px; font-weight: 600; }
      .header-cheapest span { display: inline-flex; align-items: center; gap: 6px; }
      .current-block { display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; flex: none; margin-left: auto; }
      .current-metric { display: grid; justify-items: end; gap: 3px; min-width: 0; }
      .current-label { color: var(--secondary-text-color); font-size: 10px; font-weight: 650; }
      .current { display: grid; grid-template-columns: auto auto; align-items: baseline; column-gap: 5px; padding: 7px 9px; border-radius: 8px; background: var(--secondary-background-color); font-variant-numeric: tabular-nums; }
      .current strong { font-size: 20px; line-height: 1; }
      .current span { font-size: 10px; color: var(--secondary-text-color); }
      .current.negative strong { color: var(--negative-color); }
      .current.cheap strong { color: var(--cheap); }
      .current.normal strong { color: var(--normal); }
      .current.expensive strong { color: var(--expensive); }
      .current.unavailable strong { color: var(--secondary-text-color); }
      .current-window { color: var(--secondary-text-color); font-size: 9px; font-weight: 650; }
      .current-window.active { color: var(--cheap); }
      .current-metric.export .current-window.active { color: var(--export-best); }
      .legend { display: flex; flex-wrap: wrap; gap: 7px 16px; margin: 12px 0 2px; color: var(--secondary-text-color); font-size: 11px; }
      .legend span { display: inline-flex; align-items: center; gap: 6px; }
      .swatch { width: 15px; height: 4px; border-radius: 4px; background: var(--divider-color); }
      .swatch.import-series { background: var(--primary-color); }
      .swatch.export-series { height: 3px; border-radius: 0; background: repeating-linear-gradient(90deg, var(--primary-color) 0 7px, transparent 7px 13px); }
      .swatch.selection, .swatch.export-selection { height: 11px; border-radius: 2px; background: var(--cheapest-fill); border: 1px solid color-mix(in srgb, var(--cheap) 45%, transparent); }
      .swatch.export-selection { background: var(--export-best-fill); border-color: color-mix(in srgb, var(--export-best) 55%, transparent); }
      .chart { position: relative; flex: 1 1 300px; min-height: 120px; outline: none; touch-action: pan-y; }
      .chart:focus-visible { box-shadow: inset 0 0 0 2px var(--primary-color); border-radius: 8px; }
      svg { display: block; width: 100%; height: 100%; overflow: hidden; }
      .chart-label { position: absolute; z-index: 1; pointer-events: none; font-variant-numeric: tabular-nums; white-space: nowrap; text-shadow: 0 1px 2px var(--card-background-color), 0 0 4px var(--card-background-color); }
      .x-label { bottom: 4px; transform: translateX(-50%); color: var(--secondary-text-color); font-size: 10px; }
      .y-label { left: 1px; transform: translateY(-50%); color: var(--secondary-text-color); font-size: 10px; }
      .day-label { top: 8px; color: var(--primary-text-color); font-size: 11px; font-weight: 700; }
      .now-label { top: 8px; transform: translateX(-50%); color: var(--primary-text-color); font-size: 10px; font-weight: 700; }
      .level-label { right: 3px; transform: translateY(-135%); color: var(--secondary-text-color); font-size: 10px; }
      .level-label.import-level:nth-of-type(1) { color: var(--cheap); }
      .average-label { transform: translateY(-135%); color: var(--primary-text-color); font-size: 10px; font-weight: 650; }
      .export-average-label { border-bottom: 1px dashed currentColor; }
      .day-divider { stroke: var(--primary-text-color); stroke-opacity: 0.28; stroke-dasharray: 4 5; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .area { fill: url(#price-area); stroke: none; }
      .price-line { fill: none; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
      .import-line { stroke: url(#price-line-gradient); }
      .export-line { stroke: url(#export-line-gradient); stroke-dasharray: 8 7; stroke-linecap: butt; }
      .level-line { stroke-opacity: 0.55; stroke-dasharray: 5 5; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .cheap-level[data-level-class="import-level"] { stroke: var(--cheap); }
      .normal-level { stroke: var(--normal); }
      .expensive-level[data-level-class="import-level"] { stroke: var(--expensive); }
      .cheap-level[data-level-class="export-level"] { stroke: var(--expensive); }
      .expensive-level[data-level-class="export-level"] { stroke: var(--cheap); }
      .level-line[data-level-class="neutral-level"] { stroke: var(--secondary-text-color); }
      .neutral-level { color: var(--secondary-text-color); }
      .average-line { stroke: var(--primary-text-color); stroke-opacity: 0.62; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
      .import-average { stroke-dasharray: 8 5; }
      .export-average { stroke-dasharray: 2 5; }
      .now-line { stroke: var(--primary-text-color); stroke-opacity: 0.72; stroke-dasharray: 3 3; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
      .hover-line { stroke: var(--primary-text-color); stroke-opacity: 0.75; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
      .hover-dot { position: absolute; z-index: 2; width: 12px; height: 12px; box-sizing: border-box; border: 3px solid; border-radius: 50%; transform: translate(-50%, -50%); background: var(--card-background-color); pointer-events: none; }
      .hover-dot.negative { border-color: var(--negative-color); }
      .hover-dot.cheap { border-color: var(--cheap); }
      .hover-dot.normal { border-color: var(--normal); }
      .hover-dot.expensive { border-color: var(--expensive); }
      .export-dot { width: 14px; height: 14px; border-style: dashed; }
      .tooltip { position: absolute; z-index: 3; transform: translate(-50%, -50%); min-width: 180px; padding: 9px 11px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); box-shadow: 0 5px 16px rgba(0, 0, 0, 0.2); pointer-events: none; font-variant-numeric: tabular-nums; }
      .tooltip strong, .tooltip span, .tooltip small { display: block; white-space: nowrap; }
      .tooltip strong { margin-bottom: 4px; font-size: 12px; }
      .tooltip span { margin-top: 2px; font-size: 12px; }
      .tooltip span b { display: inline-block; min-width: 90px; }
      .tooltip small { margin: 1px 0 4px 16px; color: var(--secondary-text-color); font-size: 10px; }
      .tooltip-series { display: inline-block; width: 10px; height: 3px; margin-right: 6px; vertical-align: middle; background: var(--primary-color); }
      .tooltip-series.export { height: 0; border-top: 2px dashed var(--primary-color); background: none; }
      .price-table-wrap { flex: 0 1 auto; min-height: 0; max-height: 190px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--divider-color); overflow: auto; }
      .price-table-wrap h3 { margin: 0 0 4px; font-size: 11px; font-weight: 700; }
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
        .header { gap: 8px; }
        h2 { font-size: 17px; }
        .current-block { gap: 5px; max-width: 64%; }
        .current { padding: 6px; column-gap: 3px; }
        .current strong { font-size: 17px; }
        .current span { font-size: 8px; }
        .current-label { font-size: 9px; }
        .legend { gap: 6px 10px; margin-top: 9px; }
        .chart { flex-basis: 260px; min-height: 110px; }
        .tooltip { min-width: 166px; }
      }
      @media (max-width: 360px) {
        .header { flex-wrap: wrap; }
        .current-block { width: 100%; max-width: none; margin-left: 0; justify-content: stretch; }
        .current-metric { flex: 1 1 0; justify-items: stretch; }
        .current { justify-content: center; }
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
    description: 'Afname- en terugleverprijzen met gunstige momenten per dag.',
    preview: true,
  });
}
