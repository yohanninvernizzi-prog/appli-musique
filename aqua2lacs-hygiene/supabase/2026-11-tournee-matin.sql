-- ════════════════════════════════════════════════════════════════════
--  Hygiène Aqua2Lacs — tournée du matin (novembre 2026)
--
--  À coller une seule fois dans Supabase : SQL Editor → New query → Run.
--  Le script peut être relancé sans danger. Il ne touche à aucune fiche.
--
--  Ce qu'il fait :
--   1. ajoute les 12 étapes de la tournée essentielle du matin, dans l'ordre pratiqué ;
--   2. désactive (sans les supprimer) 7 anciennes tâches que la tournée remplace ;
--   3. ajuste 5 tâches existantes (vestiaires scolaires l'après-midi, tour des plages, etc.).
-- ════════════════════════════════════════════════════════════════════

-- 1. Les étapes de la tournée
insert into public.tasks
  (id, name, zone_id, moment_id, description, material, product, duration_min, recurrence, essential, active, draft, sort, created_on)
values
  ('r01', 'Salle de pause : coup de propre', 'perso', 'avant',
   'Rangement rapide, table, évier.', '', '', 10,
   '{"type":"weekdays","days":[1,2,3,4,5]}', true, true, false, -100, current_date),
  ('r02', 'Personnel : poubelles et sanitaires', 'perso', 'avant',
   'Vider les poubelles. WC et lavabo du personnel.', '', 'Désinfectant', 10,
   '{"type":"weekdays","days":[1,2,3,4,5]}', true, true, false, -99, current_date),
  ('r03', 'Accueil : poubelles et sanitaires', 'sanacc', 'avant',
   'Changer les sacs poubelles de l''accueil. WC, miroir et lavabo à la microfibre, brosse à tremper avec du désinfectant, rouleau.',
   'Microfibre', 'Désinfectant', 23, '{"type":"daily"}', true, true, false, -98, current_date),
  ('r04', 'Déchaussage : poubelles et bancs', 'dech', 'avant',
   'Vider les poubelles. Bancs de déchaussage à la microfibre.', 'Microfibre', 'Désinfectant', 13,
   '{"type":"daily"}', true, true, false, -97, current_date),
  ('r05', 'Vestiaires 1 et 2 : poubelles et casiers', 'vest', 'avant',
   'Vider les poubelles. Casiers, bancs et traces sur les cabines.', 'Microfibre', '', 32,
   '{"type":"daily"}', true, true, false, -96, current_date),
  ('r06', 'Vestiaires publics : sanitaires et poubelles', 'san', 'avant',
   'WC et dessous, brosse, dérouleur papier (recharger), lavabos. Brosse à tremper avec du désinfectant. Vider les poubelles.',
   '', 'Désinfectant', 47, '{"type":"daily"}', true, true, false, -95, current_date),
  ('r07', 'Aspirateur : locaux du personnel', 'perso', 'avant',
   'Salle de pause, vestiaires, couloir.', 'Aspirateur', '', 18,
   '{"type":"weekdays","days":[1,2,3,4,5]}', true, true, false, -94, current_date),
  ('r08', 'Aspirateur : accueil et sas', 'acc', 'avant',
   'Hall, banque d''accueil, boutique, les deux sas et les tapis.', 'Aspirateur', '', 25,
   '{"type":"daily"}', true, true, false, -93, current_date),
  ('r09', 'Aspirateur : déchaussage', 'dech', 'avant',
   'Autour des sèche-cheveux, angles, sous les bancs, pédiluve.', 'Aspirateur', '', 8,
   '{"type":"daily"}', true, true, false, -92, current_date),
  ('r10', 'Aspirateur : vestiaires', 'vest', 'avant',
   'Tous les vestiaires publics, bien passer sous les bancs des cabines.', 'Aspirateur', '', 21,
   '{"type":"daily"}', true, true, false, -91, current_date),
  ('r11', 'Aspirateur : sanitaires et douches', 'san', 'avant',
   'Sanitaires et douches publiques, bondes d''évacuation.', 'Aspirateur', '', 17,
   '{"type":"daily"}', true, true, false, -90, current_date),
  ('r12', 'Autolaveuse : de l''accueil aux douches', 'acc', 'avant',
   'Accueil, sanitaire accueil, déchaussage, vestiaires, sanitaires et douches. En fin de passage : machine vidée, rincée et rechargée.',
   'Autolaveuse Nilfisk SC400 (local des scolaires)', '', 53, '{"type":"daily"}', true, true, false, -89, current_date)
on conflict (id) do nothing;

-- 2. Anciennes tâches remplacées par la tournée : désactivées, pas supprimées
update public.tasks set active = false, draft = false
 where id in ('t2', 't3', 't4', 't5', 't7', 't8', 't10');

-- 3. Ajustements
update public.tasks
   set name = 'Accueil & SAS : surfaces de contact',
       description = 'Toiles d''araignée à hauteur d''homme. Poignées et surfaces de contact des deux portes du SAS. Désinfection tripode, comptoir, tables et fauteuils.',
       material = 'Microfibre'
 where id = 't1';

update public.tasks
   set moment_id = 'aprem', essential = true, duration_min = 40,
       recurrence = '{"type":"weekdays","days":[1,2,3,4,5]}',
       description = 'Après 16 h, à la fin du temps scolaire (sinon en cours de matinée). Aspirateur (sous les bancs, bondes). Autolaveuse + brosse aux endroits inaccessibles. Microfibre sur les bancs et parois des cabines, casiers si besoin.'
 where id = 't9';

update public.tasks set essential = false where id = 't11';

update public.tasks set sort = -88, duration_min = 10 where id = 't13';

update public.tasks
   set name = 'Tour des plages à l''autolaveuse',
       description = 'Vider les poubelles et retirer les déchets (pansements, cheveux, objets perdus), puis autolaveuse sur les plages.',
       material = 'Autolaveuse Nilfisk SC650', sort = -87, duration_min = 40
 where id = 't14';
