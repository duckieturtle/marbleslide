// src/physics/types.ts

export interface Vec2 {
  x: number;
  y: number;
}

export interface Marble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  angle: number;
  angularVelocity: number;
  color: string;
  glowColor: string;
  state: 'waiting' | 'in_barrel' | 'active' | 'out_of_bounds' | 'finished';
  trail: Vec2[];
  launchTime: number; // in seconds
  portalCooldown: number;
}

export interface Segment {
  p1: Vec2;
  p2: Vec2;
  thickness: number;
  color?: string;
  isCustomDraw?: boolean;
}

export interface Launcher {
  x: number;
  y: number;
  angle: number; // in radians, 0 is right, -Math.PI/2 is straight down
  speed: number;
  marbleCount: number;
  releaseInterval: number; // in seconds
}

export interface Star {
  id: string;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  collectedAtTime?: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  color?: string;
}

export interface Bumper {
  id: string;
  x: number;
  y: number;
  radius: number;
  bouncePower: number;
  flashTimer: number; // visual bounce feedback
}

export interface Booster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // direction of acceleration
  power: number;
}

export interface Portal {
  id: string;
  x1: number;
  y1: number;
  angle1: number;
  x2: number;
  y2: number;
  angle2: number;
  radius: number;
}

export interface GravityWell {
  id: string;
  x: number;
  y: number;
  strength: number; // positive = attractor, negative = repulsor
  radius: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
  shape?: 'circle' | 'star' | 'spark';
}

export interface PhysicsWorldState {
  marbles: Marble[];
  launcher: Launcher;
  stars: Star[];
  obstacles: Obstacle[];
  bumpers: Bumper[];
  boosters: Booster[];
  portals: Portal[];
  gravityWells: GravityWell[];
  segments: Segment[];
  particles: Particle[];
  ghostTrails: Vec2[][];
  simulationTime: number;
  isSimulating: boolean;
  allStarsCollected: boolean;
  starsCollectedCount: number;
}
