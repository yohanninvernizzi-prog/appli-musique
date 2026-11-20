# Hypothèses et points à confirmer — maquette T3 lot 16

Toutes les cotes du cahier des charges sont reprises **telles quelles** dans l'objet `GEO` en tête de `index.html`
(le script `qc/qc.cjs` le vérifie mur par mur et ouverture par ouverture). Rien n'a été déplacé, élargi ni harmonisé.
Ce fichier liste (1) les écarts relevés entre les données fournies, qui demandent une réponse, et
(2) les valeurs standard prises là où aucune cote n'était donnée.

## 1. Écarts relevés à confirmer (non corrigés dans la maquette)

| # | Sujet | Constat | Question |
|---|-------|---------|----------|
| 1 | **Surface du placard** | Rectangle fourni x 119→186, y 0→167 = 67 × 167 = **1,12 m²** ; surface officielle 1,29 m² (écart **−13,3 %**, hors tolérance). | 1,29 m² correspond à 67 × 192, c'est-à-dire le placard plus la zone de la chaudière (y 167→192). Le placard va-t-il jusqu'à y = 192, ou la surface officielle inclut-elle la chaudière ? |
| 2 | **Surface du WC** | Rectangle fourni x 649→788, y 392→577 = 139 × 185 = **2,57 m²** ; surface officielle 2,23 m² (écart **+15,3 %**, hors tolérance). | 2,23 m² correspondrait par exemple à 120,5 × 185 ou à 139 × 160. Laquelle des cotes est juste ? |
| 3 | **Trou de 5 cm dans le mur haut du WC** | Le mur haut du WC s'arrête à x 701 (porte) ; la porte va de 701 à 783 ; le mur chambre 2 / WC commence à x 788. Entre x 783 et 788 (y 385→392), il n'y a ni mur ni porte. Le contrôle par rayons le signale (`porte-wc : tableauApresFin`). | Trumeau de 5 cm à ajouter, ou porte plus large (87 cm) ? Laissé ouvert, faute de cote. |
| 4 | **Largeur du bloc salle d'eau** | Avec les murs fournis : 494 → 706 = **212 cm** (7 + 190 intérieur + 15 de mur double). Le PDF annonce « 204 bloc SdE ». La chambre 1 fait alors 404 cm (PDF : 402). | Le mur double SdE / chambre 1 fait-il bien 15 cm ? |
| 5 | **Conflit de débattement porte WC / porte chambre 2** | Ouverte à 90°, la porte du WC (gonds à x 783, ouverture vers le dégagement) se range le long de x 779→783, de y 303 à 385, soit à 5 cm devant la baie de la porte de la chambre 2 (x 788, y 287→375). | Les deux portes ne peuvent pas être ouvertes en même temps sans se gêner. Sens d'ouverture ou position de gond à revoir ? |
| 6 | Écarts de 1 à 2 cm entre équipements | Chaudière y 167→192 puis GTL y 193→219 (1 cm) ; cuvette WC y 505→550 puis bâti y 552→577 (2 cm). | Sans conséquence, conservé tel quel. |
| 7 | Façade droite | Le PDF signale une façade droite « légèrement de biais (environ 9 cm) ». Le cahier des charges la donne en rectangles d'équerre. | Modélisée d'équerre, comme demandé. |
| 8 | Total | Surface habitable recalculée 61,99 m² contre 62,37 m² (somme des surfaces officielles), soit −0,6 %. | Pour information. |

Les recouvrements entre rectangles de murs (5 jonctions d'angle de 7 × 7 à 15 × 7 cm, dont le raccord qui
recouvre le mur bas de la chambre 1) découlent directement des cotes fournies. Les deux murs sont dans le même
matériau, donc cela ne se voit pas. Le détail figure dans `qc/RAPPORT-QC.md`.

## 2. Valeurs standard retenues (aucune cote fournie)

Modifiables dans `GEO.meta` (en tête de `index.html`), sauf mention contraire.

