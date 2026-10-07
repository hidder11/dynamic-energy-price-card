# Dynamic Energy Price Card

Een Home Assistant-dashboardkaart voor dynamische kwartierprijzen, met vandaag/morgen, actuele prijs, configureerbare prijsniveaus en optionele goedkoopste uren.

## HACS-categorie

Dit is een **Dashboard**-repository (frontend/plugin), geen Home Assistant-integratie.

## Lokale ontwikkeling

```bash
npm run build
npm test
```

De zelfstandige HACS-bundel wordt geschreven naar:

```text
dist/dynamic-energy-price-card.js
```

## Installatie als aangepaste HACS-repository

Na publicatie van deze map als openbare GitHub-repository:

1. Open HACS.
2. Voeg de repository toe als aangepaste repository met categorie **Dashboard**.
3. Installeer **Dynamic Energy Price Card**.
4. Voeg `custom:dynamic-energy-price-card` toe aan een dashboard.

De visuele editor gebruikt Home Assistants native `getConfigForm()`.
