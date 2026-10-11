// src/physics/engine.ts
// Continuous sub-stepped 2D rigid physics engine for MarbleSlide

import {
  Marble,
  Segment,
  Launcher,
  Star,
  Obstacle,
  Bumper,
  Booster,
  Portal,
  GravityWell,
  Particle,
  Vec2,
} from './types';

export interface PhysicsCallbacks {
  onMarbleLaunched?: (marble: Marble) => void;
  onStarCollected?: (star: Star, count: number) => void;
  onBumperHit?: (bumper: Bumper) => void;
  onPortalEnter?: (portal: Portal, fromIndex: 1 | 2) => void;
  onAllStarsCollected?: () => void;
}

const MARBLE_PALETTE = [
  { color: '#cbd5e1', glow: 'rgba(203, 213, 225, 0.4)' }, // Neutral silver steel
];

export class PhysicsEngine {
  public gravity: Vec2 = { x: 0, y: -12.5 };
  public marbles: Marble[] = [];
  public launcher: Launcher = {
    x: -6,
    y: 5,
    angle: -Math.PI / 4,
    speed: 4.5,
    marbleCount: 6,
    releaseInterval: 0.22,
  };
  public stars: Star[] = [];
  public obstacles: Obstacle[] = [];
  public bumpers: Bumper[] = [];
  public boosters: Booster[] = [];
  public portals: Portal[] = [];
  public gravityWells: GravityWell[] = [];
  public segments: Segment[] = [];
  public particles: Particle[] = [];
  public ghostTrails: Vec2[][] = [];

  public simulationTime: number = 0;
  public isSimulating: boolean = false;
  public allStarsCollected: boolean = false;
  public starsCollectedCount: number = 0;

  public callbacks: PhysicsCallbacks = {};

  // Bounds for marble despawn
  public bounds = {
    minX: -40,
    maxX: 40,
    minY: -30,
    maxY: 30,
  };

