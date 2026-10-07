# UI Design Specification

## Product and users
Een Home Assistant-card voor bewoners met een dynamisch Tibber-contract. De card beantwoordt direct: wat kost stroom nu, wanneer zijn de vier goedkoopste uren en welke kwartieren liggen onder of boven €0,25/kWh?

## Primary workflows and priorities
1. In één oogopslag de huidige prijs en kleurklasse zien.
2. De 16 goedkoopste kwartieren per kalenderdag herkennen; samen vier uur.
3. Met muis of aanraking een specifiek kwartier inspecteren.
4. Vandaag vergelijken met morgen, maar morgen pas vanaf 14:00 lokale tijd tonen.

## Visual direction
Rustige data-analyse in de stijl van de Tibber-prijsgrafiek: vloeiende lijn, subtiele oppervlaktevulling, veel horizontale rust en compacte metriek. De card gebruikt Home Assistant-themawaarden en kopieert geen Tibber-assets.

## Layout and navigation
Eén zelfstandige Lovelace-card. Bovenaan staan optioneel de titel, de huidige prijs en context over de goedkoopste uren. Daaronder staat één doorlopende tijdgrafiek met een duidelijke dagscheiding en optioneel de periodentabel. Geen interne navigatie. In een Home Assistant Sections-view gebruikt de card native `getGridOptions()` zodat de standaard layouteditor de hoogte en breedte kan beheren.

## Density and spacing
- Card padding: 16 px desktop, 12 px smal.
- Interne basisafstand: 4 px; groepen: 8/12/16 px.
- Grafiekhoogte: standaard circa 300 px en flexibel binnen de door Home Assistant toegewezen cardhoogte; minimaal genoeg voor leesbare labels en interactie.
- Pointer/touch-interactie gebruikt minimaal 44 px effectieve hit area.

## Design tokens
- Typography: Home Assistant-font; tabular numerals voor prijzen en tijden.
- Colors and semantic roles: onder €0,25/kWh groen/teal; vanaf €0,25/kWh warm rood/oranje. De 16 goedkoopste kwartieren krijgen daarnaast arcering, zodat kleur niet het enige signaal is.
- Spacing scale: 4, 8, 12, 16, 24 px.
- Radii: 8 px tooltip, Home Assistant-cardradius voor buitenkant.
- Borders: subtiele `divider-color`; focus via `primary-color`.
- Shadows: alleen zwevende tooltip.
- Motion: 140 ms tooltip/hover; uit bij reduced motion.

## Component rules
De card leest `attributes.data` van de ingestelde prijsentity. Elk punt bevat `start_time` en `price_per_kwh`. De native editor ondersteunt de prijsniveaus, goedkoopste uren, periodentabel, morgenvenster, hoverlijn, gemiddelde lijn, titel en `show_title`. Wanneer `show_title` uit staat en goedkoopste uren actief zijn, neemt `Goedkoopste x uur/dag` de titelpositie over. Zonder beide blijft de huidige prijs rechts uitgelijnd.

## Data display and forms
Prijs wordt primair in ct/kWh getoond, met twee decimalen in tooltip. Tijd wordt Nederlands als `HH:mm–HH:mm` weergegeven. Vandaag en morgen worden als aparte kalenderdagen behandeld.

## Interaction and feedback
Hover, pointer-drag en tik tonen een kruisrichtlijn, marker en tooltip voor het dichtstbijzijnde interval. De tooltip noemt tijd, prijs, goedkoop/duur en of het interval bij de goedkoopste vier uur hoort.

## Empty, loading, error, permission, and destructive states
- Ontbrekende entity: concrete configuratiefout.
- Geen `data`: rustige lege toestand met bronvermelding.
- Morgen vóór 14:00: verborgen, met korte tekst dat morgenprijzen vanaf 14:00 verschijnen.
- Onvolledige morgenprijzen na 14:00: beschikbare data tonen en als onvolledig markeren.
- Verouderde data: waarschuwing wanneer vandaag niet voorkomt.

## Responsive behavior and supported viewports
Volledig bruikbaar vanaf 320 px cardbreedte. Op smalle schermen worden secundaire labels ingekort, maar grafiek en tooltip blijven intact. Hover is aanvullend; touch werkt zelfstandig. Voor Sections gebruikt de card standaard 12 kolommen, minimaal 9 kolommen, standaard 6 rijen zonder tabel en 9 rijen met tabel. De minimale hoogte is 4 rijen zonder tabel en 6 rijen met tabel; de maximale hoogte blijft vrij. Bij beperkte hoogte scrolt de tabel intern in plaats van buiten de card te vallen.

## Accessibility and localization
Nederlandse labels, toetsenbordfocus op de grafiek en pijltjestoetsen voor vorig/volgend interval. Tooltipinformatie komt in een `aria-live`-regio. Arcering en tekstlabels ondersteunen kleurwaarneming.

## Rejected alternatives and rationale
- Alleen vier aaneengesloten uren: afgewezen door gebruiker.
- Vier hele uurblokken: bron gebruikt kwartierprijzen; de 16 goedkoopste kwartieren sluiten beter aan op “goedkoopste momenten, samen vier uur”.
- Externe chartlibrary: afgewezen om updates en Home Assistant-compatibiliteit eenvoudiger te houden.

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
- Nieuwe Lovelace-dashboardweergave is geïnstalleerd en teruggelezen.

## Change log
- 2026-10-07: native Sections-sizing en een optioneel verborgen titel vastgelegd.
- 2026-10-06: initiële specificatie op basis van live Tibber-kwartierdata en gebruikerskeuzes.
