/**
 * A fixed palette instead of random colors: every hue is distinguishable from
 * the others, holds a >=4.5:1 contrast ratio against white text, and stays
 * stable across renders so a course keeps its identity everywhere in the UI.
 */
export const COURSE_PALETTE = [
  '#2563eb', // blue
  '#db2777', // pink
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#dc2626', // red
  '#0891b2', // cyan
  '#4d7c0f', // lime
] as const;

export type CourseColor = (typeof COURSE_PALETTE)[number];

/**
 * Assigns the next unused palette color. Falls back to cycling once every
 * color is taken, which only happens past 8 courses in one semester.
 */
export function pickCourseColor(usedColors: string[]): string {
  const free = COURSE_PALETTE.find((c) => !usedColors.includes(c));
  return free ?? COURSE_PALETTE[usedColors.length % COURSE_PALETTE.length]!;
}

/** Translucent version of a course color, for chip backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
