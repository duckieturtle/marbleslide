// src/editor/sandbox.ts
// Sandbox mode manager: object placement, manipulation, import/export, and share links

import { LevelDefinition } from '../levels/levelData';
import { Star, Bumper, Booster, Portal, GravityWell, Obstacle, Launcher } from '../physics/types';
import { Camera } from '../render/camera';

export type SandboxTool =
  | 'select'
  | 'add_star'
  | 'add_bumper'
  | 'add_booster'
  | 'add_portal'
  | 'add_obstacle'
  | 'add_gravity'
  | 'draw_ramp'
  | 'delete';

export class SandboxManager {
  public activeTool: SandboxTool = 'select';
  public pendingPortalA: { x: number; y: number } | null = null;
  public draggedObject: { type: string; id?: string; index?: number } | null = null;
  public dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  public handleCanvasClick(
    screenX: number,
    screenY: number,
    camera: Camera,
    level: LevelDefinition
  ): boolean {
    const world = camera.screenToWorld(screenX, screenY);
    const wx = Math.round(world.x * 2) / 2; // Snap to 0.5 grid increments for neat placement
    const wy = Math.round(world.y * 2) / 2;

    switch (this.activeTool) {
      case 'add_star': {
        const newStar: Star = {
          id: `star_${Date.now()}`,
          x: wx,
          y: wy,
          radius: 0.45,
          collected: false,
        };
        level.stars.push(newStar);
        return true;
      }

      case 'add_bumper': {
        if (!level.bumpers) level.bumpers = [];
        const newBumper: Bumper = {
          id: `bumper_${Date.now()}`,
          x: wx,
          y: wy,
          radius: 0.7,
          bouncePower: 11.0,
          flashTimer: 0,
        };
        level.bumpers.push(newBumper);
        return true;
      }

      case 'add_booster': {
        if (!level.boosters) level.boosters = [];
        const newBooster: Booster = {
          id: `booster_${Date.now()}`,
          x: wx,
          y: wy,
          width: 3.0,
          height: 1.0,
          angle: 0,
          power: 25.0,
        };
        level.boosters.push(newBooster);
        return true;
      }

      case 'add_obstacle': {
        if (!level.obstacles) level.obstacles = [];
        const newObs: Obstacle = {
          id: `obs_${Date.now()}`,
          x: wx,
          y: wy,
          width: 2.0,
          height: 2.0,
          color: '#ef4444',
        };
        level.obstacles.push(newObs);
        return true;
      }

      case 'add_portal': {
        if (!this.pendingPortalA) {
          this.pendingPortalA = { x: wx, y: wy };
          return true;
        } else {
          if (!level.portals) level.portals = [];
          const newPortal: Portal = {
            id: `portal_${Date.now()}`,
            x1: this.pendingPortalA.x,
            y1: this.pendingPortalA.y,
            angle1: 0,
            x2: wx,
            y2: wy,
            angle2: Math.PI,
            radius: 0.65,
          };
          level.portals.push(newPortal);
          this.pendingPortalA = null;
          return true;
        }
      }

      case 'add_gravity': {
        if (!level.gravityWells) level.gravityWells = [];
        const newWell: GravityWell = {
          id: `well_${Date.now()}`,
          x: wx,
          y: wy,
          strength: 150,
          radius: 5.5,
        };
        level.gravityWells.push(newWell);
        return true;
      }

      case 'delete': {
        return this.deleteAt(world.x, world.y, level);
      }

      default:
        return false;
    }
  }

