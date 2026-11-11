import { isTauri } from '@tauri-apps/api/core';
import { BrowserSessionRepository } from './browserRepository';
import type { SessionRepository } from './sessionRepository';
import { TauriSessionRepository } from './tauriRepository';

export const sessionRepository: SessionRepository = isTauri()
  ? new TauriSessionRepository()
  : new BrowserSessionRepository();
