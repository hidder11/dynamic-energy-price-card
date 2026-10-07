import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
CARD = ROOT / "src" / "dynamic-energy-price-card.js"


class CardSourceTests(unittest.TestCase):
    def test_native_sections_sizing_and_optional_title(self):
        card = CARD.read_text(encoding='utf-8')
        self.assertIn('getGridOptions()', card)
        self.assertIn('columns: 12', card)
        self.assertIn('min_columns: 9', card)
        self.assertIn('rows: hasCheapestTable ? 9 : 6', card)
        self.assertIn('min_rows: hasCheapestTable ? 6 : 4', card)
        self.assertIn('show_title: true', card)
        self.assertIn("name: 'show_title'", card)
        self.assertIn("showTitle ?", card)
        self.assertIn('class="header-cheapest"', card)
        self.assertIn('height: 100%', card)
        self.assertIn('flex: 1 1 300px', card)
        self.assertIn('overflow: auto', card)

    def test_hover_marker_stays_round_when_chart_resizes(self):
        card = CARD.read_text(encoding='utf-8')
        self.assertNotIn('<circle class="hover-dot"', card)
        self.assertIn('<span class="hover-dot"', card)
        self.assertIn("dot.style.left =", card)
        self.assertIn("dot.style.top =", card)
        self.assertIn('border-radius: 50%', card)
        self.assertIn('width: 12px', card)
        self.assertIn('height: 12px', card)

    def test_mobile_hover_interaction_is_dismissible(self):
        card = CARD.read_text(encoding='utf-8')
        self.assertIn("line?.removeAttribute('hidden')", card)
        self.assertIn("dot.removeAttribute('hidden')", card)
        self.assertIn("window.addEventListener('pointerdown', this._onOutsidePointer)", card)
        self.assertIn("window.removeEventListener('pointerdown', this._onOutsidePointer)", card)

    def test_card_has_no_external_runtime_dependency(self):
        card = CARD.read_text(encoding="utf-8")
        self.assertNotIn("https://", card)
        self.assertNotIn("http://", card)
        self.assertIn("customElements.define", card)

    def test_chart_uses_gradient_now_line_and_html_labels(self):
        card = CARD.read_text(encoding="utf-8")
        self.assertIn('id="price-line-gradient"', card)
        self.assertIn('class="now-line"', card)
        self.assertIn('class="chart-label x-label"', card)
        self.assertIn('preserveAspectRatio="none"', card)
        self.assertNotIn('<text ', card)
        self.assertIn('cheap_price: 0.15', card)
        self.assertIn('normal_price: 0.25', card)
        self.assertIn('expensive_price: 0.40', card)
        self.assertIn('cheapest_hours: 0', card)
        self.assertIn('const legend = cheapestEnabled', card)
        self.assertNotIn('${yGrid}', card)
        self.assertNotIn('.grid-line {', card)
        self.assertIn('class="level-line cheap-level"', card)
        self.assertIn('class="level-line normal-level"', card)
        self.assertIn('class="level-line expensive-level"', card)
        self.assertNotIn('id="cheapest-hatch"', card)
        self.assertNotIn('<div class="summary">', card)
        self.assertNotIn('${escapeHtml(availability)}', card)
        self.assertIn('Goedkoopst</div>', card)
        self.assertIn('show_cheapest_table: false', card)
        self.assertIn('const cheapestTable =', card)
        self.assertIn('<table class="cheapest-table', card)
        self.assertIn("name: 'show_cheapest_table'", card)
        self.assertIn('show_hover_line: true', card)
        self.assertIn('show_average_line: false', card)
        self.assertIn("name: 'show_hover_line'", card)
        self.assertIn("name: 'show_average_line'", card)
        self.assertIn('class="average-line ', card)
        self.assertIn('const hoverLine =', card)

    def test_card_preserves_native_visual_editor(self):
        card = CARD.read_text(encoding="utf-8")
        self.assertIn('static getConfigForm()', card)
        self.assertIn('computeHelper:', card)
        self.assertIn("mode: 'slider'", card)
        self.assertNotIn('class DynamicEnergyPriceCardEditor', card)
        for field in ('title', 'cheap_price', 'normal_price', 'expensive_price', 'cheapest_hours', 'tomorrow_after'):
            self.assertIn(f"name: '{field}'", card)

    def test_import_and_export_series_are_independently_configurable(self):
        card = CARD.read_text(encoding="utf-8")
        for field in (
            'graph_mode', 'current_price_mode', 'export_entity', 'export_price_offset',
            'export_best_hours', 'show_export_table',
        ):
            self.assertIn(f"name: '{field}'", card)
        self.assertIn("type: 'expandable'", card)
        self.assertIn("title: 'Afname'", card)
        self.assertIn("title: 'Teruglevering'", card)
        self.assertIn("graph_mode: 'import'", card)
        self.assertIn("current_price_mode: 'import'", card)
        self.assertIn("id=\"export-line-gradient\"", card)
        self.assertIn('class="price-line export-line"', card)
        self.assertIn('stroke-dasharray: 9 5', card)
        self.assertIn('selectHighestDuration', card)


if __name__ == "__main__":
    unittest.main()
