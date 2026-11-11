export type Team = 'home' | 'away';
export type Category = 'buildup' | 'defence' | 'setpiece';
export type Tool = 'select' | 'run' | 'pass' | 'line' | 'draw' | 'zone' | 'erase';
export type AnnotationType = Exclude<Tool, 'select' | 'erase'>;

export interface Point {
  x: number;
  y: number;
}

export interface Player extends Point {
  id: string;
  team: Team;
  number: number;
  role: string;
  name?: string;
  color?: string;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: Point[];
  color: string;
}

export interface Slide {
  id: string;
  title: string;
  category: Category;
  notes: string;
  players: Player[];
  annotations: Annotation[];
  ball: Point;
}

export interface TacticsSession {
  version: 1;
  id: string;
  title: string;
  slides: Slide[];
  showRoles: boolean;
  smoothTransitions: boolean;
  showCorridors: boolean;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  buildup: 'Build-up',
  defence: 'Defence',
  setpiece: 'Set piece',
};

export const CATEGORY_SHORT: Record<Category, string> = {
  buildup: 'BUILD',
  defence: 'DEFEND',
  setpiece: 'SET PIECE',
};
