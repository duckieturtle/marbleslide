// src/levels/levelData.ts
// Comprehensive suite of 16 progressive puzzle levels for MarbleSlide

import { Launcher, Star, Obstacle, Bumper, Booster, Portal, GravityWell } from '../physics/types';

export interface EquationItem {
  id: string;
  raw: string;
  color: string;
  locked?: boolean;
}

export interface LevelDefinition {
  id: string;
  number: number;
  title: string;
  category: 'Lines' | 'Parabolas' | 'Trig & Waves' | 'Obstacles & Portals' | 'Master Challenges';
  description: string;
  mathHint: string;
  launcher: Launcher;
  stars: Star[];
  obstacles?: Obstacle[];
  bumpers?: Bumper[];
  boosters?: Booster[];
  portals?: Portal[];
  gravityWells?: GravityWell[];
  initialEquations: EquationItem[];
  initialSliders?: Record<string, { value: number; min: number; max: number; step: number }>;
  suggestedView: {
    centerX: number;
    centerY: number;
    scale: number; // pixels per math unit
  };
}

export const LEVELS: LevelDefinition[] = [
  // 1. Lines - Intro
  {
    id: 'level-1',
    number: 1,
    title: 'The First Slide',
    category: 'Lines',
    description: 'Welcome to Marbleslide! Adjust the line equation so the falling marbles slide through all three stars.',
    mathHint: 'In the equation y = m*x + b, "m" controls the steepness (slope) and "b" moves the line up and down.',
    launcher: {
      x: -7,
      y: 6,
      angle: -Math.PI / 4,
      speed: 4.5,
      marbleCount: 6,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -4, y: 3.5, radius: 0.45, collected: false },
      { id: 's2', x: -1, y: 1.5, radius: 0.45, collected: false },
      { id: 's3', x: 2, y: -0.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.5*x + 1.5', color: '#38bdf8' },
    ],
    initialSliders: {
      m: { value: -0.67, min: -2, max: 0, step: 0.05 },
      b: { value: 0.8, min: -3, max: 4, step: 0.1 },
    },
    suggestedView: { centerX: -1, centerY: 2, scale: 21 },
  },

  // 2. Lines - Domain Restriction
  {
    id: 'level-2',
    number: 2,
    title: 'Mind the Gap',
    category: 'Lines',
    description: 'The slide is currently too long! Truncate the line with a domain restriction {x < ...} so marbles drop into the star pocket.',
    mathHint: 'Add a domain restriction using curly braces: {x < 0} stops the line at x = 0, letting marbles plunge downward.',
    launcher: {
      x: -7.5,
      y: 7.0,
      angle: -0.4,
      speed: 4.2,
      marbleCount: 6,
      releaseInterval: 0.22,
    },
    stars: [
      { id: 's1', x: -3, y: 2.5, radius: 0.45, collected: false },
      { id: 's2', x: 1, y: -2, radius: 0.45, collected: false },
      { id: 's3', x: 1, y: -4, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.6*x + 1', color: '#f43f5e' },
      { id: 'eq2', raw: 'y = -5.5 { -2 < x < 4 }', color: '#10b981' },
    ],
    suggestedView: { centerX: -1, centerY: 0, scale: 21 },
  },

  // 3. Lines - Double Ramp (Piecewise Transfer)
  {
    id: 'level-3',
    number: 3,
    title: 'Switchback Trail',
    category: 'Lines',
    description: 'Use two opposing ramps to catch and redirect the marbles back and forth.',
    mathHint: 'Combine two lines with opposite slopes: one sloping down-right (m < 0), and one below sloping down-left (m > 0).',
    launcher: {
      x: -7,
      y: 8.0,
      angle: -0.3,
      speed: 4.0,
      marbleCount: 6,
      releaseInterval: 0.22,
    },
    stars: [
      { id: 's1', x: -1, y: 3, radius: 0.45, collected: false },
      { id: 's2', x: 2, y: 0.5, radius: 0.45, collected: false },
      { id: 's3', x: -4, y: -3.5, radius: 0.45, collected: false },
      { id: 's4', x: -6, y: -4.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.7*x + 2 { x < 3.5 }', color: '#38bdf8' },
      { id: 'eq2', raw: 'y = 0.5*x - 2 { -7 < x < 3 }', color: '#a855f7' },
    ],
    suggestedView: { centerX: -1, centerY: 1, scale: 21 },
  },

  // 4. Parabolas - The Valley
  {
    id: 'level-4',
    number: 4,
    title: 'The Halfpipe',
    category: 'Parabolas',
    description: 'Marbles must dive into a quadratic valley and gain enough kinetic energy to swoop up the opposite bank.',
    mathHint: 'Quadratic curves: y = a*(x - h)^2 + k. Vertex form puts the lowest point at (h, k). A positive "a" creates a bowl.',
    launcher: {
      x: -5.5,
      y: 6.5,
      angle: -0.5,
      speed: 4.0,
      marbleCount: 7,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -3, y: 0.5, radius: 0.45, collected: false },
      { id: 's2', x: 0, y: -2.5, radius: 0.45, collected: false },
      { id: 's3', x: 3, y: 0.5, radius: 0.45, collected: false },
      { id: 's4', x: 5, y: 3.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = 0.18*(x)^2 - 3 { -6 < x < 6 }', color: '#ec4899' },
    ],
    initialSliders: {
      a: { value: 0.18, min: 0.05, max: 0.5, step: 0.01 },
      k: { value: -3, min: -6, max: 0, step: 0.2 },
    },
    suggestedView: { centerX: 0, centerY: 1.5, scale: 21 },
  },

  // 5. Parabolas - The Ski Jump
  {
    id: 'level-5',
    number: 5,
    title: 'Ski Jump Challenge',
    category: 'Parabolas',
    description: 'Marbles drop onto the kicker ramp to soar over the pit and land on the landing hill!',
    mathHint: 'Cut off the ramp with {x < 0} at an upward angle to launch marbles into the air.',
    launcher: {
      x: -7.5,
      y: 7.5,
      angle: -0.3,
      speed: 4.5,
      marbleCount: 7,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: 1, y: 2.5, radius: 0.45, collected: false },
      { id: 's2', x: 3.5, y: 0.5, radius: 0.45, collected: false },
      { id: 's3', x: 6, y: -2, radius: 0.45, collected: false },
    ],
    obstacles: [
      { id: 'pit', x: 1, y: -5, width: 4, height: 6, color: '#ef4444' },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = 0.15*(x + 3)^2 - 1 { -8 < x < -0.5 }', color: '#10b981' },
      { id: 'eq2', raw: 'y = -0.8*x + 3 { x > 4 }', color: '#38bdf8' },
    ],
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 6. Trig - Wave Rider
  {
    id: 'level-6',
    number: 6,
    title: 'Sine Wave Coaster',
    category: 'Trig & Waves',
    description: 'Ride undulating crests and troughs with sinusoidal functions.',
    mathHint: 'y = A * sin(B * x) + C. "A" controls wave height (amplitude) and "B" controls wave frequency.',
    launcher: {
      x: -8,
      y: 5.5,
      angle: -0.3,
      speed: 4.0,
      marbleCount: 8,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -5, y: 2.2, radius: 0.45, collected: false },
      { id: 's2', x: -1.5, y: -1.8, radius: 0.45, collected: false },
      { id: 's3', x: 2, y: 2.2, radius: 0.45, collected: false },
      { id: 's4', x: 5.5, y: -1.8, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = 2 * sin(0.9 * x) - 0.2 * x', color: '#06b6d4' },
    ],
    initialSliders: {
      A: { value: 2.0, min: 0.5, max: 4.0, step: 0.1 },
      B: { value: 0.9, min: 0.2, max: 2.0, step: 0.05 },
    },
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 7. Obstacles - The Over-Under
  {
    id: 'level-7',
    number: 7,
    title: 'The Great Wall',
    category: 'Obstacles & Portals',
    description: 'A colossal red barrier divides the sky. Guide marbles underneath the wall through the subterranean passage!',
    mathHint: 'Use negative slope into a steep slide that dives below y = -2, then levels out past the wall.',
    launcher: {
      x: -6.5,
      y: 7.0,
      angle: -0.4,
      speed: 4.0,
      marbleCount: 7,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -2, y: -2.5, radius: 0.45, collected: false },
      { id: 's2', x: 0, y: -3.5, radius: 0.45, collected: false },
      { id: 's3', x: 4, y: -2.5, radius: 0.45, collected: false },
      { id: 's4', x: 6, y: 0.5, radius: 0.45, collected: false },
    ],
    obstacles: [
      { id: 'wall1', x: 0, y: 3, width: 1.2, height: 9, color: '#ef4444' },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -1.2*x - 2 { -7 < x < -1 }', color: '#f59e0b' },
      { id: 'eq2', raw: 'y = 0.2*(x - 1)^2 - 4 { -1 < x < 6 }', color: '#a855f7' },
    ],
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 8. Pinball - Bumper Alley
  {
    id: 'level-8',
    number: 8,
    title: 'Bumper Ricochet',
    category: 'Obstacles & Portals',
    description: 'High-energy mushroom bumpers repel marbles with great force! Use their bounce impulse to reach floating stars.',
    mathHint: 'Angle your slide so marbles collide with the center-top of the bumper to spring upward into the stars.',
    launcher: {
      x: -5.5,
      y: 6.5,
      angle: -0.4,
      speed: 3.8,
      marbleCount: 6,
      releaseInterval: 0.22,
    },
    bumpers: [
      { id: 'b1', x: 0, y: -2.5, radius: 0.75, bouncePower: 11.0, flashTimer: 0 },
      { id: 'b2', x: 5, y: -1, radius: 0.75, bouncePower: 10.5, flashTimer: 0 },
    ],
    stars: [
      { id: 's1', x: -2, y: 1.0, radius: 0.45, collected: false },
      { id: 's2', x: 0, y: 3.5, radius: 0.45, collected: false },
      { id: 's3', x: 3, y: 4.5, radius: 0.45, collected: false },
      { id: 's4', x: 7, y: 3.0, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.7*x + 1.2 { -6 < x < -0.8 }', color: '#ec4899' },
    ],
    suggestedView: { centerX: 1, centerY: 2, scale: 21 },
  },

  // 9. Portals - Quantum Leap
  {
    id: 'level-9',
    number: 9,
    title: 'Quantum Portal Leap',
    category: 'Obstacles & Portals',
    description: 'Slide into the Blue Portal to teleport out of the Orange Portal with preserved momentum!',
    mathHint: 'Portals exit along their facing direction. Design a receiving ramp under the Orange Portal exit.',
    launcher: {
      x: -6.5,
      y: 6.5,
      angle: -0.3,
      speed: 4.2,
      marbleCount: 7,
      releaseInterval: 0.2,
    },
    portals: [
      {
        id: 'portal-1',
        x1: 2,
        y1: -2,
        angle1: Math.PI / 4,
        x2: -4,
        y2: 1,
        angle2: 0, // exits facing right
        radius: 0.65,
      },
    ],
    stars: [
      { id: 's1', x: -1, y: 0.5, radius: 0.45, collected: false },
      { id: 's2', x: 0, y: 1.0, radius: 0.45, collected: false },
      { id: 's3', x: 4, y: 0.2, radius: 0.45, collected: false },
      { id: 's4', x: 6, y: -2.0, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.8*x - 0.2 { -7 < x < 1.8 }', color: '#38bdf8' },
      { id: 'eq2', raw: 'y = -0.3*(x - 1)^2 + 1.5 { -4 < x < 6.5 }', color: '#f97316' },
    ],
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 10. Booster - Sonic Velocity
  {
    id: 'level-10',
    number: 10,
    title: 'Speed Strip Sprint',
    category: 'Obstacles & Portals',
    description: 'A neon acceleration booster propels marbles to extreme velocities, letting them conquer a steep uphill grade.',
    mathHint: 'After entering the booster, build a gentle parabolic transition so marbles do not bounce off violently.',
    launcher: {
      x: -7.5,
      y: 5.0,
      angle: -0.3,
      speed: 3.5,
      marbleCount: 7,
      releaseInterval: 0.2,
    },
    boosters: [
      { id: 'bst1', x: -2, y: -3.5, width: 3.5, height: 1.2, angle: 0.1, power: 30.0 },
    ],
    stars: [
      { id: 's1', x: 1, y: -2, radius: 0.45, collected: false },
      { id: 's2', x: 4, y: 1, radius: 0.45, collected: false },
      { id: 's3', x: 7, y: 4.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.7*x - 2.5 { -8 < x < -3.5 }', color: '#38bdf8' },
      { id: 'eq2', raw: 'y = -4.0 { -3.5 < x < 0 }', color: '#10b981' },
      { id: 'eq3', raw: 'y = 0.1*(x - 1)^2 - 3.8 { 0 < x < 8 }', color: '#a855f7' },
    ],
    suggestedView: { centerX: 0, centerY: 0.5, scale: 21 },
  },

  // 11. Absolute Value & V-Ramps
  {
    id: 'level-11',
    number: 11,
    title: 'The Sharp Apex',
    category: 'Parabolas',
    description: 'Use the sharp peak of an inverted absolute value function y = -|x - h| + k to launch marbles outward in two symmetric wings.',
    mathHint: 'Function abs(x) produces a sharp V-groove. Inverted -abs(x) creates a roof peak.',
    launcher: {
      x: -0.1,
      y: 7.5,
      angle: -Math.PI / 2, // drops straight down
      speed: 2.0,
      marbleCount: 8,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -4, y: 1.5, radius: 0.45, collected: false },
      { id: 's2', x: -6, y: -1.5, radius: 0.45, collected: false },
      { id: 's3', x: 4, y: 1.5, radius: 0.45, collected: false },
      { id: 's4', x: 6, y: -1.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.8 * abs(x) + 4.5 { -7 < x < 7 }', color: '#f59e0b' },
    ],
    suggestedView: { centerX: 0, centerY: 2, scale: 21 },
  },

  // 12. Rational & Asymptotes
  {
    id: 'level-12',
    number: 12,
    title: 'Hyperbolic Drop',
    category: 'Trig & Waves',
    description: 'Rational curves like 1/(x) curve smoothly into steep drop-offs.',
    mathHint: 'y = 4 / (x + 6) creates a rapid slide with decreasing slope.',
    launcher: {
      x: -7.0,
      y: 6.5,
      angle: -0.5,
      speed: 3.5,
      marbleCount: 6,
      releaseInterval: 0.2,
    },
    stars: [
      { id: 's1', x: -4, y: 1.8, radius: 0.45, collected: false },
      { id: 's2', x: -1, y: -1.5, radius: 0.45, collected: false },
      { id: 's3', x: 2, y: -3.0, radius: 0.45, collected: false },
      { id: 's4', x: 5, y: -3.8, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = 8 / (x + 8) - 4.5 { -7.5 < x < 6 }', color: '#10b981' },
    ],
    suggestedView: { centerX: -1, centerY: 0, scale: 21 },
  },

  // 13. Gravity Well - Celestial Orbit
  {
    id: 'level-13',
    number: 13,
    title: 'Gravity Slingshot',
    category: 'Obstacles & Portals',
    description: 'A heavy gravity well attracts nearby marbles, curving their trajectories into hyperbolic orbital arcs!',
    mathHint: 'Marbles drop above the attractor where gravitational pull curves their descent.',
    launcher: {
      x: -6.5,
      y: 5.5,
      angle: 0.05,
      speed: 6.0,
      marbleCount: 6,
      releaseInterval: 0.2,
    },
    gravityWells: [
      { id: 'gw1', x: 0, y: 0, strength: 160, radius: 5.5 },
    ],
    stars: [
      { id: 's1', x: 0, y: 2.8, radius: 0.45, collected: false },
      { id: 's2', x: 2.5, y: 0, radius: 0.45, collected: false },
      { id: 's3', x: 0, y: -2.8, radius: 0.45, collected: false },
      { id: 's4', x: -2.5, y: -0.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.2*x + 3.2 { -7 < x < -2 }', color: '#ec4899' },
    ],
    suggestedView: { centerX: 0, centerY: 0, scale: 21 },
  },

  // 14. Master - The Pinball Gauntlet
  {
    id: 'level-14',
    number: 14,
    title: 'The Gauntlet',
    category: 'Master Challenges',
    description: 'Bumpers, barriers, and narrow corridors! Guide your marbles through the gauntlet without getting blocked.',
    mathHint: 'Use piecewise lines or quadratic segments with exact domain boundaries.',
    launcher: {
      x: -7.5,
      y: 7.5,
      angle: -0.4,
      speed: 4.2,
      marbleCount: 8,
      releaseInterval: 0.2,
    },
    obstacles: [
      { id: 'ob1', x: -2, y: 2, width: 0.8, height: 4, color: '#ef4444' },
      { id: 'ob2', x: 3, y: -1, width: 0.8, height: 4, color: '#ef4444' },
    ],
    bumpers: [
      { id: 'bm1', x: -2, y: -2, radius: 0.7, bouncePower: 10, flashTimer: 0 },
    ],
    stars: [
      { id: 's1', x: -5, y: 2.5, radius: 0.45, collected: false },
      { id: 's2', x: -2, y: 4.8, radius: 0.45, collected: false },
      { id: 's3', x: 0.5, y: -1.0, radius: 0.45, collected: false },
      { id: 's4', x: 6, y: -2.5, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.7*x + 1 { -8 < x < -3 }', color: '#38bdf8' },
      { id: 'eq2', raw: 'y = 0.3*(x - 0.5)^2 - 3.5 { -1 < x < 7 }', color: '#a855f7' },
    ],
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 15. Master - Portal Loop
  {
    id: 'level-15',
    number: 15,
    title: 'Perpetual Portal Track',
    category: 'Master Challenges',
    description: 'Double portal routing! Loop from lower canyon to upper skyway to reach all 5 dispersed stars.',
    mathHint: 'Coordinate multiple curves with domain restrictions to catch marbles as they exit each portal.',
    launcher: {
      x: -7.5,
      y: 7.0,
      angle: -0.3,
      speed: 4.0,
      marbleCount: 8,
      releaseInterval: 0.22,
    },
    portals: [
      {
        id: 'p1',
        x1: 2,
        y1: -4,
        angle1: 0,
        x2: -6,
        y2: 2,
        angle2: 0,
        radius: 0.65,
      },
    ],
    stars: [
      { id: 's1', x: -4, y: 4, radius: 0.45, collected: false },
      { id: 's2', x: 0, y: -1.5, radius: 0.45, collected: false },
      { id: 's3', x: 1.5, y: -3.5, radius: 0.45, collected: false },
      { id: 's4', x: -2, y: 1.5, radius: 0.45, collected: false },
      { id: 's5', x: 5, y: 1.0, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.9*x - 1.5 { -8 < x < 1.5 }', color: '#06b6d4' },
      { id: 'eq2', raw: 'y = -0.2*x + 2.0 { -6 < x < 6 }', color: '#f59e0b' },
    ],
    suggestedView: { centerX: 0, centerY: 1, scale: 21 },
  },

  // 16. Master - Grand Master Finale
  {
    id: 'level-16',
    number: 16,
    title: 'Grand Master Symphony',
    category: 'Master Challenges',
    description: 'The ultimate Marbleslide challenge! Integrate curves, ramps, boosters, bumpers, and portals into a harmonious mathematical machine.',
    mathHint: 'Take it stage by stage. Watch the ghost trails to refine each equation and slider until every star is collected!',
    launcher: {
      x: -8.5,
      y: 8.5,
      angle: -0.4,
      speed: 4.5,
      marbleCount: 10,
      releaseInterval: 0.2,
    },
    boosters: [
      { id: 'b1', x: -1, y: -4, width: 3.0, height: 1.0, angle: 0.2, power: 25 },
    ],
    bumpers: [
      { id: 'bm1', x: 7, y: 1, radius: 0.7, bouncePower: 12, flashTimer: 0 },
    ],
    stars: [
      { id: 's1', x: -5, y: 3.5, radius: 0.45, collected: false },
      { id: 's2', x: -1, y: -3.0, radius: 0.45, collected: false },
      { id: 's3', x: 3, y: -1.0, radius: 0.45, collected: false },
      { id: 's4', x: 7, y: 4.5, radius: 0.45, collected: false },
      { id: 's5', x: 4, y: 6.0, radius: 0.45, collected: false },
    ],
    initialEquations: [
      { id: 'eq1', raw: 'y = -0.8*x + 0.5 { -9 < x < -2.5 }', color: '#38bdf8' },
      { id: 'eq2', raw: 'y = 0.15*(x + 1)^2 - 4.5 { -2.5 < x < 2.5 }', color: '#ec4899' },
      { id: 'eq3', raw: 'y = 0.5*x - 2.5 { 2.5 < x < 7 }', color: '#10b981' },
    ],
    suggestedView: { centerX: 0, centerY: 2, scale: 21 },
  },
];
