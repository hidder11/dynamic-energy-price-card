# UI Design Specification

## Product and users
Een Home Assistant-card voor bewoners met een dynamisch energiecontract. De card beantwoordt direct wat afname nu kost, wat teruglevering nu oplevert en wanneer de gunstigste afname- en teruglevermomenten liggen.

## Primary workflows and priorities
1. In één oogopslag de huidige prijs en kleurklasse zien.
2. De 16 goedkoopste kwartieren per kalenderdag herkennen; samen vier uur.
3. Met muis of aanraking een specifiek kwartier inspecteren.
4. Vandaag vergelijken met morgen, maar morgen pas vanaf 14:00 lokale tijd tonen.
5. Afname, teruglevering of beide vergelijken zonder negatieve tekenconventie voor teruglevering.

## Visual direction
Rustige data-analyse in de stijl van de Tibber-prijsgrafiek: vloeiende lijn, subtiele oppervlaktevulling, veel horizontale rust en compacte metriek. De card gebruikt Home Assistant-themawaarden en kopieert geen Tibber-assets.

## Layout and navigation
Eén zelfstandige Lovelace-card. Bovenaan staan optioneel de titel en één of twee actuele prijsblokken met expliciete labels `Afname` en `Teruglevering`. Daaronder staat één gedeelde tijdgrafiek met naar keuze alleen afname, alleen teruglevering of beide lijnen. Afname is standaard zichtbaar. Grafiekmodus en actuele-prijsmodus zijn onafhankelijk. Geen interne navigatie. In een Home Assistant Sections-view gebruikt de card native `getGridOptions()` zodat de standaard layouteditor de hoogte en breedte kan beheren.

## Density and spacing
- Card padding: 16 px desktop, 12 px smal.
- Interne basisafstand: 4 px; groepen: 8/12/16 px.
- Grafiekhoogte: standaard circa 300 px en flexibel binnen de door Home Assistant toegewezen cardhoogte; minimaal genoeg voor leesbare labels en interactie.
- Pointer/touch-interactie gebruikt minimaal 44 px effectieve hit area.

## Design tokens
- Typography: Home Assistant-font; tabular numerals voor prijzen en tijden.
- Colors and semantic roles: voor afname is laag groen en hoog rood; voor teruglevering is dit omgekeerd, omdat een hoge vergoeding gunstig is. Bij twee lijnen onderscheidt een doorgetrokken afnamelijn zich van een gestreepte terugleverlijn, zodat kleur niet het enige signaal is. Gunstige perioden krijgen een effen, transparante achtergrondmarkering.
- Spacing scale: 4, 8, 12, 16, 24 px.
- Radii: 8 px tooltip, Home Assistant-cardradius voor buitenkant.
- Borders: subtiele `divider-color`; focus via `primary-color`.
- Shadows: alleen zwevende tooltip.
- Motion: 140 ms tooltip/hover; uit bij reduced motion.

## Component rules
De card leest `attributes.data` van de verplichte afname-entity. Elk punt bevat `start_time` en `price_per_kwh`. Terugleverprijzen gebruiken een tweede entity met dezelfde opbouw. `export_price_offset` wordt uitsluitend bij de prijs uit die terugleverentity opgeteld; de afnamereeks is nooit de basis voor deze offset. De native editor groepeert instellingen in uitklapbare kopjes `Afname` en `Teruglevering`. Afname- en terugleverlijnen gebruiken dezelfde numerieke prijsgrenzen, maar tegengestelde kleursemantiek. Wanneer `show_title` uit staat, neemt actieve gunstige-urencontext de titelpositie over.

## Data display and forms
Prijs wordt in ct/kWh getoond, met twee decimalen in tooltip. Teruglevering wordt als prijs/opbrengst getoond en niet kunstmatig negatief gemaakt; echte negatieve marktwaarden blijven wel mogelijk. `graph_mode` en `current_price_mode` bieden `import`, `both` en `export`; de actuele-prijsmodus ondersteunt daarnaast `none`. Tijd wordt Nederlands als `HH:mm–HH:mm` weergegeven. Vandaag en morgen worden als aparte kalenderdagen behandeld.

## Interaction and feedback
Hover, pointer-drag en tik tonen één verticale richtlijn en per zichtbare serie een ronde marker. De tooltip noemt tijd, de zichtbare afname- en/of terugleverprijs en de gunstige-periodestatus. Afname selecteert de laagste prijzen; teruglevering selecteert de hoogste prijzen.

