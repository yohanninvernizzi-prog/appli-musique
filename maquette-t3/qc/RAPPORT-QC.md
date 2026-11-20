# Rapport de contrôle qualité — maquette T3 lot 16

Généré le 2026-11-20 10:26:06 UTC à partir de `index.html` (objet GEO).

## 1. Surfaces intérieures recalculées (tolérance ±5 %)

| Pièce                      | Cotes intérieures (cm) | Calculé (m²) | Officiel (m²) | Écart   | Verdict        |
|----------------------------|------------------------|--------------|---------------|---------|----------------|
| Séjour / cuisine           | polygone (12 sommets)  | 30,02        | 30,11         | -0,3 %  | OK             |
| Entrée                     | 119 × 218              | 2,59         | 2,64          | -1,7 %  | OK             |
| Placard                    | 67 × 167               | 1,12         | 1,29          | -13,3 % | HORS TOLÉRANCE |
| Salle d'eau                | 190 × 278              | 5,28         | 5,15          | +2,6 %  | OK             |
| Dégagement (inclus séjour) | 139 × 100              | 1,39         | —             | —       | info           |
| WC                         | 139 × 185              | 2,57         | 2,23          | +15,3 % | HORS TOLÉRANCE |
| Chambre 1                  | 404 × 278              | 11,23        | 11,58         | -3,0 %  | OK             |
| Chambre 2                  | 314 × 292              | 9,17         | 9,37          | -2,1 %  | OK             |
| Terrasse (ext.)            | 415 × 200              | 8,30         | 8,40          | -1,2 %  | OK             |

Total habitable (hors terrasse, dégagement compté dans le séjour) : **61,99 m²** calculé, 62,37 m² officiel (écart -0,6 %).

## 2. Conformité des données GEO aux cotes du cahier des charges

- OK : 19 murs et 8 ouvertures identiques au cahier des charges (aucune cote modifiée).
- OK : aucune fenêtre déclarée sur le mur mitoyen ni sur le mur du couloir.

## 3. Recouvrements de murs et continuité des pièces fermées

