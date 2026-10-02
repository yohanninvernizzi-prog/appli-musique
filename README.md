# Appli Musique

Lecteur de musique **autonome** (type Spotify, mais avec vos propres fichiers) pour Android, pensé pour tablette.
Playlists, lecture aléatoire / linéaire / boucle, et **annonces récurrentes** (ex. « tel audio toutes les 15 ou 30 min ») :
la musique s'éteint avec un fondu, l'annonce passe, puis la musique reprend automatiquement.

## État : V1 (prototype fonctionnel)

| Fonction | Statut |
|---|---|
| Import de fichiers audio (MP3, M4A, WAV, FLAC, OGG…) copiés dans le stockage de l'app | fait |
| Bibliothèque (musiques / annonces), suppression | fait |
| Playlists (création, ordre, modes) | fait |
| Lecteur : lecture, pause, précédent, suivant, ±15 s, barre de progression | fait |
| Modes : linéaire, aléatoire, sans boucle, boucle playlist, boucle titre | fait + testé |
| Annonces récurrentes calées sur l'horloge, plages horaires, jours, fondu, volume | fait + testé |
| Fondu sortant → annonce → reprise avec fondu entrant | fait, **à valider sur appareil** |
| Mode radio (diffusion continue, maintien de session audio) | fait, **à valider sur appareil** |
| Tags ID3 et pochettes | à faire (le titre vient du nom de fichier) |
| Compte, synchro multi-appareils, catalogue libre de droit, relais manuel | prévus (V1.5 à V2.5) |

## Lancer le projet

Prérequis : Node.js 20+, un téléphone ou une tablette Android.

```bash
npm install
npm test            # tests unitaires (file d'attente, planificateur, fondus)
npm run typecheck
```

Le lecteur utilise des modules natifs : Expo Go ne suffit pas pour tester la lecture en arrière-plan.
Il faut une vraie application installée. Deux options :

**Option A — APK dans le cloud (le plus simple, sans Android Studio)**

```bash
npx eas-cli login                                   # compte Expo gratuit
npx eas-cli build --profile preview --platform android
```

Le build donne un lien de téléchargement d'un APK : ouvrez-le sur la tablette et installez
(autorisez « installer des applications inconnues »). Le même APK s'installe sur le téléphone
et sur les autres tablettes.

**Option B — build local (tablette en USB, débogage USB activé, Android Studio installé)**

```bash
npx expo prebuild --platform android
npx expo run:android
```

## Prototype de risque — à faire en premier sur la tablette

1. Importer 2-3 musiques (onglet *Bibliothèque*) et 1 audio court en tant qu'**annonce**.
2. Onglet *Annonces* → « Nouvelle règle » → 15 min, fondu 2 s → Enregistrer. « Tester maintenant » doit : fondu, annonce, reprise.
3. Onglet *Mode radio* → choisir la source → activer. Verrouiller l'écran et laisser tourner 1 h.
4. Relire le **journal** du mode radio : chaque annonce doit y apparaître au bon créneau (:00, :15, :30, :45).
5. Si une annonce manque écran éteint : *Mode radio* → « Ouvrir les réglages batterie » et autoriser l'app à ignorer l'optimisation.

Points à vérifier (non testables sans appareil) :
- la reprise de la musique après l'annonce quand les deux lecteurs demandent le focus audio (`interruptionMode: 'doNotMix'`) ;
- la survie des timers JavaScript écran éteint (service de premier plan d'`expo-audio`) ;
- le maintien de la session audio par la piste silencieuse quand la musique est en pause.

Si les timers JS ne tiennent pas, la suite prévue est une alarme exacte native (`SCHEDULE_EXACT_ALARM`).

## Architecture

```
src/
  app/        écrans (expo-router) : Bibliothèque, Playlists, Lecteur, Annonces, Mode radio
  core/       logique pure, sans dépendance native, testée : file d'attente, planificateur, fondus
  audio/      moteur de lecture (expo-audio) : musique + annonces + mode radio
  db/         SQLite : migrations versionnées + accès aux données
  sources/    sources musicales interchangeables (MusicSource) : fichiers locaux aujourd'hui
  ui/         thème et composants
```

Trois fondations pour faire évoluer l'application sans la réécrire :

1. **Sources interchangeables** (`src/sources/MusicSource.ts`) : le lecteur ne sait pas d'où vient un titre.
   Un futur catalogue cloud ou un service tiers sera un module de plus.
2. **Données synchronisables** : chaque ligne a un UUID, `updated_at` et `deleted_at` (suppression logique),
   et les migrations sont versionnées (`PRAGMA user_version`). Plusieurs appareils pourront fusionner leurs données.
3. **Annonces calées sur l'horloge** : deux appareils produisent le même planning, ce qui rend un relais transparent.

## Feuille de route

- **V1.5** compte + synchro des playlists, règles et réglages vers un 2e appareil (tablette/téléphone).
- **V2** catalogue libre de droit (stockage Cloudflare R2, ~6 Go pour 1000 titres en 192 kbps), outil d'import
  (conversion, normalisation du volume, licences), écran Catalogue, page de crédits.
- **V2.5** signal de vie + écran *Relais* manuel (prendre / rendre la main), alerte de batterie faible.
- **V3** sources supplémentaires, statistiques de diffusion.

Les licences des titres (CC BY, NC, domaine public…) seront stockées par titre ; usage privé uniquement.