  constructor(callbacks?: PhysicsCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public resetSimulation(clearGhostTrails = false): void {
    if (!clearGhostTrails && this.marbles.length > 0) {
      // Record completed trajectories into ghost trails
      for (const m of this.marbles) {
        if (m.trail.length > 10) {
          // Downsample trail slightly for smooth rendering
          const sample = m.trail.filter((_, idx) => idx % 2 === 0);
          this.ghostTrails.push(sample);
        }
      }
      // Keep maximum 8 ghost trails
      if (this.ghostTrails.length > 8) {
        this.ghostTrails = this.ghostTrails.slice(this.ghostTrails.length - 8);
      }
    } else if (clearGhostTrails) {
      this.ghostTrails = [];
    }

    this.simulationTime = 0;
    this.isSimulating = false;
    this.allStarsCollected = false;
    this.starsCollectedCount = 0;

    // Reset stars
    for (const star of this.stars) {
      star.collected = false;
      delete star.collectedAtTime;
    }

    // Reset bumpers
    for (const b of this.bumpers) {
      b.flashTimer = 0;
    }

    // Initialize marbles in waiting state
    this.marbles = [];
    for (let i = 0; i < this.launcher.marbleCount; i++) {
      const palette = MARBLE_PALETTE[i % MARBLE_PALETTE.length];
      this.marbles.push({
        id: i,
        x: this.launcher.x,
        y: this.launcher.y,
        vx: 0,
        vy: 0,
        radius: 0.32,
        mass: 1.0,
        angle: 0,
        angularVelocity: 0,
        color: palette.color,
        glowColor: palette.glow,
        state: 'waiting',
        trail: [],
        launchTime: i * this.launcher.releaseInterval,
        portalCooldown: 0,
      });
    }

    this.particles = [];
  }

  public startSimulation(): void {
    this.resetSimulation();
    this.isSimulating = true;
  }

  public stopSimulation(): void {
    this.isSimulating = false;
  }

  public update(dt: number): void {
    // Update visual bumpers
    for (const b of this.bumpers) {
      if (b.flashTimer > 0) {
        b.flashTimer = Math.max(0, b.flashTimer - dt);
      }
    }

    // Update particles even if simulation stopped
    this.updateParticles(dt);

    if (!this.isSimulating) return;

    this.simulationTime += dt;

    // Release marbles based on launchTime (pure drop from above under gravity)
    for (const marble of this.marbles) {
      if (marble.state === 'waiting' && this.simulationTime >= marble.launchTime) {
        marble.state = 'active';
        marble.x = this.launcher.x;
        marble.y = this.launcher.y;
        marble.vx = 0;
        marble.vy = 0;
        marble.angularVelocity = 0;
        this.callbacks.onMarbleLaunched?.(marble);

        // Gentle drop sparkle at release point
        for (let p = 0; p < 6; p++) {
          const pAngle = Math.random() * Math.PI * 2;
          const pSpeed = Math.random() * 0.8 + 0.2;
          this.particles.push({
            x: marble.x,
            y: marble.y,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            color: marble.color,
            size: 0.08,
            life: 0.25,
            maxLife: 0.25,
            alpha: 0.7,
            shape: 'circle',
          });
        }
      }
    }

    // High precision sub-stepping
    const substeps = 10;
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      this.substep(subDt);
    }

    // Check bounds & track trajectory trails
    let anyActive = false;
    for (const m of this.marbles) {
      if (m.state === 'active') {
        anyActive = true;

        if (m.portalCooldown > 0) {
          m.portalCooldown = Math.max(0, m.portalCooldown - dt);
        }

        // Record trail
        if (m.trail.length === 0 || this.distanceSq(m, m.trail[m.trail.length - 1]) > 0.05 * 0.05) {
          m.trail.push({ x: m.x, y: m.y });
          if (m.trail.length > 300) {
            m.trail.shift();
          }
        }

        // Out of bounds check
        if (
          m.x < this.bounds.minX ||
          m.x > this.bounds.maxX ||
          m.y < this.bounds.minY ||
          m.y > this.bounds.maxY
        ) {
          m.state = 'out_of_bounds';
        }
      }
    }

    // Check if level solved
    if (!this.allStarsCollected && this.stars.length > 0) {
      const allDone = this.stars.every(st => st.collected);
      if (allDone) {
        this.allStarsCollected = true;
        this.callbacks.onAllStarsCollected?.();
      }
    }

    // Check if simulation should auto-finish if all marbles settled/out of bounds
    const allLaunched = this.marbles.every(m => m.state !== 'waiting');
    if (allLaunched && !anyActive) {
      // Simulation finished
      this.isSimulating = false;
    }
  }

