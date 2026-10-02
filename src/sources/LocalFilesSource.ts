import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import type { Track } from '../core/types';
import { insertTrack } from '../db/repo';
import type { MusicSource } from './MusicSource';

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus)$/i;

/** « 01 - Mon_titre.mp3 » -> « Mon titre ». */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^\s*\d{1,3}\s*[-_.)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

function libraryDir(): Directory {
  const dir = new Directory(Paths.document, 'library');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export const localFilesSource: MusicSource = {
  id: 'local',
  label: 'Fichiers de la tablette',

  async importTracks({ kind }) {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return [];
    const dir = libraryDir();
    const imported: Track[] = [];
    for (const asset of res.assets) {
      if (!AUDIO_EXT.test(asset.name) && !(asset.mimeType ?? '').startsWith('audio/')) continue;
      const ext = (asset.name.match(/\.[^.]+$/)?.[0] ?? '.mp3').toLowerCase();
      const dest = new File(dir, `${randomUUID()}${ext}`);
      await new File(asset.uri).copy(dest);
      imported.push(
        await insertTrack({
          title: titleFromFilename(asset.name),
          artist: null,
          album: null,
          durationMs: null,
          fileUri: dest.uri,
          source: 'local',
          sourceRef: asset.name,
          license: null,
          kind,
        }),
      );
    }
    return imported;
  },

  async resolvePlayableUri(track) {
    return track.fileUri;
  },

  async remove(track) {
    try {
      const f = new File(track.fileUri);
      if (f.exists) f.delete();
    } catch {
      // Fichier déjà absent : rien à faire.
    }
  },
};
