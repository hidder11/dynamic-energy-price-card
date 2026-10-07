import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
CARD = ROOT / "src" / "dynamic-energy-price-card.js"


class CardSourceTests(unittest.TestCase):
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
        self.assertIn('<table class="cheapest-table">', card)
        self.assertIn("name: 'show_cheapest_table'", card)
        self.assertIn('show_hover_line: true', card)
        self.assertIn('show_average_line: false', card)
        self.assertIn("name: 'show_hover_line'", card)
        self.assertIn("name: 'show_average_line'", card)
        self.assertIn('class="average-line"', card)
        self.assertIn('const hoverLine =', card)

    def test_card_preserves_native_visual_editor(self):
        card = CARD.read_text(encoding="utf-8")
        self.assertIn('static getConfigForm()', card)
        self.assertIn('computeHelper:', card)
        self.assertIn("mode: 'slider'", card)
        self.assertNotIn('class DynamicEnergyPriceCardEditor', card)
        for field in ('title', 'cheap_price', 'normal_price', 'expensive_price', 'cheapest_hours', 'tomorrow_after'):
            self.assertIn(f"name: '{field}'", card)


if __name__ == "__main__":
    unittest.main()