  private substep(dt: number): void {
    // 1. Apply gravity & booster fields & gravity wells to active marbles
    for (const m of this.marbles) {
      if (m.state !== 'active') continue;

      // Base gravity
      m.vx += this.gravity.x * dt;
      m.vy += this.gravity.y * dt;

      // Gravity Wells
      for (const gw of this.gravityWells) {
        const dx = gw.x - m.x;
        const dy = gw.y - m.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        if (dist > 0.1 && dist < gw.radius) {
          const force = (gw.strength / Math.max(distSq, 1.0)) * dt;
          m.vx += (dx / dist) * force;
          m.vy += (dy / dist) * force;
        }
      }

      // Boosters
      for (const b of this.boosters) {
        // Point in oriented bounding box
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const cosB = Math.cos(-b.angle);
        const sinB = Math.sin(-b.angle);
        const localX = dx * cosB - dy * sinB;
        const localY = dx * sinB + dy * cosB;

        if (Math.abs(localX) <= b.width / 2 && Math.abs(localY) <= b.height / 2) {
          // Inside booster! Accelerate in booster angle
          const ax = Math.cos(b.angle) * b.power;
          const ay = Math.sin(b.angle) * b.power;
          m.vx += ax * dt;
          m.vy += ay * dt;

          // Spawn booster spark
          if (Math.random() < 0.3) {
            this.particles.push({
              x: m.x,
              y: m.y,
              vx: -Math.cos(b.angle) * 2 + (Math.random() - 0.5),
              vy: -Math.sin(b.angle) * 2 + (Math.random() - 0.5),
              color: '#38bdf8',
              size: 0.08,
              life: 0.2,
              maxLife: 0.2,
              alpha: 0.9,
              shape: 'spark',
            });
          }
        }
      }

      // Air resistance (subtle)
      const airFriction = 0.9995;
      m.vx *= airFriction;
      m.vy *= airFriction;
      m.angularVelocity *= 0.999;

      // Integrate position
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.angle += m.angularVelocity * dt;
    }

    // 2. Collisions with static segments (curves, custom drawn rails)
    for (const m of this.marbles) {
      if (m.state !== 'active') continue;

      for (const seg of this.segments) {
        this.resolveMarbleSegmentCollision(m, seg);
      }

      // Collisions with Obstacle boxes
      for (const obs of this.obstacles) {
        this.resolveMarbleObstacleCollision(m, obs);
      }

      // Collisions with Bumpers
      for (const b of this.bumpers) {
        this.resolveMarbleBumperCollision(m, b);
      }

      // Portal interactions
      for (const p of this.portals) {
        this.resolveMarblePortal(m, p);
      }

      // Star pickups
      for (const star of this.stars) {
        if (!star.collected) {
          const dx = m.x - star.x;
          const dy = m.y - star.y;
          const distSq = dx * dx + dy * dy;
          const collectDist = star.radius + m.radius + 0.15;
          if (distSq <= collectDist * collectDist) {
            star.collected = true;
            star.collectedAtTime = this.simulationTime;
            this.starsCollectedCount++;
            this.callbacks.onStarCollected?.(star, this.starsCollectedCount);
            this.spawnStarParticles(star.x, star.y);
          }
        }
      }
    }

    // 3. Inter-marble elastic collisions
    const activeMarbles = this.marbles.filter(m => m.state === 'active');
    for (let i = 0; i < activeMarbles.length; i++) {
      for (let j = i + 1; j < activeMarbles.length; j++) {
        this.resolveMarbleMarbleCollision(activeMarbles[i], activeMarbles[j]);
      }
    }
  }

  private resolveMarbleSegmentCollision(m: Marble, seg: Segment): void {
    const ax = seg.p1.x;
    const ay = seg.p1.y;
    const bx = seg.p2.x;
    const by = seg.p2.y;

    const abx = bx - ax;
    const aby = by - ay;
    const segLenSq = abx * abx + aby * aby;
    if (segLenSq < 1e-8) return;

    // Project marble center onto segment
    const apx = m.x - ax;
    const apy = m.y - ay;
    let t = (apx * abx + apy * aby) / segLenSq;
    t = Math.max(0, Math.min(1, t));

    const qx = ax + t * abx;
    const qy = ay + t * aby;

    const dx = m.x - qx;
    const dy = m.y - qy;
    const distSq = dx * dx + dy * dy;

    const effectiveRadius = m.radius + seg.thickness / 2;

    if (distSq < effectiveRadius * effectiveRadius) {
      const dist = Math.sqrt(distSq);
      let nx: number;
      let ny: number;

      if (dist > 1e-6) {
        nx = dx / dist;
        ny = dy / dist;
      } else {
        // Fallback: normal perpendicular to segment
        const segLen = Math.sqrt(segLenSq);
        nx = -aby / segLen;
        ny = abx / segLen;
      }

      // Penetration depth
      const penetration = effectiveRadius - dist;
      m.x += nx * penetration;
      m.y += ny * penetration;

      // Relative normal velocity
      const vn = m.vx * nx + m.vy * ny;
      if (vn < 0) {
        const restitution = 0.32; // Crisp marble bounce
        const jn = -(1 + restitution) * vn;

        // Tangent vector
        const tx = -ny;
        const ty = nx;
        const vt = m.vx * tx + m.vy * ty;

        // Friction and rolling torque
        const mu = 0.25;
        const jt = Math.max(-mu * jn, Math.min(mu * jn, vt * 0.4));

        m.vx += jn * nx - jt * tx;
        m.vy += jn * ny - jt * ty;

        // Angular velocity update from surface friction
        const inertia = 0.5 * m.mass * m.radius * m.radius;
        const torque = jt * m.radius;
        m.angularVelocity += torque / inertia;
      }
    }
  }

