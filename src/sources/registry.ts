import type { Track } from '../core/types';
import { localFilesSource } from './LocalFilesSource';
import type { MusicSource } from './MusicSource';

const sources = new Map<string, MusicSource>();

export function registerSource(source: MusicSource): void {
  sources.set(source.id, source);
}

export function getSource(id: string): MusicSource | undefined {
  return sources.get(id);
}

export function listSources(): MusicSource[] {
  return [...sources.values()];
}

export async function resolveUri(track: Track): Promise<string> {
  const src = sources.get(track.source);
  return src ? src.resolvePlayableUri(track) : track.fileUri;
}

registerSource(localFilesSource);