| Élément | Valeur retenue | Où |
|---------|----------------|----|
| Vantail des portes intérieures | largeur = largeur de passage, hauteur = hauteur de passage (204, entrée 215), épaisseur 4 (fournie), jeu au sol 1 cm | `meta.porte` |
| Huisserie (bâti de porte) | non dessinée : le passage reste au nu des cloisons | — |
| Poignées | béquille noire, axe à 105 cm de haut et à 6 cm du chant libre, des deux côtés | `meta.porte` |
| Dormant des menuiseries extérieures | 7 cm de profondeur, posé au nu intérieur ; profilés 6 cm (dormant) et 5 cm (ouvrants) | `meta.menuiserie` |
| Baie du séjour | 2 vantaux coulissants fermés, sur 2 rails, recouvrement 6 cm, seuil de 2 cm | `meta.menuiserie` |
| Fenêtres (100 cm) | 2 vantaux à la française, fermés, crémone noire à mi-hauteur (le nombre de vantaux n'est pas précisé) | code `buildWindow` |
| Seuils (porte d'entrée, baie) | pierre grise affleurant le sol fini (0) | code « Sols, seuils » |
| Plinthes | 7 cm × 1,5 cm, blanches, sur toutes les faces de murs donnant sur l'intérieur, y compris en salle d'eau et WC ; interrompues aux portes | `meta.plinthe` |
| Parquet | chêne clair, lames de 20 cm de large et 120 à 220 cm de long, posées dans l'axe séjour → baie (perpendiculaires à la façade terrasse), y compris en salle d'eau et WC (revêtement non précisé) | `meta.parquet` |
| Plafond | blanc, plat ; rendu comme une dalle de 12 cm *au-dessus* de 250 (purement graphique, la hauteur sous plafond reste 250) | `meta.plafondEpaisseurGraphique` |
| Terrasse | dalle bois de 2 cm posée sur un terrain au niveau du sol fini intérieur (dessus à +2 cm) | `rooms` → terrasse |
| Plan de travail | 4 cm d'épaisseur (86 → 90) ; meubles bas pleins de 0 à 86, sans socle ; plaque et cuve d'évier figurées pour la lecture (en retrait de 15 et 18 cm) | `meta.cuisine`, `fixtures` |
| Lave-vaisselle | sous le plan de travail, comme les autres modules bas (0 → 90) | `fixtures` |
| Receveur de douche extra-plat | 3 cm | `fixtures` → douche |
| Lavabo | vasque de 70 à 85 cm (dessus à 85, comme indiqué) | `fixtures` → lavabo |
| Cuvette WC suspendue | de 25 à 40 cm (assise à environ 40 cm) | `fixtures` → wc-cuvette |
| Gaine du WC | hauteur non fournie : du sol au plafond, comme la gaine de la salle d'eau | `fixtures` → wc-gaine |
| Lumière | soleil du matin venant de l'est (azimut ≈ 105°, élévation ≈ 30°), entrant par la baie ; ciel clair ; lumière d'appoint sans ombre côté ouest ; ombres très atténuées en vue de dessus | code « Lumières » |
| Coupe des murs | à 120 cm, parties coupées en gris anthracite (murs, gaines, GTL, frigo, ballon) | `meta.coupe` |
| Visite | œil à 160 cm (fourni), corps de 20 cm de rayon ; collisions avec les murs, allèges, baie et fenêtres fermées, porte d'entrée (on ne sort pas), équipements si le calque est actif. **Les vantaux ouverts ne bloquent pas** : sinon la chambre 2 serait inaccessible (voir écart n° 5). | `meta.rayonCorpsVisite` |
| Points de vue | « Entrée → baie » pris au fond de l'entrée (55, 210) : plus près de la porte, le bloc placard masque la baie. « Chambre 1 » pris en (800, 250), au-delà du vantail ouvert de la porte, qui sinon bouche la vue. | `GEO.vues` |
| Surface du séjour | polygone : emprise 642 × 577, moins l'entrée (119 × 218), le bloc placard (x 119→193, y 0→226) et la partie du bloc salle d'eau dans l'emprise (x 494→642, y 0→285), plus le dégagement (x 642→788, y 285→385). Résultat : 30,02 m² pour 30,11 m² officiels. | `rooms` → sejour |
| Nord | 60° à droite du haut du plan (fourni) ; boussole en bas à droite | `meta.nordDegres` |

---

# Étape 2 : aménagement et décoration

Les murs, portes et fenêtres de l'objet `GEO` sont inchangés (le script `qc/qc.cjs` le revérifie).
Les meubles sont dans le tableau `furniture`, en tête de `index.html` (x, y, largeur, profondeur, hauteur,
rotation, matériau). Les passages à mesurer sont dans `passages` et la zone à garder libre devant la baie dans `zonesLibres`.

## 4. Ajustements effectués (positions demandées modifiées)

| Meuble | Demandé | Retenu | Raison |
|--------|---------|--------|--------|
| Lit chambre 2 | x 882 → 1022 | **x 886 → 1026** (+4 cm) | La porte de la chambre 2 (gonds à y 287, ouverture vers la chambre) ouverte à 90° place son vantail sur x 796 → 884, y 287 → 291 : il entrait de 2 cm dans l'angle du lit, et le débattement (rayon 88 cm) coupait cet angle. Avec +4 cm, il reste 2 cm de jeu. Conséquence : le passage entre le lit et l'armoire passe de 28 à 24 cm. |
| Tapis 200 × 280 | « centré sous le salon » | **x 75 → 275, y 296 → 576** | Centré entre le meuble TV (x 40) et le dos du canapé (x 310), soit x = 175. Centré sur le canapé (y = 440), il aurait occupé y 300 → 580 et serait entré de 3 cm dans la façade (y 577). Il est remonté de 4 cm (1 cm de jeu). |

Aucun autre meuble n'a été déplacé ni redimensionné.

## 5. Interprétations et valeurs retenues (non précisées dans la demande)

| Élément | Valeur retenue |
|---------|----------------|
| Îlot 200 × 90 × 90 | Les 90 cm de profondeur comprennent le débord : caisson de 65 cm (y 173 → 238) et plateau en chêne de 4 cm (86 → 90) qui déborde de 25 cm côté séjour (y 238 → 263). Si le plateau débordait au-delà de y 263, les tabourets centrés à y 285 seraient dessous. Tiroirs côté cuisine, socle en retrait. |
| Tabourets | Assise ronde Ø 40 en chêne, dessus à 65 cm, 4 pieds légèrement écartés, repose-pieds à 25 cm. |
| Suspensions de l'îlot | Ø 35, bas à 175 cm, centrées à x 344 et x 444 (100 cm d'écart), y 218 (milieu du plateau). |
| Suspension de la table | Ø 60, bas à 150 cm (75 cm au-dessus du plateau). |
| Crédence | Zellige 10 × 10 cm, de la colonne frigo au mur de la salle d'eau (x 254 → 494), de 90 à 150 cm, 1,5 cm d'épaisseur. |
| Étagère | Chêne de 4 cm, 25 cm de profondeur, x 254 → 494, posée à 150 cm sur 3 équerres noires. |
| Modules de cuisine | Socle en retrait de 10 cm, façades sauge #9CAF94 (la teinte de l'étape 1 était #9DAE93), poignées barres noires de 22 cm. Plaque induction 77 × 52 à 4 foyers, cuve sous plan 70 × 40 en granit noir, robinet noir à bec haut. Colonne frigo à 2 portes (congélateur en bas). |
| Meuble TV et écran | Meuble à 3 portes sur pieds de 12 cm ; écran 55 pouces = 122 × 69 cm, sur pied central, bas de l'écran à 58 cm. |
| Canapé | Accoudoirs de 20 cm, assise à 52 cm, dossier à 80 cm. Coussins 45 × 45 cm (2 terracotta, 1 ocre), plaid ocre plié sur l'assise côté baie. |
| Table basse | Plateau en travertin Ø 80 × 5 cm sur fût en travertin Ø 48 cm. |
| Chaises | 46 × 50 cm, assise à 45 cm en corde tressée, dossier à 80 cm. Posées en croix (nord, sud, est, ouest) à 63 cm du centre de la table, rentrées de 17 cm sous le plateau. La chaise ouest (x 433 → 483) reste hors de la zone libre devant la baie. |
| Zone libre devant la baie | x 367 → 445 (partie gauche demandée), profondeur 90 cm (y 487 → 577), hauteur 215 cm. Au-dessus, la tringle des voilages est autorisée. |
| Olivier | Pot en terre cuite Ø 44 × 40 cm, hauteur totale 170 cm, feuillage Ø 70 cm centré en (40, 540). |
| Voilages | Panneaux de 44 cm repliés de chaque côté de la baie, hors du clair de passage (x 322 → 366 et x 566 → 610), de 1 à 239 cm de haut. Tringle noire à 240 cm, de x 316 à x 616. |
| Lits | Tête de lit en chêne de 6 cm comprise dans l'emprise demandée (200 ou 190 cm), hauteur 110 cm. Matelas dessus à 50 cm, couette en lin blanc, jeté et coussin terracotta. |
| Chevets et lampes | Chevets 45 × 40 × 50 cm de part et d'autre du lit, contre le mur du couloir (x 775 → 820 et x 980 → 1025). Lampes à pied en céramique avec abat-jour en lin, Ø 25 × 42 cm. |
| Armoires | Blanches, 3 portes, socle de 6 cm, poignées noires verticales de 40 cm. |
| Chaise de bureau | Même modèle que les chaises du séjour, rentrée de 15 cm sous le bureau (x 920 → 966, y 482 → 532). |
| Paroi de douche | Verre fixe de 100 × 200 cm le long du bord du receveur (y 85), du mur gauche (x 501) à x 601, profilés et barre de stabilisation noirs. On entre par la droite. |
| Robinetterie de douche | Mitigeur noir à 100 cm, colonne, bras de 30 cm et pommeau de pluie Ø 30 cm à 210 cm. |
| Zellige de la douche | Carreaux 10 × 10 cm jusqu'à 210 cm, sur le mur du fond (x 501 → 639), le mur gauche et les 3 faces de la gaine. |
| Lavabo | Meuble suspendu en chêne de 52 à 72 cm, vasque blanche à poser (dessus à 85 cm), robinet mural noir, miroir rond Ø 50 cm à cadre noir, centré à 150 cm. |
| Lave-linge | Hublot sur la face x 559, tournée vers la pièce : avec les cotes fournies (35 × 60), la façade fait 60 cm de large et l'appareil 35 cm de profondeur. |
| Placard du ballon | Coffrage blanc de 0 à 170 cm. Ses portes sont au-dessus du lave-linge (88 → 170), seul côté accessible : le lave-linge est devant et le lavabo sur le côté. |
| WC | Cuvette suspendue blanche, bâti habillé en blanc avec plaque de commande noire. Lave-mains 40 × 22 cm (dessus à 85 cm) sur le mur droit (x 766 → 788, y 470 → 510), robinet noir. La porte du WC s'ouvre vers le dégagement, donc la place intérieure est libre. |
| Équipements fixes | Avec le calque Aménagement, les modules de cuisine, le lavabo, le lave-linge, le ballon, la cuvette et le bâti sont remplacés par leur version habillée. Chaudière, GTL, gaines et receveur restent affichés. |
| Visite | Les meubles bloquent le déplacement, sauf le tapis et les suspensions. Les vantaux ouverts ne bloquent toujours pas. |
| Calcul des passages | Plus grand disque pouvant circuler d'une zone à l'autre (grille de 2 cm), avec la largeur réelle mesurée au point le plus étroit. Les portes sont supposées fermées : un vantail ouvert se rabat. Leurs débattements sont contrôlés à part, aucun meuble ne doit s'y trouver. |

## 6. Points signalés, non corrigés (positions demandées conservées)

### Passages de moins de 80 cm

| Passage | Largeur | Cause |
|---------|---------|-------|
| Entrée → dégagement, et entrée → baie | **34 cm** | Entre le tabouret 1 (centre 340, 285) et l'angle arrière du canapé (310, 330). Il n'y a pas d'autre chemin : il reste 27 cm entre le bout du canapé et la façade, et le côté salon est fermé par le meuble TV et la table basse. |
| Chambre 1 : pied du lit ↔ armoire | **18 cm** | 278 cm de profondeur − 200 (lit) − 60 (armoire) = 18 cm. Le côté droit du lit n'est accessible que par là. Les portes de l'armoire (60 cm de débattement environ) ne peuvent pas s'ouvrir. |
| Chambre 2 : côté droit du lit ↔ armoire | **24 cm** | 314 cm de largeur − 90 (passage de porte) − 140 (lit) − 60 (armoire). |
| Chambre 2 : pied du lit ↔ chaise de bureau | **5 cm** (40 cm jusqu'au bureau) | 292 − 190 (lit) − 60 (bureau) − 2 = 40 cm, et la chaise occupe cet espace. |

Variantes testées dans la maquette pour le séjour (passages calculés par la même méthode) :

| Variante | Entrée → dégagement | Entrée → baie |
|----------|--------------------|---------------|
| Tel que demandé | 34 | 34 |
| Sans le tabouret 1 | 57 (tabouret 3 ↔ chaise nord) | 67 (canapé ↔ îlot) |
| 3 tabourets rentrés sous le débord (y 238 → 278) | 58 | 58 |
| 2 tabourets rentrés (x 400 et 460) | 67 | 67 (canapé ↔ îlot) |
| Canapé de 200 cm (y 350 → 550) | 52 | 52 |
| 2 tabourets rentrés + canapé de 200 cm | 67 (chaise nord ↔ mur de la salle d'eau) | **87** |

Même sans tabouret, il reste 67 cm entre l'îlot (y 263) et le canapé (y 330). Pour dépasser 80 cm vers le
dégagement, il faudrait aussi éloigner la chaise nord de la table (ou tourner les chaises à 45°).

### Autres

- **Armoire de la chambre 1 devant la fenêtre** : l'armoire (x 900 → 1100, y 218 → 278, haute de 220 cm) est à
  10 cm de la façade droite. Elle masque y 218 → 261, soit 43 cm sur les 100 cm de la fenêtre. Elle empiète aussi de
  34 cm sur le débattement des vantaux, si ceux-ci s'ouvrent à la française vers l'intérieur (hypothèse de l'étape 1).
- **Porte de la salle d'eau ouverte à 90°** (constat géométrique de l'étape 1) : son vantail (x 677 → 681, y 285 → 364)
  laisse 21 cm jusqu'au mur haut du WC (y 385). Ouverte en grand, elle ferme donc l'accès au dégagement.
- **Bureau sous la fenêtre de la chambre 2** : le plateau est à 75 cm, sous l'allège de 90 cm, donc pas de conflit avec les vantaux.
