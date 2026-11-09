# Appli Musique — document de passation

Ce document résume le projet pour une personne ou une IA qui reprend le travail : le but, ce qui est fait, ce qui
n'est **pas** vérifié, les décisions prises et la suite. Dernière mise à jour : 9 nov. 2026 (V2 « radio du centre »).
Le `README.md` explique comment installer et tester ; ce document-ci explique le pourquoi et l'état réel.

## 1. Le projet en deux phrases

Une **radio d'ambiance** pour le centre aquatique Aqua2Lacs, sur tablette Android : elle lit en ordre aléatoire les
musiques chargées sur la tablette et passe des **publicités audio à intervalle régulier**. La diffusion démarre et
s'arrête **toute seule selon les horaires d'ouverture** de la semaine (plusieurs plages possibles par jour).

Historique : l'idée de départ était de piloter Spotify (abandonnée : pas d'accès au flux audio, usage commercial
interdit). La V1 était un lecteur généraliste à 5 onglets avec des « règles d'annonces » ; la V2 l'a recentrée sur
le besoin réel décrit ci-dessus. Il n'y a **aucune intégration Spotify**.

## 2. L'utilisateur et le contexte

- Utilisateur **débutant**, francophone : tout doit être expliqué pas à pas, en français.
- **Pas d'ordinateur** : il travaille depuis son téléphone. Toute procédure passe par le navigateur du téléphone (§6).
- La tablette du centre restera **branchée et posée en permanence** ; l'utilisateur accepte un écran allumé en veille sombre.
- **Diffusion dans un lieu ouvert au public** (ce n'est plus un usage privé) : il faut soit une déclaration SACEM/SPRE,
  soit des musiques dont la licence autorise l'usage commercial. Les licences « NC » ne conviennent pas. L'utilisateur
  en a été informé ; le choix des musiques lui appartient.
- Identité visuelle : logo Aqua2Lacs (Canva, kit de marque « Aqua2Lacs »), bleu marine `#1D317B` sur blanc. Le fichier du
  logo n'a pas pu être téléchargé (hôte Canva bloqué) : l'app affiche le nom en texte.
- Dépôt : `yohanninvernizzi-prog/appli-musique` (public). Branche par défaut : `claude/spotify-music-app-45eqls` (V1).
  La V2 est sur `claude/appli-musique-tablet-validation-12qs5g`.

## 3. Décisions prises (à respecter sauf demande contraire)

| Sujet | Décision |
|---|---|
| Plateforme | Android uniquement, optimisé tablette |
| Source audio | Fichiers locaux importés dans l'app |
| Lecture | Toujours aléatoire et en boucle ; la source est « toute la musique » ou une playlist |
| Horaires | Une liste de plages par jour de la semaine ; la musique **et** les publicités les suivent |
| Fermeture | Arrêt à l'heure de fermeture (fondu de 1,5 s), même au milieu d'un titre ou d'une publicité |
| Publicités | **Un seul intervalle** pour toutes ; elles passent **à tour de rôle** ; chacune peut être mise en pause |
| Créneaux | Calés sur l'horloge (:00, :15, :30, :45) ; pas de publicité à l'instant exact de l'ouverture |
| Publicité | Fondu sortant, pause de la musique, publicité, reprise avec fondu entrant |
| Forçage manuel | « Diffuser maintenant » / « Arrêter la diffusion » ; prend fin au changement d'horaire suivant |
| Écran | « Garder l'écran allumé » activé par défaut + écran de veille noir, tant que l'écran éteint n'est pas validé |
| Tags ID3 et pochettes | Non urgents : volontairement non faits |

## 4. Ce qui est fait (V2)

Pile : Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6, expo-router, expo-audio, expo-sqlite,
expo-file-system, expo-document-picker, @expo/vector-icons (Ionicons), vitest, ESLint.

**Écrans** (`src/app/`) : **Radio** (état à l'antenne, titre en cours, pause/suivant, bouton manuel, interrupteur
automatique, prochaine publicité, choix de la source, écran de veille), **Horaires** (plages par jour, sélecteur d'heure
sans clavier, copie d'un jour vers un autre), **Musique** (titres avec recherche et pré-écoute ; playlists par cases à
cocher), **Publicités** (intervalle, liste avec activation et pré-écoute, fondu, volume), **Diagnostic** (journal
partageable, réglages de batterie ; accessible depuis l'écran Radio).

**Code** (`src/`) :

```
app/        écrans (expo-router, onglets `expo-router/js-tabs`)
core/       logique pure, SANS dépendance native, testée : program.ts (horaires, créneaux de publicité, rotation,
            ProgramRunner), queue.ts (file d'attente), fade.ts (fondus), wav.ts (silence), types.ts
audio/      engine.ts : le moteur (singleton) — lecteurs « musique », « annonce » et « maintien »
db/         database.ts, migrations.ts (v1 + v2), repo.ts
sources/    MusicSource.ts (interface), LocalFilesSource.ts (import), registry.ts
ui/         thème, composants, hooks
```

Fonctionnement : `ProgramRunner` se réveille au plus toutes les 15 s, recalcule tout d'après l'heure réelle et appelle
le moteur (`onAirChange`, `onAd`). Après une suspension il remet l'antenne dans le bon état, joue au plus une publicité
manquée de moins de 90 s et inscrit « Application suspendue pendant … » au journal. Le journal est enregistré en base
(table `event_log`) et chaque publicité y figure avec son **retard en secondes**. Au lancement, l'app reprend le mode
automatique s'il était activé et note le dernier « signe de vie » connu.

Base : la migration v2 ajoute `opening_slots`, `tracks.enabled` et `event_log`. La table `announcement_rules` de la V1
existe toujours mais n'est plus lue (les règles créées en V1 sont ignorées). Réglages dans `settings` : `radio.auto`,
`radio.source`, `ads.intervalMin`, `ads.fadeMs`, `ads.volume`, `diag.lastAlive`.

**Tests** : 42 tests vitest sur `src/core/`. `npm test`, `npm run typecheck`, `npm run lint` passent.
Il n'y a **aucun test** sur le moteur audio, la base de données ni l'interface.

## 5. Ce qui N'EST PAS vérifié ou connu comme limité

**La V2 n'a jamais été exécutée sur un appareil.** Vérifié sans appareil : types, lint, tests de la logique, assemblage
du bundle Android (`expo export`), mise en page des écrans dans un navigateur, requêtes SQL de la migration (hors app).
Seul retour de l'utilisateur, sur la **V1** et sur son **téléphone** : le fondu et la reprise de la musique après
l'annonce fonctionnent. Rien n'a été testé écran éteint. À valider en priorité :

1. La V2 se lance, la migration v2 s'applique sur une installation V1 existante, les icônes s'affichent.
2. Démarrage et arrêt aux heures prévues, **écran allumé** (cas de base attendu au centre).
3. Publicités à l'heure, à tour de rôle, reprise de la musique (les lecteurs sont en `interruptionMode: 'doNotMix'`).
4. **Écran éteint pendant une heure** : le journal montre-t-il des retards ou des « Application suspendue » ? Le
   planificateur repose sur des timers JavaScript ; s'ils ne tiennent pas, la suite prévue est une alarme exacte native.
5. La piste silencieuse maintient-elle l'app en vie pendant les heures de fermeture (nuit) ? Inconnu.

**Limites connues** :
- Pas de démarrage au redémarrage de la tablette : il faut **ouvrir l'app** une fois ; elle reprend alors le mode automatique.
- Pas de jours fériés ni de fermetures exceptionnelles (utiliser « Arrêter la diffusion » ou couper l'automatique).
- Les minutes des horaires se règlent par quarts d'heure.
- Un titre importé pendant la diffusion n'entre dans la file qu'à la prochaine mise à l'antenne.
- Les titres viennent du **nom de fichier** ; la durée n'est connue qu'après une première lecture.
- La logique `pendingAdvance` (le titre se termine pendant la publicité) est écrite mais non testée.
- Le réglage « Garder l'écran allumé » n'est pas mémorisé (activé à chaque lancement).
- L'APK est signé avec la **clé de débogage** ; pas de build iOS ; pas de synchro ni de compte.

## 6. Construire et distribuer l'app (sans ordinateur)

Un workflow GitHub Actions (`.github/workflows/build-apk.yml`) construit l'APK à la demande :

1. Navigateur du téléphone → dépôt → **Actions** → « Construire l'APK Android » → **Run workflow** → la branche voulue (travail en cours : `claude/appli-musique-tablet-validation-12qs5g`).
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
- `npx expo install` et la configuration automatique de `expo lint` échouent (API Expo bloquée) : les paquets sont installés avec
  `npm install <paquet>` à la version indiquée dans `node_modules/expo/bundledNativeModules.json`. ESLint est configuré à la main (`eslint.config.js`).
- Pour tester le bundling sans appareil : `npx expo export --platform android`.
- Pour voir les écrans sans appareil : `npm install --no-save react-dom react-native-web` puis `npx expo start --web`. La mise en page
  s'affiche, mais ni la base SQLite ni l'audio ne fonctionnent dans le navigateur (l'accueil reste sur « Chargement… »).

## 8. Feuille de route

| Étape | Contenu |
|---|---|
| **Maintenant** | Valider la V2 sur la tablette (points du §5), corriger ce qui casse |
| Ensuite, selon les tests | Alarme exacte native si l'écran éteint ne tient pas ; démarrage automatique de l'app au redémarrage de la tablette |
| Idées | Fermetures exceptionnelles et jours fériés ; vrai logo dans l'app ; publicités limitées à certains jours ; normalisation du volume ; tags ID3 |
| Plus tard (prévu en V1) | Compte et synchro entre appareils (Supabase), catalogue de musiques libres de droit, relais manuel entre appareils |

## 9. Conseils pour la suite

- Avant d'ajouter des fonctions, obtenir le **journal** d'un test réel (écran Diagnostic → Partager).
- Garder la logique dans `src/core/` (pure, testable) et y ajouter des tests.
- Parler français, expliquer simplement, et proposer des étapes réalisables **depuis un téléphone**.
- Ne rien promettre sur le comportement de l'app en arrière-plan Android sans l'avoir vérifié sur l'appareil.