  public deleteAt(wx: number, wy: number, level: LevelDefinition): boolean {
    const hitRadius = 1.0;

    // Check stars
    const starIdx = level.stars.findIndex(
      s => Math.hypot(s.x - wx, s.y - wy) < hitRadius
    );
    if (starIdx !== -1) {
      level.stars.splice(starIdx, 1);
      return true;
    }

    // Check bumpers
    if (level.bumpers) {
      const bIdx = level.bumpers.findIndex(
        b => Math.hypot(b.x - wx, b.y - wy) < hitRadius
      );
      if (bIdx !== -1) {
        level.bumpers.splice(bIdx, 1);
        return true;
      }
    }

    // Check boosters
    if (level.boosters) {
      const bIdx = level.boosters.findIndex(
        b => Math.hypot(b.x - wx, b.y - wy) < hitRadius * 1.5
      );
      if (bIdx !== -1) {
        level.boosters.splice(bIdx, 1);
        return true;
      }
    }

    // Check portals
    if (level.portals) {
      const pIdx = level.portals.findIndex(
        p => Math.hypot(p.x1 - wx, p.y1 - wy) < hitRadius || Math.hypot(p.x2 - wx, p.y2 - wy) < hitRadius
      );
      if (pIdx !== -1) {
        level.portals.splice(pIdx, 1);
        return true;
      }
    }

    // Check obstacles
    if (level.obstacles) {
      const oIdx = level.obstacles.findIndex(
        o => Math.hypot(o.x - wx, o.y - wy) < Math.max(o.width, o.height) / 2 + 0.5
      );
      if (oIdx !== -1) {
        level.obstacles.splice(oIdx, 1);
        return true;
      }
    }

    // Check gravity wells
    if (level.gravityWells) {
      const gIdx = level.gravityWells.findIndex(
        g => Math.hypot(g.x - wx, g.y - wy) < hitRadius
      );
      if (gIdx !== -1) {
        level.gravityWells.splice(gIdx, 1);
        return true;
      }
    }

    return false;
  }

  public exportLevelJSON(level: LevelDefinition): string {
    return JSON.stringify(level, null, 2);
  }

  public exportShareURL(level: LevelDefinition): string {
    try {
      const json = JSON.stringify(level);
      const b64 = btoa(encodeURIComponent(json));
      const url = new URL(window.location.href);
      url.hash = `level=${b64}`;
      return url.toString();
    } catch (e) {
      return window.location.href;
    }
  }

  public importFromShareHash(): LevelDefinition | null {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash;
    if (!hash.startsWith('#level=')) return null;

    try {
      const b64 = hash.replace('#level=', '');
      const json = decodeURIComponent(atob(b64));
      const parsed = JSON.parse(json) as LevelDefinition;
      if (parsed && parsed.launcher && Array.isArray(parsed.stars)) {
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to parse level from URL hash', err);
    }
    return null;
  }

  public getTemplates(): Record<string, LevelDefinition> {
    return {
      empty: {
        id: 'sandbox-empty',
        number: 0,
        title: 'Empty Canvas',
        category: 'Lines',
        description: 'Clean slate: place your own drop point, stars, obstacles, and build equations or draw ramps!',
        mathHint: 'Use the toolbar buttons to place elements, or click + to add equations.',
        launcher: {
          x: -6,
          y: 5,
          angle: -0.4,
          speed: 4.5,
          marbleCount: 6,
          releaseInterval: 0.2,
        },
        stars: [
          { id: 's1', x: -2, y: 1.5, radius: 0.45, collected: false },
          { id: 's2', x: 2, y: -0.5, radius: 0.45, collected: false },
          { id: 's3', x: 6, y: -2.5, radius: 0.45, collected: false },
        ],
        initialEquations: [
          { id: 'eq1', raw: 'y = -0.6*x + 1', color: '#38bdf8' },
        ],
        suggestedView: { centerX: 0, centerY: 1, scale: 35 },
      },
      pinball: {
        id: 'sandbox-pinball',
        number: 0,
        title: 'Pinball Playground',
        category: 'Obstacles & Portals',
        description: 'Bumper chaos! Tune angles to create chain-reaction ricochets.',
        mathHint: 'Bounce high off bumpers to clear obstacles.',
        launcher: {
          x: -7,
          y: 6,
          angle: -0.5,
          speed: 4.0,
          marbleCount: 8,
          releaseInterval: 0.18,
        },
        bumpers: [
          { id: 'b1', x: -3, y: 0, radius: 0.75, bouncePower: 11, flashTimer: 0 },
          { id: 'b2', x: 2, y: -1, radius: 0.75, bouncePower: 11, flashTimer: 0 },
          { id: 'b3', x: 5, y: 2, radius: 0.75, bouncePower: 11, flashTimer: 0 },
        ],
        stars: [
          { id: 's1', x: -3, y: 3, radius: 0.45, collected: false },
          { id: 's2', x: 2, y: 3.5, radius: 0.45, collected: false },
          { id: 's3', x: 5, y: 5.5, radius: 0.45, collected: false },
        ],
        initialEquations: [
          { id: 'eq1', raw: 'y = -0.8*x + 1 { -7 < x < -4 }', color: '#ec4899' },
        ],
        suggestedView: { centerX: 0, centerY: 2, scale: 32 },
      },
    };
  }
}
