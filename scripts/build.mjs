import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const utilsPath = resolve(root, 'src/price-utils.js');
const cardPath = resolve(root, 'src/dynamic-energy-price-card.js');
const outputPath = resolve(root, 'dist/dynamic-energy-price-card.js');

const [utilsSource, cardSource, localizationSource] = await Promise.all([
  readFile(utilsPath, 'utf8'),
  readFile(cardPath, 'utf8'),
  readFile(resolve(root, 'src/localization.js'), 'utf8'),
]);

const importPattern = /^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/price-utils\.js['"];\s*/;
if (!importPattern.test(cardSource)) {
  throw new Error('Expected price-utils import was not found in the card source.');
}

const bundledUtils = utilsSource.replace(/^export\s+/gm, '');
const bundledLocalization = localizationSource.replace(/^export\s+/gm, '');
const bundledCard = cardSource.replace(importPattern, '').replace(/^import .* from '\.\/localization\.js';\s*/m, '');
const banner = '// Dynamic Energy Price Card — HACS dashboard bundle\n';

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${banner}${bundledUtils}\n${bundledLocalization}\n${bundledCard}`, 'utf8');
console.log(`Built ${outputPath}`);
