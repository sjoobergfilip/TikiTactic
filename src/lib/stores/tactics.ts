import { get, writable } from 'svelte/store';
import { createInitialSession, createSlide } from '../data';
import { sessionRepository } from '../persistence';
import type { Category, Slide, TacticsSession, Team, Tool } from '../types';

const HISTORY_LIMIT = 40;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const session = writable<TacticsSession>(createInitialSession());
export const currentSlideId = writable<string>(get(session).slides[0].id);
export const activeTool = writable<Tool>('select');
export const selectedPlayerId = writable<string | null>(null);
export const selectedAnnotationId = writable<string | null>(null);
export const saveStatus = writable<'saving' | 'saved'>('saved');
export const notice = writable<string>('');
export const past = writable<TacticsSession[]>([]);
export const future = writable<TacticsSession[]>([]);

let noticeTimer: ReturnType<typeof setTimeout>;
let saveTimer: ReturnType<typeof setTimeout>;
let persistenceReady = false;

export function flash(message: string) {
  notice.set(message);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.set(''), 2400);
}

function scheduleSave(value: TacticsSession) {
  saveStatus.set('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void sessionRepository
      .save(value)
      .then(() => saveStatus.set('saved'))
      .catch(() => {
        saveStatus.set('saved');
        flash('Local storage is unavailable or full. Export a backup to keep this plan.');
      });
  }, 350);
}

export async function initializeSession() {
  let shouldSave = true;
  try {
    const summaries = await sessionRepository.listSummaries();
    const latest = summaries[0];
    if (latest) {
      const stored = await sessionRepository.load(latest.id);
      session.set(stored);
      currentSlideId.set(stored.slides[0].id);
    }
  } catch {
    shouldSave = false;
    flash('Stored sessions could not be loaded. The example plan has not been saved over them.');
  }
  persistenceReady = true;
  if (shouldSave) scheduleSave(get(session));
}

session.subscribe((value) => {
  if (persistenceReady) scheduleSave(value);
});

export function checkpoint() {
  const snapshot = clone(get(session));
  past.update((items) => [...items.slice(-(HISTORY_LIMIT - 1)), snapshot]);
  future.set([]);
}

export function undo() {
  const history = get(past);
  if (!history.length) return;
  const previous = history[history.length - 1];
  future.update((items) => [clone(get(session)), ...items]);
  past.set(history.slice(0, -1));
  session.set(previous);
  clearSelection();
  flash('Undid last change');
}

export function redo() {
  const items = get(future);
  if (!items.length) return;
  const next = items[0];
  past.update((history) => [...history, clone(get(session))]);
  future.set(items.slice(1));
  session.set(next);
  clearSelection();
  flash('Restored change');
}

export function clearSelection() {
  selectedPlayerId.set(null);
  selectedAnnotationId.set(null);
}

export function selectSlide(id: string) {
  currentSlideId.set(id);
  clearSelection();
}

export function updateSlide(id: string, recipe: (slide: Slide) => void, withHistory = true) {
  if (withHistory) checkpoint();
  session.update((value) => ({
    ...value,
    slides: value.slides.map((slide) => {
      if (slide.id !== id) return slide;
      const next = clone(slide);
      recipe(next);
      return next;
    }),
    updatedAt: new Date().toISOString(),
  }));
}

export function updateSession(recipe: (value: TacticsSession) => void, withHistory = true) {
  if (withHistory) checkpoint();
  session.update((value) => {
    const next = clone(value);
    recipe(next);
    next.updatedAt = new Date().toISOString();
    return next;
  });
}

export function addSlide(title: string, category: Category) {
  const slide = createSlide(title.trim(), category);
  checkpoint();
  session.update((value) => ({ ...value, slides: [...value.slides, slide], updatedAt: new Date().toISOString() }));
  selectSlide(slide.id);
  flash('Phase added');
  return slide.id;
}

export function duplicateSlide(id: string) {
  const source = get(session).slides.find((slide) => slide.id === id);
  if (!source) return;
  const copy = clone(source);
  copy.id = crypto.randomUUID();
  copy.title = `${source.title.replace(/ · Copy$/, '')} · Copy`;
  const rekey = (prefix: string) => `${copy.id}-${prefix}-${crypto.randomUUID()}`;
  copy.players = copy.players.map((player) => ({ ...player, id: rekey(player.team) }));
  copy.annotations = copy.annotations.map((item) => ({ ...item, id: rekey(item.type) }));
  checkpoint();
  session.update((value) => {
    const index = value.slides.findIndex((slide) => slide.id === id);
    value.slides.splice(index + 1, 0, copy);
    return value;
  });
  selectSlide(copy.id);
  flash('Phase duplicated');
}

export function removeSlide(id: string) {
  const current = get(session);
  if (current.slides.length <= 1) {
    flash('Keep at least one phase in the plan');
    return;
  }
  const index = current.slides.findIndex((slide) => slide.id === id);
  checkpoint();
  session.update((value) => ({ ...value, slides: value.slides.filter((slide) => slide.id !== id) }));
  if (get(currentSlideId) === id) {
    const next = current.slides[index + 1] ?? current.slides[index - 1];
    selectSlide(next.id);
  }
  flash('Phase removed');
}

export function moveSlide(id: string, direction: -1 | 1) {
  const slides = get(session).slides;
  const index = slides.findIndex((slide) => slide.id === id);
  const target = index + direction;
  if (target < 0 || target >= slides.length) return;
  checkpoint();
  session.update((value) => {
    const [slide] = value.slides.splice(index, 1);
    value.slides.splice(target, 0, slide);
    return value;
  });
}

export function addPlayer(team: Team) {
  const slideId = get(currentSlideId);
  const id = crypto.randomUUID();
  updateSlide(slideId, (slide) => {
    const used = slide.players.filter((player) => player.team === team).map((player) => player.number);
    const number = Array.from({ length: 16 }, (_, index) => index + 1).find((value) => !used.includes(value)) ?? 12;
    const count = slide.players.filter((player) => player.team === team).length;
    slide.players.push({
      id,
      team,
      number,
      role: team === 'home' ? 'PLAYER' : 'OPP',
      x: 48 + (count % 3) * 4,
      y: 27 + (count % 4) * 5,
    });
  });
  selectedPlayerId.set(id);
  selectedAnnotationId.set(null);
  activeTool.set('select');
  flash(`${team === 'home' ? 'Home' : 'Opposition'} player added`);
}

export function removePlayer(slideId: string, playerId: string) {
  updateSlide(slideId, (slide) => {
    slide.players = slide.players.filter((player) => player.id !== playerId);
  });
  selectedPlayerId.set(null);
  flash('Player removed');
}

export function removeAnnotation(slideId: string, annotationId: string) {
  updateSlide(slideId, (slide) => {
    slide.annotations = slide.annotations.filter((item) => item.id !== annotationId);
  });
  selectedAnnotationId.set(null);
}

export function deleteSelection() {
  const slideId = get(currentSlideId);
  const playerId = get(selectedPlayerId);
  const annotationId = get(selectedAnnotationId);
  if (playerId) removePlayer(slideId, playerId);
  else if (annotationId) removeAnnotation(slideId, annotationId);
}

export function resetSession() {
  checkpoint();
  const fresh = createInitialSession();
  session.set(fresh);
  selectSlide(fresh.slides[0].id);
  flash('Example plan restored');
}
