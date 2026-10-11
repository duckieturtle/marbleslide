// src/render/themes.ts

export type ThemeId = 'doodle' | 'cyber' | 'desmos' | 'blueprint' | 'synthwave';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  background: string;
  gridMajor: string;
  gridMinor: string;
  axis: string;
  axisNumbers: string;
  curveDefault: string;
  ghostTrail: string;
  surfaceRail: string;
  starGlow: string;
  launcherBase: string;
  launcherBarrel: string;
  isDoodle?: boolean;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  doodle: {
    id: 'doodle',
    name: 'Doodle Jump',
    background: '#faf5d8', // Notebook graph paper cream
    gridMajor: 'rgba(92, 160, 222, 0.40)', // Quad-ruled blue grid
    gridMinor: 'rgba(92, 160, 222, 0.16)',
    axis: 'rgba(55, 65, 81, 0.65)', // Hand-drawn pencil lead
    axisNumbers: 'rgba(55, 65, 81, 0.88)',
    curveDefault: '#72b338', // Iconic Doodle Jump platform green
    ghostTrail: 'rgba(114, 179, 56, 0.45)',
    surfaceRail: '#72b338',
    starGlow: '#f59e0b',
    launcherBase: '#4d7524',
    launcherBarrel: '#87c740',
    isDoodle: true,
  },
  cyber: {
    id: 'cyber',
    name: 'Midnight Cyber',
    background: '#0a0f1d',
    gridMajor: 'rgba(56, 189, 248, 0.16)',
    gridMinor: 'rgba(56, 189, 248, 0.05)',
    axis: 'rgba(56, 189, 248, 0.6)',
    axisNumbers: 'rgba(148, 163, 184, 0.8)',
    curveDefault: '#38bdf8',
    ghostTrail: 'rgba(56, 189, 248, 0.35)',
    surfaceRail: '#38bdf8',
    starGlow: '#fbbf24',
    launcherBase: '#1e293b',
    launcherBarrel: '#38bdf8',
  },
  desmos: {
    id: 'desmos',
    name: 'Desmos Classic',
    background: '#ffffff',
    gridMajor: 'rgba(15, 23, 42, 0.16)',
    gridMinor: 'rgba(15, 23, 42, 0.06)',
    axis: 'rgba(15, 23, 42, 0.75)',
    axisNumbers: 'rgba(71, 85, 105, 0.9)',
    curveDefault: '#2563eb',
    ghostTrail: 'rgba(59, 130, 246, 0.3)',
    surfaceRail: '#2563eb',
    starGlow: '#f59e0b',
    launcherBase: '#64748b',
    launcherBarrel: '#3b82f6',
  },
  blueprint: {
    id: 'blueprint',
    name: 'Architect Blueprint',
    background: '#092147',
    gridMajor: 'rgba(125, 211, 252, 0.25)',
    gridMinor: 'rgba(125, 211, 252, 0.08)',
    axis: 'rgba(186, 230, 253, 0.7)',
    axisNumbers: 'rgba(186, 230, 253, 0.85)',
    curveDefault: '#38bdf8',
    ghostTrail: 'rgba(125, 211, 252, 0.3)',
    surfaceRail: '#7dd3fc',
    starGlow: '#fef08a',
    launcherBase: '#0e3a75',
    launcherBarrel: '#7dd3fc',
  },
  synthwave: {
    id: 'synthwave',
    name: 'Retro Synthwave',
    background: '#18072b',
    gridMajor: 'rgba(217, 70, 239, 0.22)',
    gridMinor: 'rgba(217, 70, 239, 0.07)',
    axis: 'rgba(236, 72, 153, 0.65)',
    axisNumbers: 'rgba(244, 114, 182, 0.85)',
    curveDefault: '#f43f5e',
    ghostTrail: 'rgba(236, 72, 153, 0.35)',
    surfaceRail: '#f43f5e',
    starGlow: '#facc15',
    launcherBase: '#3b0764',
    launcherBarrel: '#ec4899',
  },
};
