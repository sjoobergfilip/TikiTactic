import type { TacticsSession } from '../types';

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  thumbnailPath: string | null;
  fileSize: number;
  modifiedMs: number;
}

export interface SessionRepository {
  listSummaries(): Promise<SessionSummary[]>;
  load(id: string): Promise<TacticsSession>;
  save(document: TacticsSession): Promise<SessionSummary>;
  duplicate(id: string, title: string): Promise<SessionSummary>;
  remove(id: string): Promise<void>;
}

export function normalizeSession(value: unknown): TacticsSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid session document');
  const document = value as TacticsSession;
  if (
    document.version !== 1 ||
    typeof document.id !== 'string' ||
    document.id.length === 0 ||
    typeof document.title !== 'string' ||
    !Array.isArray(document.slides) ||
    document.slides.length === 0
  ) {
    throw new Error('Invalid session document');
  }
  return {
    ...document,
    smoothTransitions: document.smoothTransitions ?? true,
    showCorridors: document.showCorridors ?? false,
  };
}

export function summarizeSession(document: TacticsSession, fileSize: number): SessionSummary {
  const modifiedMs = Date.parse(document.updatedAt);
  return {
    id: document.id,
    title: document.title,
    updatedAt: document.updatedAt,
    slideCount: document.slides.length,
    thumbnailPath: null,
    fileSize,
    modifiedMs: Number.isNaN(modifiedMs) ? 0 : modifiedMs,
  };
}
