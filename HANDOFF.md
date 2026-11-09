# Appli Musique — document de passation

Ce document résume le projet pour une personne ou une IA qui reprend le travail. Il décrit le but, ce qui est
fait, ce qui n'est **pas** vérifié, les décisions prises et la suite prévue. Date de rédaction : 9 nov. 2026.
Le `README.md` explique comment lancer et tester ; ce document-ci explique le pourquoi et l'état réel.

## 1. Le projet en deux phrases

Un lecteur de musique **autonome** pour Android (type Spotify, mais avec les propres fichiers audio de l'utilisateur,
sans aucun service tiers), pensé pour **tablette** et aussi installable sur téléphone. Fonctions clés : playlists,
lecture linéaire / aléatoire / boucle, et **annonces récurrentes** (ex. un audio toutes les 15 ou 30 minutes) pendant
lesquelles la musique s'éteint avec un fondu puis reprend toute seule.

Historique : l'idée de départ était de piloter Spotify. Elle a été abandonnée (Spotify n'expose pas le flux audio, interdit
l'usage commercial, et ne permet pas de mixer ni de planifier des annonces). Il n'y a **aucune intégration Spotify**.

## 2. L'utilisateur et le contexte

- Utilisateur **débutant**, francophone : tout doit être expliqué pas à pas, en français.
- **Il n'a pas d'ordinateur utilisable** pour installer des outils : il travaille depuis un téléphone. Toute procédure
  doit donc passer par le navigateur du téléphone (voir §6, builds par GitHub Actions).
- Usage **strictement privé** (pas de diffusion publique ni commerciale).
- Matériel : plusieurs tablettes Android et un téléphone ; modèle de tablette **inconnu** (non demandé, non bloquant).
- Dépôt : `yohanninvernizzi-prog/appli-musique` (public). Branche de travail et branche par défaut :
  `claude/spotify-music-app-45eqls`.

## 3. Décisions prises (à respecter sauf demande contraire)

| Sujet | Décision |
|---|---|
| Plateforme | Android uniquement, optimisé tablette (iOS non construit) |
| Source audio | Fichiers locaux de l'utilisateur ; plus tard catalogue libre de droit |
| Annonce récurrente | La musique fait un **fondu sortant**, se met en pause, l'annonce joue, la musique **reprend automatiquement** avec un fondu entrant |
| Créneaux | Calés sur l'horloge (:00, :15, :30, :45), pas sur l'heure de lancement, pour qu'un second appareil produise le même planning |
| Mode radio | Diffusion continue écran éteint (piste silencieuse de maintien, service de premier plan d'`expo-audio`) |
| Relais entre appareils | **Manuel** (bouton « Prendre le relais »), pas automatique |
| Taille du catalogue visé | ~1000 titres, plafond conseillé 1500, en AAC/MP3 192 kbps (~6 Go) |
| Cloud futur | Supabase (comptes, playlists, règles) + Cloudflare R2 (fichiers audio) — **à vérifier côté tarifs** au moment du choix |
| Licences | Stockées par titre ; usage privé donc licences « NC » acceptables, attribution quand exigée |
| Tags ID3 et pochettes | Jugés **non urgents** par l'utilisateur : volontairement non faits |

## 4. Ce qui est fait (V1)

Pile : Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6, expo-router, expo-audio, expo-sqlite,
expo-file-system, expo-document-picker, vitest.

**Écrans** (`src/app/`) : Bibliothèque (import, classement musique/annonce, suppression), Playlists (création, ordre,
modes, affichage à deux volets en mode large), Lecteur (lecture/pause/précédent/suivant, ±15 s, barre de progression
cliquable, modes), Annonces (règles : intervalle, plage horaire, jours, fondu, volume, « Tester maintenant »),
Mode radio (activation, source, prochaine annonce, journal, raccourci réglages batterie, écran allumé).

**Code** (`src/`) :

```
app/        écrans (expo-router)
core/       logique pure, SANS dépendance native, testée : queue.ts (file d'attente), schedule.ts (créneaux + planificateur),
            fade.ts (fondus), wav.ts (WAV de silence), types.ts
audio/      engine.ts : le moteur (singleton) — un lecteur « musique », un lecteur « annonce », un lecteur de maintien
db/         database.ts (ouverture + migrations via PRAGMA user_version), migrations.ts (SQL v1), repo.ts (accès aux données)
sources/    MusicSource.ts (interface), LocalFilesSource.ts (import), registry.ts
ui/         thème, composants, hooks (useEngine via useSyncExternalStore, useLoad)
```

**Fondations d'évolutivité déjà posées** : (1) sources musicales interchangeables via l'interface `MusicSource` ;
(2) toutes les lignes ont un UUID, `updated_at` et `deleted_at` (suppression logique) pour permettre une synchro
multi-appareils ; (3) annonces calées sur l'horloge ; migrations SQL versionnées.

**Tests** : 30 tests vitest sur `src/core/` (file d'attente, planificateur, fondus, WAV). `npm test`, `npm run typecheck`.
Il n'y a **aucun test** sur le moteur audio, la base de données ni l'interface.

## 5. Ce qui N'EST PAS vérifié ou connu comme limité

Honnêteté d'abord : l'app a été **écrite sans jamais être exécutée par l'auteur du code** (l'environnement de
développement n'a pas d'appareil Android). L'utilisateur l'a installée sur sa tablette et a réagi positivement, mais
**aucun résultat de test détaillé n'a été rapporté**. À valider en priorité :

1. La musique reprend-elle après l'annonce, avec les deux lecteurs en `interruptionMode: 'doNotMix'` ? (conflit de
   focus audio possible sur Android)
