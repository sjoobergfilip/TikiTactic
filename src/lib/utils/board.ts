import type { Player, Point } from '../types';

export function playerColor(player: Pick<Player, 'team' | 'number' | 'color'>): string {
  if (player.color) return player.color;
  if (player.number === 1) return player.team === 'home' ? '#f4c430' : '#22c7d6';
  return player.team === 'home' ? '#ef3327' : '#f1f2ed';
}

export function playerTextColor(player: Pick<Player, 'team' | 'number' | 'color'>): string {
  const hex = playerColor(player).replace('#', '');
  if (hex.length !== 6) return '#202824';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
  return luminance > 0.57 ? '#202824' : '#fff8f2';
}

export const PITCH_WIDTH = 105;
export const PITCH_HEIGHT = 68;

export function clampPoint(point: Point): Point {
  return {
    x: Math.max(2.8, Math.min(PITCH_WIDTH - 2.8, point.x)),
    y: Math.max(2.8, Math.min(PITCH_HEIGHT - 2.8, point.y)),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function runPath(points: Point[]): string {
  if (points.length < 2) return '';
  const [start, end] = points;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const bend = Math.min(length * 0.14, 8);
  const cx = (start.x + end.x) / 2 - (dy / length) * bend;
  const cy = (start.y + end.y) / 2 + (dx / length) * bend;
  return `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
}

export function linePath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function zoneBounds(points: Point[]) {
  if (points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  const [a, b] = points;
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