  private resolveMarbleObstacleCollision(m: Marble, obs: Obstacle): void {
    // Treat obstacle as oriented bounding box
    const angle = obs.angle || 0;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    const dx = m.x - obs.x;
    const dy = m.y - obs.y;

    const localX = dx * cosA - dy * sinA;
    const localY = dx * sinA + dy * cosA;

    const halfW = obs.width / 2;
    const halfH = obs.height / 2;

    // Closest point in local box
    const closestLocalX = Math.max(-halfW, Math.min(halfW, localX));
    const closestLocalY = Math.max(-halfH, Math.min(halfH, localY));

    const diffX = localX - closestLocalX;
    const diffY = localY - closestLocalY;
    const distSq = diffX * diffX + diffY * diffY;

    if (distSq < m.radius * m.radius) {
      const dist = Math.sqrt(distSq);
      let localNx: number;
      let localNy: number;

      if (dist > 1e-6) {
        localNx = diffX / dist;
        localNy = diffY / dist;
      } else {
        // Inside box, push out towards nearest edge
        const dLeft = localX + halfW;
        const dRight = halfW - localX;
        const dBottom = localY + halfH;
        const dTop = halfH - localY;
        const minEdge = Math.min(dLeft, dRight, dBottom, dTop);

        if (minEdge === dLeft) { localNx = -1; localNy = 0; }
        else if (minEdge === dRight) { localNx = 1; localNy = 0; }
        else if (minEdge === dBottom) { localNx = 0; localNy = -1; }
        else { localNx = 0; localNy = 1; }
      }

      // Convert normal back to world space
      const cosWorld = Math.cos(angle);
      const sinWorld = Math.sin(angle);
      const worldNx = localNx * cosWorld - localNy * sinWorld;
      const worldNy = localNx * sinWorld + localNy * cosWorld;

      const penetration = m.radius - dist;
      m.x += worldNx * penetration;
      m.y += worldNy * penetration;

      const vn = m.vx * worldNx + m.vy * worldNy;
      if (vn < 0) {
        const restitution = 0.5;
        const jn = -(1 + restitution) * vn;
        m.vx += jn * worldNx;
        m.vy += jn * worldNy;
      }
    }
  }

  private resolveMarbleBumperCollision(m: Marble, b: Bumper): void {
    const dx = m.x - b.x;
    const dy = m.y - b.y;
    const distSq = dx * dx + dy * dy;
    const minDist = m.radius + b.radius;

    if (distSq < minDist * minDist) {
      const dist = Math.max(1e-5, Math.sqrt(distSq));
      const nx = dx / dist;
      const ny = dy / dist;

      // Position correction
      const penetration = minDist - dist;
      m.x += nx * penetration;
      m.y += ny * penetration;

      // Energetic impulse
      const bounceSpeed = Math.max(b.bouncePower, Math.sqrt(m.vx * m.vx + m.vy * m.vy) * 1.3);
      m.vx = nx * bounceSpeed;
      m.vy = ny * bounceSpeed;

      b.flashTimer = 0.25;
      this.callbacks.onBumperHit?.(b);

      // Spark particles
      for (let p = 0; p < 10; p++) {
        const pAng = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.2;
        const pSpd = Math.random() * 4 + 2;
        this.particles.push({
          x: m.x,
          y: m.y,
          vx: Math.cos(pAng) * pSpd,
          vy: Math.sin(pAng) * pSpd,
          color: '#ec4899',
          size: 0.12,
          life: 0.35,
          maxLife: 0.35,
          alpha: 1.0,
          shape: 'spark',
        });
      }
    }
  }

