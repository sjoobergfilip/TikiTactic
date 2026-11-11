import type { TacticsSession } from '../types';
import { normalizeSession, summarizeSession, type SessionRepository, type SessionSummary } from './sessionRepository';

const LEGACY_STORAGE_KEY = 'touchline-tactics-v1';
const SESSION_KEY_PREFIX = 'tikitactic-session-v1:';

export class BrowserSessionRepository implements SessionRepository {
  constructor(private readonly storage?: Storage) {}

  async listSummaries(): Promise<SessionSummary[]> {
    return this.readAll()
      .map(({ document, serialized }) => summarizeSession(document, new TextEncoder().encode(serialized).byteLength))
      .sort((a, b) => b.modifiedMs - a.modifiedMs);
  }

  async load(id: string): Promise<TacticsSession> {
    const storage = this.getStorage();
    const stored = storage.getItem(SESSION_KEY_PREFIX + id);
    if (stored) return normalizeSession(JSON.parse(stored));

    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const document = normalizeSession(JSON.parse(legacy));
      if (document.id === id) return document;
    }
    throw new Error('Session not found');
  }

  async save(document: TacticsSession): Promise<SessionSummary> {
    const normalized = normalizeSession(document);
    const serialized = JSON.stringify(normalized);
    this.getStorage().setItem(SESSION_KEY_PREFIX + normalized.id, serialized);
    return summarizeSession(normalized, new TextEncoder().encode(serialized).byteLength);
  }

  async duplicate(id: string, title: string): Promise<SessionSummary> {
    const copy = structuredClone(await this.load(id));
    copy.id = crypto.randomUUID();
    copy.title = title;
    copy.updatedAt = new Date().toISOString();
    return this.save(copy);
  }

  async remove(id: string): Promise<void> {
    const storage = this.getStorage();
    const key = SESSION_KEY_PREFIX + id;
    if (storage.getItem(key)) {
      storage.removeItem(key);
      return;
    }

    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && normalizeSession(JSON.parse(legacy)).id === id) {
      storage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }
    throw new Error('Session not found');
  }

  private getStorage(): Storage {
    if (this.storage) return this.storage;
    if (typeof window === 'undefined') throw new Error('Browser storage is unavailable');
    return window.localStorage;
  }

  private readAll(): { document: TacticsSession; serialized: string }[] {
    const storage = this.getStorage();
    const documents: { document: TacticsSession; serialized: string }[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(SESSION_KEY_PREFIX)) continue;
      const serialized = storage.getItem(key);
      if (!serialized) continue;
      try {
        const document = normalizeSession(JSON.parse(serialized));
        if (document.id === key.slice(SESSION_KEY_PREFIX.length)) documents.push({ document, serialized });
      } catch {
        continue;
      }
    }

    if (documents.length === 0) {
      const legacy = storage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          documents.push({ document: normalizeSession(JSON.parse(legacy)), serialized: legacy });
        } catch {
          return [];
        }
      }
    }
    return documents;
  }
}
