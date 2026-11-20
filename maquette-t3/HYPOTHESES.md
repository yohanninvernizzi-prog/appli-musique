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