  private resolveMarblePortal(m: Marble, p: Portal): void {
    if (m.portalCooldown > 0) return;

    // Check Portal 1 (Blue)
    const dx1 = m.x - p.x1;
    const dy1 = m.y - p.y1;
    if (dx1 * dx1 + dy1 * dy1 <= p.radius * p.radius) {
      // Enter Portal 1, teleport to Portal 2 (Orange)
      this.teleportMarble(m, p, 1);
      return;
    }

    // Check Portal 2 (Orange)
    const dx2 = m.x - p.x2;
    const dy2 = m.y - p.y2;
    if (dx2 * dx2 + dy2 * dy2 <= p.radius * p.radius) {
      // Enter Portal 2, teleport to Portal 1 (Blue)
      this.teleportMarble(m, p, 2);
      return;
    }
  }

  private teleportMarble(m: Marble, p: Portal, fromPortal: 1 | 2): void {
    const srcAngle = fromPortal === 1 ? p.angle1 : p.angle2;
    const dstAngle = fromPortal === 1 ? p.angle2 : p.angle1;
    const dstX = fromPortal === 1 ? p.x2 : p.x1;
    const dstY = fromPortal === 1 ? p.y2 : p.y1;

    // Rotate velocity relative to exit angle
    const speed = Math.max(3.0, Math.sqrt(m.vx * m.vx + m.vy * m.vy));
    const exitAngle = dstAngle;

    m.vx = Math.cos(exitAngle) * speed;
    m.vy = Math.sin(exitAngle) * speed;

    // Place slightly in front of destination portal to avoid immediate re-entry
    m.x = dstX + Math.cos(exitAngle) * (p.radius + m.radius + 0.1);
    m.y = dstY + Math.sin(exitAngle) * (p.radius + m.radius + 0.1);

    m.portalCooldown = 0.4;
    this.callbacks.onPortalEnter?.(p, fromPortal);

    // Spawn teleport sparkle aura
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 2.5 + 1;
      this.particles.push({
        x: m.x,
        y: m.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color: fromPortal === 1 ? '#f97316' : '#38bdf8',
        size: 0.1,
        life: 0.4,
        maxLife: 0.4,
        alpha: 0.9,
        shape: 'spark',
      });
    }
  }

  private resolveMarbleMarbleCollision(m1: Marble, m2: Marble): void {
    const dx = m1.x - m2.x;
    const dy = m1.y - m2.y;
    const distSq = dx * dx + dy * dy;
    const minDist = m1.radius + m2.radius;

    if (distSq < minDist * minDist && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;

      // Separate
      const overlap = minDist - dist;
      m1.x += nx * (overlap * 0.5);
      m1.y += ny * (overlap * 0.5);
      m2.x -= nx * (overlap * 0.5);
      m2.y -= ny * (overlap * 0.5);

      // Relative velocity
      const dvx = m1.vx - m2.vx;
      const dvy = m1.vy - m2.vy;
      const vn = dvx * nx + dvy * ny;

      if (vn < 0) {
        const restitution = 0.75;
        const impulse = -(1 + restitution) * vn * 0.5;
        m1.vx += impulse * nx;
        m1.vy += impulse * ny;
        m2.vx -= impulse * nx;
        m2.vy -= impulse * ny;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.vy += this.gravity.y * 0.25 * dt; // Light particle gravity
    }
  }

  private spawnStarParticles(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 4.5 + 2.0;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? '#fbbf24' : '#fef08a',
        size: Math.random() * 0.14 + 0.08,
        life: 0.6,
        maxLife: 0.6,
        alpha: 1.0,
        shape: 'star',
      });
    }
  }

  private distanceSq(p1: Vec2, p2: Vec2): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }
}
