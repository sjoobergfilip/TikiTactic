import { invoke } from '@tauri-apps/api/core';
import type { TacticsSession } from '../types';
import { normalizeSession, type SessionRepository, type SessionSummary } from './sessionRepository';

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export class TauriSessionRepository implements SessionRepository {
  constructor(private readonly invokeCommand: TauriInvoke = invoke) {}

  async listSummaries(): Promise<SessionSummary[]> {
    return this.invokeCommand('list_sessions');
  }

  async load(id: string): Promise<TacticsSession> {
    const document = await this.invokeCommand('load_session', { id });
    return normalizeSession(document);
  }

  async save(document: TacticsSession): Promise<SessionSummary> {
    return this.invokeCommand('save_session', { document: normalizeSession(document) });
  }

  async duplicate(id: string, title: string): Promise<SessionSummary> {
    return this.invokeCommand('duplicate_session', { id, title });
  }

  async remove(id: string): Promise<void> {
    return this.invokeCommand('delete_session', { id });
  }
}
