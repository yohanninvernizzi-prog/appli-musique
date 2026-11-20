# Maquette 3D — T3 lot 16 (RDC, ancienne ferme, Haut-Doubs)

Maquette à l'échelle exacte (1 unité = 1 cm) pour valider les volumes **avant aménagement**.

## Ouvrir

Double-cliquer sur `index.html`. Il faut une connexion internet au premier chargement :
three.js 0.170.0 est chargé depuis cdn.jsdelivr.net.

## Utiliser

| Vue | Ordinateur | Téléphone |
|-----|-----------|-----------|
| **Maquette** (orbite, plafond masqué) | glisser : tourner · clic droit : déplacer · molette : zoom | 1 doigt : tourner · 2 doigts : zoomer et déplacer |
| **Visite** (œil à 160 cm, collisions) | cliquer dans la vue pour activer la souris · ZQSD / flèches · Maj : plus vite · Échap : libérer la souris | joystick en bas à gauche · glisser ailleurs pour regarder |
| **Dessus** (orthographique, coupe à 120 cm) | glisser : déplacer · molette : zoom | 1 doigt : déplacer · 2 doigts : zoomer (en portrait, le plan est pivoté d'un quart de tour) |

Le panneau **Options** contient :
- les 5 points de vue prédéfinis ;
- les calques plafond, équipements fixes (désactivé par défaut), cotes, noms des pièces et coupe à 120 cm ;
- l'outil **Mesurer** : deux clics au sol, avec aimantation sur les angles et les faces des murs. La distance s'affiche en cm, avec Δx et Δy.

Chaque vue garde ses propres réglages de plafond et de coupe.

## Corriger une cote

Toutes les données sont dans l'objet `GEO`, en tête de `index.html` : `walls`, `openings`, `rooms`, `fixtures`
(plus `meta` pour les valeurs standard et `vues` pour les points de vue). Après une modification, recharger la page.
Les murs, ouvertures, plinthes, cotes et surfaces affichées sont tous recalculés à partir de ces données.

## Contrôle qualité

```bash
node qc/qc.cjs
```

Le script recalcule les surfaces et les compare aux surfaces officielles (±5 %). Il compare aussi `GEO` aux cotes
du cahier des charges, cherche les recouvrements et les trous dans les murs, puis ouvre la page dans Chromium
(Playwright). Il y relève les coordonnées réelles des ouvertures, teste chaque vide par lancers de rayons, balaie
les quatre murs extérieurs et refait les captures dans `captures/`. Le rapport est écrit dans `qc/RAPPORT-QC.md`.
Si la machine n'a pas accès au CDN, ajouter `THREE_LOCAL=/chemin/vers/node_modules/three` pour servir three.js
en local. `node qc/qc.cjs --no-browser` fait les calculs seuls.

Les hypothèses et les écarts à confirmer sont listés dans `HYPOTHESES.md`.
