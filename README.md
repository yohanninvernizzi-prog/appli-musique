# Appli Musique — la radio d'Aqua2Lacs

Radio d'ambiance pour tablette Android : elle lit vos musiques en ordre aléatoire, passe vos **publicités audio à
intervalle régulier**, et démarre et s'arrête **toute seule selon les horaires d'ouverture** du centre.

## État : V2, à valider sur la tablette

| Fonction | Statut |
|---|---|
| Import de musiques et de publicités (MP3, M4A, WAV, FLAC, OGG…) | fait |
| Lecture aléatoire en boucle de toute la musique ou d'une playlist | fait |
| Horaires d'ouverture par jour, plusieurs plages possibles | fait + logique testée |
| Publicités à tour de rôle, intervalle au choix, fondu et volume réglables | fait + logique testée |
| Démarrage et arrêt automatiques aux horaires | fait, **à valider sur appareil** |
| Diffusion écran éteint | **non vérifiée** : gardez l'écran allumé pour l'instant |
| Journal conservé et partageable (retard de chaque publicité) | fait |
| Démarrage automatique au redémarrage de la tablette | à faire (il faut ouvrir l'app) |

## Installer l'application depuis un téléphone (GitHub construit l'APK)

1. Dans le navigateur, ouvrez le dépôt GitHub (activez « Version pour ordinateur » dans le menu du navigateur).
2. Onglet **Actions** → **Construire l'APK Android** → **Run workflow** → choisissez la branche → **Run workflow**.
3. Attendez 15 à 30 minutes (pastille verte = terminé).
4. Onglet **Releases** → dernière version « APK n°… » → téléchargez `appli-musique.apk`.
5. Ouvrez le fichier sur la tablette et installez-le (autorisez « installer des applications inconnues »).

Les builds suivants s'installent par-dessus le précédent : vos musiques et réglages sont conservés.

## Première mise en route

1. **Musique** → « Importer » : choisissez vos fichiers (plusieurs à la fois).
2. **Publicités** → « Ajouter une publicité », puis choisissez l'intervalle (par exemple 15 min).
3. **Horaires** → pour chaque jour, « Ajouter une plage ». « Copier vers… » recopie un jour sur un autre.
4. **Radio** → activez « Diffusion automatique ». Laissez l'application ouverte et la tablette branchée.

Pour essayer sans attendre l'heure d'ouverture : **Radio** → « Diffuser maintenant », puis dans **Publicités** touchez
le bouton d'écoute d'une publicité : la musique doit baisser, la publicité passer, puis la musique reprendre.

## Test à faire sur la tablette

1. Créez une plage qui commence dans quelques minutes et se termine 40 minutes plus tard, intervalle 5 min.
2. Vérifiez écran allumé : démarrage à l'heure, publicités toutes les 5 min à tour de rôle, arrêt à l'heure.
3. Refaites le test **écran éteint**. Ensuite : **Radio** → « Journal et diagnostic » → « Partager ».
   Chaque publicité y figure avec son retard ; une ligne « Application suspendue » indique qu'Android a endormi l'app.
4. En cas de retards : « Réglages de batterie » → autorisez l'application à ignorer l'optimisation, puis recommencez.

## Droits musicaux

Diffuser de la musique dans un lieu ouvert au public demande une autorisation (SACEM/SPRE en France) ou des musiques
dont la licence autorise l'usage commercial. Les licences « non commercial » (NC) ne suffisent pas.

## Pour les développeurs

```bash
npm ci
npm test            # tests de la logique (horaires, publicités, file d'attente, fondus)
npm run typecheck
npm run lint
```

```
src/
  app/        écrans : Radio, Horaires, Musique, Publicités, Diagnostic
  core/       logique pure et testée : program.ts (horaires, créneaux, rotation), queue.ts, fade.ts
  audio/      moteur de lecture (expo-audio)
  db/         SQLite : migrations versionnées + accès aux données
  sources/    sources musicales interchangeables : fichiers locaux aujourd'hui
  ui/         thème et composants
```

L'état réel du projet, les décisions et ce qui n'est pas vérifié sont dans [HANDOFF.md](HANDOFF.md).