## Empty, loading, error, permission, and destructive states
- Ontbrekende entity: concrete configuratiefout.
- Geen `data`: rustige lege toestand met bronvermelding.
- Morgen vóór 14:00: verborgen, met korte tekst dat morgenprijzen vanaf 14:00 verschijnen.
- Onvolledige morgenprijzen na 14:00: beschikbare data tonen en als onvolledig markeren.
- Verouderde data: waarschuwing wanneer vandaag niet voorkomt.
- Teruglevermodus zonder terugleverentity: concrete configuratiefout met hersteladvies.
- Gedeeltelijk ontbrekende terugleverintervallen: afnamedata blijft zichtbaar; ontbrekende waarde wordt als `—` gemeld.

## Responsive behavior and supported viewports
Volledig bruikbaar vanaf 320 px cardbreedte. Op smalle schermen worden secundaire labels ingekort, maar grafiek en tooltip blijven intact. Hover is aanvullend; touch werkt zelfstandig. Voor Sections gebruikt de card standaard 12 kolommen, minimaal 9 kolommen, standaard 6 rijen zonder tabel en 9 rijen met tabel. De minimale hoogte is 4 rijen zonder tabel en 6 rijen met tabel; de maximale hoogte blijft vrij. Bij beperkte hoogte scrolt de tabel intern in plaats van buiten de card te vallen.

## Accessibility and localization
Nederlandse labels, toetsenbordfocus op de grafiek en pijltjestoetsen voor vorig/volgend interval. Tooltipinformatie komt in een `aria-live`-regio. Arcering en tekstlabels ondersteunen kleurwaarneming.

## Rejected alternatives and rationale
- Alleen vier aaneengesloten uren: afgewezen door gebruiker.
- Vier hele uurblokken: bron gebruikt kwartierprijzen; de 16 goedkoopste kwartieren sluiten beter aan op “goedkoopste momenten, samen vier uur”.
- Externe chartlibrary: afgewezen om updates en Home Assistant-compatibiliteit eenvoudiger te houden.
- Twee grafieken onder elkaar: afgewezen; één gedeelde tijdas maakt directe vergelijking eenvoudiger en gebruikt minder dashboardhoogte.
- Teruglevering onder nul tekenen alleen vanwege de energierichting: afgewezen; beide tarieven gebruiken hun werkelijke prijswaarde.

## Open decisions
Geen blokkerende ontwerpbeslissingen.

## Acceptance criteria
- Alleen vandaag en morgen worden getoond.
- Morgen verschijnt niet vóór 14:00 lokale Home Assistant-tijd.
- Per zichtbare dag worden de goedkoopste intervallen geselecteerd tot exact 240 minuten; bij kwartierdata zijn dit 16 intervallen.
- Intervallen onder €0,25/kWh zijn goedkoop gekleurd; €0,25/kWh en hoger duur.
- De goedkoopste intervallen zijn gearceerd en ook tekstueel herkenbaar in de tooltip.
- Hover, touch en toetsenbord tonen prijs en tijd.
- Werkt met licht/donker Home Assistant-thema en vanaf 320 px.
- Home Assistant toont geen waarschuwing meer dat aangepaste kaartformaten niet volledig worden ondersteund.
- De card volgt de ingestelde Sections-hoogte zonder dat grafiek of tabel buiten de card valt.
- De titel kan worden verborgen; actieve goedkoopste-urencontext verschijnt dan op de titelpositie.
- Standaard blijven grafiek en actuele prijs op alleen afname staan, zodat bestaande configuraties hetzelfde ogen.
- Grafiekmodus en actuele-prijsmodus zijn onafhankelijk instelbaar op afname, beide of teruglevering; actuele prijzen kunnen ook volledig uit.
- Terugleverdata komt uit een tweede entity; de optionele offset wordt uitsluitend op die terugleverentity toegepast.
- De afnamelijn is doorgetrokken. De terugleverlijn gebruikt duidelijk zichtbare onderbrekingen met rechte lijnuiteinden; de legenda toont hetzelfde patroon, zodat de reeksen ook zonder kleur te onderscheiden zijn.
- De terugleverlijn gebruikt dezelfde grenzen maar omgekeerde kleuren: hoge terugleverprijs groen, lage terugleverprijs rood.
- Geselecteerde beste terugleverperioden gebruiken een vaste blauwe accentkleur in zowel lichte als donkere Home Assistant-thema's.
- Per dag kunnen afzonderlijk de laagste afnameprijzen en hoogste terugleverprijzen worden geselecteerd en in tabellen worden getoond.
- De native editor bevat herkenbare uitklapbare groepen voor `Afname` en `Teruglevering`.
- Nieuwe Lovelace-dashboardweergave is geïnstalleerd en teruggelezen.

## Change log
- 2026-10-07: dubbele afname-/terugleverweergave, onafhankelijke modi, offsetbron, omgekeerde terugleverkleuren en gegroepeerde editorinstellingen vastgelegd.
- 2026-10-07: native Sections-sizing en een optioneel verborgen titel vastgelegd.
- 2026-10-06: initiële specificatie op basis van live Tibber-kwartierdata en gebruikerskeuzes.
