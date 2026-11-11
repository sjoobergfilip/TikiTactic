import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSession } from '../src/lib/data';
import { BrowserSessionRepository } from '../src/lib/persistence/browserRepository';
import type { SessionRepository } from '../src/lib/persistence/sessionRepository';
import { TauriSessionRepository, type TauriInvoke } from '../src/lib/persistence/tauriRepository';
import type { TacticsSession } from '../src/lib/types';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function document(id = 'session-contract'): TacticsSession {
  return {
    ...createInitialSession(),
    id,
    title: 'Contract session',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function tauriRepository(): SessionRepository {
  const backend = new BrowserSessionRepository(new MemoryStorage());
  const invoke: TauriInvoke = async <T>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
    let result: unknown;
    switch (command) {
      case 'list_sessions':
        result = await backend.listSummaries();
        break;
      case 'load_session':
        result = await backend.load(args.id as string);
        break;
      case 'save_session':
        result = await backend.save(args.document as TacticsSession);
        break;
      case 'duplicate_session':
        result = await backend.duplicate(args.id as string, args.title as string);
        break;
      case 'delete_session':
        result = await backend.remove(args.id as string);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    return result as T;
  };
  return new TauriSessionRepository(invoke);
}

const adapters: [string, () => SessionRepository][] = [
  ['BrowserSessionRepository', () => new BrowserSessionRepository(new MemoryStorage())],
  ['TauriSessionRepository', tauriRepository],
];

describe.each(adapters)('%s contract', (_name, createRepository) => {
  let repository: SessionRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it('saves a document and returns its summary', async () => {
    const session = document();
    const summary = await repository.save(session);

    expect(summary).toMatchObject({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      slideCount: session.slides.length,
      thumbnailPath: null,
    });
    expect(summary.fileSize).toBeGreaterThan(0);
  });

  it('loads the saved document', async () => {
    const session = document();
    await repository.save(session);

    expect(await repository.load(session.id)).toEqual(session);
  });

  it('lists saved documents', async () => {
    const session = document();
    await repository.save(session);

    expect(await repository.listSummaries()).toHaveLength(1);
    expect((await repository.listSummaries())[0].id).toBe(session.id);
  });

  it('duplicates a document without replacing the original', async () => {
    const session = document();
    await repository.save(session);
    const copy = await repository.duplicate(session.id, 'Copied session');

    expect(copy.id).not.toBe(session.id);
    expect(copy.title).toBe('Copied session');
    expect(await repository.load(session.id)).toEqual(session);
    expect((await repository.load(copy.id)).title).toBe('Copied session');
    expect(await repository.listSummaries()).toHaveLength(2);
  });

  it('deletes a document', async () => {
    const session = document();
    await repository.save(session);
    await repository.remove(session.id);

    expect(await repository.listSummaries()).toEqual([]);
    await expect(repository.load(session.id)).rejects.toThrow('Session not found');
  });
});

describe('BrowserSessionRepository compatibility', () => {
  it('reads the existing single-session storage key', async () => {
    const storage = new MemoryStorage();
    const session = document('legacy-session');
    storage.setItem('touchline-tactics-v1', JSON.stringify(session));
    const repository = new BrowserSessionRepository(storage);

    expect(await repository.listSummaries()).toHaveLength(1);
    expect(await repository.load(session.id)).toEqual(session);
  });
});
