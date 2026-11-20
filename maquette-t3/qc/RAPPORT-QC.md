# Rapport de contrôle qualité — maquette T3 lot 16

Généré le 2026-11-20 11:44:38 UTC à partir de `index.html` (objet GEO).

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

## 3 bis. Aménagement : positions des meubles par rapport à la demande

| Meuble            | Position dans la maquette (cm)                 | Par rapport à la demande |
|-------------------|------------------------------------------------|--------------------------|
| ilot              | x 294→494, y 173→263, h 90                     | conforme                 |
| tabouret-1        | x 324→364, y 238→278, h 65                     | conforme                 |
| tabouret-2        | x 424→464, y 238→278, h 65                     | conforme                 |
| meuble-tv         | x 0→40, y 377→557, h 50                        | conforme                 |
| canape            | x 215→310, y 357→577, h 80                     | conforme                 |
| table-basse       | x 90→170, y 427→507, h 35                      | conforme                 |
| table-sejour      | x 465→575, y 400→510, h 75                     | conforme                 |
| lit-ch2           | x 886→1026, y 287→477, h 110                   | AJUSTÉ : x 882 → 886     |
| bureau-ch2        | x 883→1003, y 517→577, h 75                    | conforme                 |
| armoire-ch2       | x 1050→1110, y 300→480, h 220                  | conforme                 |
| cuisine-frigo     | x 193→254, y 0→63, h 200                       | conforme                 |
| suspension-ilot-1 | x 326.5→361.5, y 200.5→235.5, h 35 (bas à 175) | conforme                 |
| suspension-table  | x 490→550, y 425→485, h 60 (bas à 150)         | conforme                 |
| lit-superpose     | x 706→913, y 0→102, h 165                      | conforme                 |
| bureau-double     | x 1050→1110, y 58→258, h 75                    | conforme                 |
| armoire-ch1       | x 788→968, y 218→278, h 220                    | conforme                 |

55 éléments dans le tableau `furniture`. Les ajustements sont justifiés dans HYPOTHESES.md.

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

## 4 bis. Aménagement : chevauchements

Chaque meuble (emprise au sol + hauteur) est confronté aux murs, aux baies de portes et fenêtres, au débattement des 5 portes (quart de cercle du vantail), à la zone à garder libre devant la partie gauche de la baie, aux équipements fixes et aux autres meubles (tolérance 0,5 cm ; le tapis et les chaises rentrées sous leur table sont exclus).

- OK : aucun meuble ne chevauche un mur, une porte (débattement compris), la baie ou un autre meuble.

## 4 ter. Passages libres (seuil 80 cm)

« chemin » : plus grand disque pouvant circuler d'une zone à l'autre entre murs, équipements et meubles, portes supposées fermées (grille de 2 cm), largeur réelle mesurée au point le plus étroit. « écart » : distance mini entre deux éléments.

| Passage                                    | Largeur (cm) | Point le plus étroit entre                                                                                                     | Verdict        |
|--------------------------------------------|--------------|--------------------------------------------------------------------------------------------------------------------------------|----------------|
| Allée cuisine / îlot                       | 110          | colonne frigo (cuisine-frigo), meuble bas (cuisine-cuisson), meuble bas (cuisine-evier), meuble bas (cuisine-lv) ↔ îlot (ilot) | OK             |
| Entrée → dégagement                        | 82           | Salle d'eau, mur gauche ↔ chaise (chaise-n)                                                                                    | OK             |
| Entrée → baie (partie gauche)              | 85           | canapé (canape) ↔ tabouret (tabouret-1)                                                                                        | OK             |
| Couloir canapé / table → baie              | 123          | canapé (canape) ↔ chaise (chaise-o)                                                                                            | OK             |
| Chambre 1 : lit superposé ↔ armoire        | 116          | lit superposé (lit-superpose) ↔ armoire (armoire-ch1)                                                                          | OK             |
| Chambre 1 : armoire ↔ bureau               | 82           | armoire (armoire-ch1) ↔ bureau (bureau-double)                                                                                 | OK             |
| Chambre 1 : porte → bureaux                | 82           | Mur double salle d'eau / chambre 1 ↔ armoire (armoire-ch1)                                                                     | OK             |
| Chambre 1 : porte → rangement à cubes      | 82           | Mur double salle d'eau / chambre 1 ↔ armoire (armoire-ch1)                                                                     | OK             |
| Chambre 2 : porte → côté gauche du lit     | 90           | Mur chambre 2 / WC ↔ lit (lit-ch2)                                                                                             | OK             |
| Chambre 2 : côté droit du lit ↔ armoire    | 24           | lit (lit-ch2) ↔ armoire (armoire-ch2)                                                                                          | MOINS DE 80 CM |
| Chambre 2 : pied du lit ↔ chaise de bureau | 5            | lit (lit-ch2) ↔ chaise (chaise-bureau)                                                                                         | MOINS DE 80 CM |

- 2 passage(s) de moins de 80 cm (signalés, positions demandées conservées).

## 5. Captures

| Fichier                                        | Contenu                                                               |
|------------------------------------------------|-----------------------------------------------------------------------|
| captures/01-dessus-cotes.png                   | Vue de dessus, coupe à 120 cm, cotes, sans aménagement                |
| captures/02-maquette.png                       | Vue maquette, sans aménagement                                        |
| captures/03-facade-terrasse.png                | Façade terrasse vue de l'extérieur                                    |
| captures/04-vue-entree-baie-vide.png           | Sans aménagement : Entrée → baie                                      |
| captures/05-vue-baie-cuisine-vide.png          | Sans aménagement : Baie → cuisine                                     |
| captures/06-vue-sejour-degagement-vide.png     | Sans aménagement : Séjour → dégagement                                |
| captures/07-vue-chambre-1-vide.png             | Sans aménagement : Chambre 1                                          |
| captures/08-vue-chambre-2-vide.png             | Sans aménagement : Chambre 2                                          |
| captures/09-dessus-amenagement-passages.png    | Vue de dessus avec aménagement et passages libres                     |
| captures/10-maquette-amenagement.png           | Vue maquette avec aménagement                                         |
| captures/11-maquette-amenagement-arriere.png   | Vue maquette avec aménagement, depuis le couloir                      |
| captures/12-vue-entree-baie-amenage.png        | Avec aménagement : Entrée → baie                                      |
| captures/13-vue-baie-cuisine-amenage.png       | Avec aménagement : Baie → cuisine                                     |
| captures/14-vue-sejour-degagement-amenage.png  | Avec aménagement : Séjour → dégagement                                |
| captures/15-vue-chambre-1-amenage.png          | Avec aménagement : Chambre 1                                          |
| captures/16-vue-chambre-2-amenage.png          | Avec aménagement : Chambre 2                                          |
| captures/17-vue-salle-d-eau-amenage.png        | Avec aménagement : salle d'eau depuis la porte                        |
| captures/18-vue-salle-d-eau-lavabo-amenage.png | Avec aménagement : salle d'eau, lavabo, lave-linge, placard du ballon |
| captures/19-vue-wc-amenage.png                 | Avec aménagement : WC depuis la porte                                 |
| captures/20-telephone-dessus-amenagement.png   | Téléphone (390 × 844) : vue de dessus avec aménagement                |
| captures/21-telephone-visite.png               | Téléphone : visite avec joystick                                      |

- Aucune erreur JavaScript dans la page.

## Bilan

3 point(s) non conforme(s) ou à confirmer — détail ci-dessus.