Recouvrements entre rectangles de murs (issus directement des cotes fournies ; ce sont des jonctions d'angle ou de raccord, même matériau, sans effet visuel) :

| Mur A         | Mur B          | Zone commune         | Taille (cm) |
|---------------|----------------|----------------------|-------------|
| placard-droit | placard-bas    | x 186→193, y 219→226 | 7 × 7       |
| sde-gauche    | sde-bas-g      | x 494→501, y 278→285 | 7 × 7       |
| sde-bas-d     | sde-ch1-double | x 691→706, y 278→285 | 15 × 7      |
| ch1-bas       | raccord        | x 783→796, y 278→285 | 13 × 7      |
| wc-gauche     | wc-haut        | x 642→649, y 385→392 | 7 × 7       |

Trous dans le périmètre des pièces fermées (ni mur ni ouverture déclarée) :

| Pièce | Côté | Intervalle (cm) | Longueur (cm) |
|-------|------|-----------------|---------------|
| WC    | haut | 783 → 788       | 5             |

→ Non comblé dans la maquette (aucune cote inventée) : à confirmer, voir HYPOTHESES.md.

## 4. Ouvertures : coordonnées réelles relevées dans la scène 3D

Repère plan (cm) : x vers la droite, y vers la terrasse (= axe Z de three.js), h = hauteur. Valeurs lues sur les boîtes englobantes des objets de la scène.

| Ouverture    | Attendu (cahier)            | Mesuré dans la scène                                      | Vide / tableaux / linteau / allège (rayons)                                                                                                                                                                         |
|--------------|-----------------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| porte-entree | x 1→99, h 215               | vantail x 1→5 · y 0→98 · h 1→215 · gond (1, 0)            | OK                                                                                                                                                                                                                  |
| porte-sde    | x 602→681, h 204            | vantail x 677→681 · y 285→364 · h 1→204 · gond (681, 285) | OK                                                                                                                                                                                                                  |
| porte-wc     | x 701→783, h 204            | vantail x 779→783 · y 303→385 · h 1→204 · gond (783, 385) | ÉCHEC {"videAuCentre":true,"videBordDebut":true,"videBordFin":true,"tableauAvantDebut":true,"tableauApresFin":false,"videSousLinteau":true,"linteauAuDessus":true,"allegeEnDessous":null,"videAuDessusAllege":null} |
| porte-ch1    | x 706→781, h 204            | vantail x 777→781 · y 203→278 · h 1→204 · gond (781, 278) | OK                                                                                                                                                                                                                  |
| porte-ch2    | y 287→375, h 204            | vantail x 796→884 · y 287→291 · h 1→204 · gond (796, 287) | OK                                                                                                                                                                                                                  |
| baie-sejour  | x 367→565, h 215            | dormant x 367→565 · y 577→584 · h 0→215                   | OK                                                                                                                                                                                                                  |
| fenetre-ch2  | x 893→993, allège 90, h 135 | dormant x 893→993 · y 577→584 · h 90→225                  | OK                                                                                                                                                                                                                  |
| fenetre-ch1  | y 161→261, allège 90, h 135 | dormant x 1110→1117 · y 161→261 · h 90→225                | OK                                                                                                                                                                                                                  |

Tests par rayons à travers l'épaisseur du mur : vide au centre et à 0,5 cm des deux bords, mur présent à 0,5 cm hors des deux bords (tableaux), vide à 0,5 cm sous le haut, linteau à 0,5 cm au-dessus, allège à 0,5 cm sous l'appui.
- porte-wc : tableauApresFin

### Balayage des murs extérieurs (rayon tous les 1 cm à travers le mur) — intervalles SANS mur

| Mur                                   | à 150 cm de haut          | à 50 cm de haut   |
|---------------------------------------|---------------------------|-------------------|
| mitoyen-g (x<0), le long de y         | aucun (mur plein)         | aucun (mur plein) |
| couloir (y<0), le long de x           | 1.5→98.5                  | 1.5→98.5          |
| façade terrasse (y>577), le long de x | 367.5→564.5 ; 893.5→992.5 | 367.5→564.5       |
| façade droite (x>1110), le long de y  | 161.5→260.5               | aucun (mur plein) |

Les bornes sont les positions des rayons (pas de 1 cm, décalés de 0,5) : « 1.5→98.5 » = vide entre 1 et 99.
- OK : ouvertures extérieures exactement aux positions attendues, aucune ouverture sur le mur mitoyen ni sur le mur du couloir (hors porte d'entrée).

## 5. Captures

| Fichier                                      | Contenu                                                        |
|----------------------------------------------|----------------------------------------------------------------|
| captures/01-dessus-cotes.png                 | Vue de dessus orthographique, coupe à 120 cm, cotes et noms    |
| captures/02-dessus-equipements.png           | Vue de dessus avec le calque équipements                       |
| captures/03-maquette.png                     | Vue maquette (orbite), plafond masqué                          |
| captures/04-maquette-coupe.png               | Vue maquette, murs coupés à 120 cm                             |
| captures/05-maquette-arriere.png             | Vue maquette depuis le couloir / la façade droite              |
| captures/06-facade-terrasse.png              | Façade terrasse vue de l'extérieur (baie et fenêtre chambre 2) |
| captures/07-vue-entree-baie.png              | Point de vue : Entrée → baie                                   |
| captures/08-vue-baie-cuisine.png             | Point de vue : Baie → cuisine                                  |
| captures/09-vue-sejour-degagement.png        | Point de vue : Séjour → dégagement                             |
| captures/10-vue-chambre-1.png                | Point de vue : Chambre 1                                       |
| captures/11-vue-chambre-2.png                | Point de vue : Chambre 2                                       |
| captures/12-vue-baie-cuisine-equipements.png | Baie → cuisine avec équipements                                |
| captures/13-telephone-dessus.png             | Téléphone (390 × 844) : vue de dessus                          |
| captures/14-telephone-visite.png             | Téléphone : visite avec joystick                               |

- Aucune erreur JavaScript dans la page.

## Bilan

3 point(s) non conforme(s) ou à confirmer — détail ci-dessus.