2. Les annonces partent-elles à l'heure **écran éteint pendant une heure** ? Le planificateur repose sur des timers
   JavaScript ; s'ils ne tiennent pas, la suite prévue est une alarme exacte native (`SCHEDULE_EXACT_ALARM`).
3. La piste silencieuse maintient-elle la session audio quand la musique est en pause ?
4. Le fondu est-il agréable (durée, courbe linéaire) ?

**Limites connues du code** :
- Les titres viennent du **nom de fichier** ; artiste/album/durée vides (pas de lecture des tags ; durée connue après la 1re lecture).
- Pas de synchro, de compte, de catalogue, de relais : tout est local à chaque appareil.
- Pas de démarrage automatique au redémarrage de la tablette, pas de restauration de la file/du mode radio après fermeture de l'app.
- Modifier une playlist ou supprimer un titre **pendant la lecture** ne met pas à jour la file en cours.
- Pas de réglage de volume général dans l'app, pas de recherche/tri dans la bibliothèque.
- `onMusicStatus` dans `engine.ts` ignore les mises à jour pendant une annonce ; la logique `pendingAdvance` (le titre se
  termine pendant l'annonce) est écrite mais non testée.
- Le lint (`expo lint`) n'a jamais pu tourner (pas de configuration ESLint, réseau bloqué dans l'environnement de dev).
- L'APK est signé avec la **clé de débogage** (installable partout, mais pas publiable sur le Play Store).
- Le build iOS n'existe pas.

## 6. Construire et distribuer l'app (sans ordinateur)

Un workflow GitHub Actions (`.github/workflows/build-apk.yml`) construit l'APK à la demande :

1. Navigateur du téléphone → dépôt → **Actions** → « Construire l'APK Android » → **Run workflow** → branche `claude/spotify-music-app-45eqls`.
2. Durée 8 à 30 minutes. Le workflow lance `npm ci`, `tsc`, les tests, `expo prebuild`, puis `./gradlew assembleRelease`.
3. L'APK est publié dans **Releases** (pré-version `apk-N`). Dernier build réussi : **`apk-5`** (commit `19aa60c`).
   Lien direct : `https://github.com/yohanninvernizzi-prog/appli-musique/releases/download/apk-5/appli-musique.apk`

Pièges déjà rencontrés (ne pas les reproduire) :
- Le `package-lock.json` a été généré avec `--legacy-peer-deps` ; le fichier **`.npmrc` (`legacy-peer-deps=true`)** est donc
  indispensable pour que `npm ci` fonctionne.
- Le fichier `android/gradle.properties` généré **ne finit pas par un retour à la ligne** : toute ligne ajoutée doit être
  précédée d'un `\n`, sinon elle se colle à `expo.inlineModules.watchedDirectories=[]` et casse l'autolinking Expo.
- Les journaux d'Actions se lisent avec les outils GitHub du dépôt (le build échoue parfois sans message clair ; le
  workflow contient un pas de **diagnostic** exécuté en cas d'échec).

Autre option documentée dans le README : `eas build --profile preview` (compte Expo `aqua2lacs` créé, jamais utilisé).

## 7. Particularités d'environnement pour qui développe

- `AGENTS.md` demande de lire la doc Expo versionnée avant d'écrire du code Expo. Dans l'environnement de développement
  utilisé, `docs.expo.dev` était **bloqué** : l'API a été lue directement dans les types de `node_modules`
  (`expo-audio/build/*.d.ts`, `expo-file-system/build/*.d.ts`). Les API Expo SDK 57 diffèrent de ce que l'on connaît
  (ex. `File`/`Directory` de `expo-file-system`, `createAudioPlayer`, `setActiveForLockScreen`).
- `npx expo install` ne marche pas hors réseau : les paquets ont été installés avec `npm install <paquet>@sdk-57`.
- Pour tester le bundling sans appareil : `npx expo export --platform android`.

## 8. Feuille de route prévue

| Version | Contenu |
|---|---|
| **Maintenant** | Valider sur tablette les points du §5, corriger ce qui casse |
| **V1.5** | Compte (Supabase), synchro des playlists, règles et réglages vers d'autres appareils, téléchargement des audios |
| **V2** | Catalogue libre de droit sur Cloudflare R2 ; outil d'import (conversion 192 kbps, **normalisation du volume** avec ffmpeg, licences) ; écran Catalogue ; page de crédits. Sources candidates : Jamendo, Free Music Archive, Incompetech, Musopen/Internet Archive, ccMixter (conditions et API **à relire** avant intégration) |
| **V2.5** | Signal de vie, écran Relais manuel (prendre/rendre la main), alerte de batterie faible, notification push optionnelle (FCM) |
| **V3** | Sources supplémentaires, statistiques de diffusion |

Idées demandées ou évoquées, non réalisées :
- **Playlists cohérentes en rythme et sonorité.** L'app ne connaît ni le tempo ni l'énergie des titres. Deux pistes :
  regrouper à la main à partir de la liste des titres (l'app n'a pas de fonction d'export de liste), ou analyser l'audio
  (tempo, énergie, tonalité) dans l'outil d'import de la V2 puis générer les playlists. Aucune des deux n'est codée.
- Lecture des tags ID3 et des pochettes (non prioritaire).

## 9. Conseils pour la suite

- Avant d'ajouter des fonctions, faire tourner le **test d'une heure** (README) et récupérer le **journal du mode radio**.
- Garder la logique dans `src/core/` (pure, testable) et y ajouter des tests ; extraire du moteur ce qui peut l'être.
- Parler français, expliquer simplement, et proposer des étapes réalisables **depuis un téléphone**.
- Ne rien promettre sur le comportement de l'app en arrière-plan Android sans l'avoir vérifié sur l'appareil.
