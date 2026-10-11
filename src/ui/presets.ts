// src/ui/presets.ts

export interface PresetItem {
  title: string;
  category: string;
  formula: string;
  description: string;
}

export const PRESETS: PresetItem[] = [
  {
    title: 'Linear Slide',
    category: 'Lines',
    formula: 'y = -0.6*x + 2',
    description: 'Classic downhill ramp with steady slope.',
  },
  {
    title: 'Circle Loop',
    category: 'Conics',
    formula: 'x^2 + y^2 = 10',
    description: 'Full circular loop with radius sqrt(10).',
  },
  {
    title: 'Rotated Ellipse',
    category: 'Conics',
    formula: 'x^2 + xy + y^2 = 10',
    description: 'Tilted quadratic ellipse curve with cross term xy.',
  },
  {
    title: 'Hyperbola Double Branch',
    category: 'Conics',
    formula: 'x^2 - y^2 = 4',
    description: 'Opposing hyperbolic branches.',
  },
  {
    title: 'Folium of Descartes',
    category: 'Higher Order (Cubic)',
    formula: 'x^3 + y^3 = 3xy',
    description: '3rd-order cubic curve with an iconic teardrop loop.',
  },
  {
    title: 'Lemniscate of Bernoulli',
    category: 'Higher Order (Quartic)',
    formula: '(x^2 + y^2)^2 = 4(x^2 - y^2)',
    description: '4th-order figure-8 infinity loop.',
  },
  {
    title: 'Superellipse (Squircle)',
    category: 'Higher Order',
    formula: 'x^4 + y^4 = 16',
    description: '4th-order rounded square curve.',
  },
  {
    title: 'Mathematical Heart Curve',
    category: 'Higher Order',
    formula: '(x^2 + y^2 - 1)^3 = x^2 * y^3',
    description: '6th-order algebraic heart shape.',
  },
  {
    title: 'Sine-Cosine Wavefield',
    category: 'Transcendental',
    formula: 'sin(x) * cos(y) = 0.5',
    description: 'Nonlinear 2D periodic wave contour.',
  },
  {
    title: 'Parabola Halfpipe',
    category: 'Parabolas',
    formula: 'y = 0.2*x^2 - 3 { -5 < x < 5 }',
    description: 'Smooth symmetrical U-shaped valley bowl.',
  },
  {
    title: 'Ski Jump Kicker',
    category: 'Parabolas',
    formula: 'y = 0.18*(x + 3)^2 - 2 { -7 < x < -1 }',
    description: 'Curved approach that launches marbles airborne.',
  },
  {
    title: 'Sine Wave Coaster',
    category: 'Waves',
    formula: 'y = 1.8*sin(0.8*x)',
    description: 'Undulating sinusoidal coaster with peaks and dips.',
  },
];
