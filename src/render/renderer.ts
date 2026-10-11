// src/render/renderer.ts
// High-DPI Canvas Renderer for Marbleslide Cartesian Plane, Curves, Objects, and Effects

import { Camera } from './camera';
import { ThemeConfig } from './themes';
import { PhysicsEngine } from '../physics/engine';
import { Star, Bumper, Booster, Portal, GravityWell, Obstacle, Particle, Segment } from '../physics/types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  public camera: Camera;
  public theme: ThemeConfig;
  public showGhostTrails: boolean = true;
  public showCoordinates: boolean = true;
  public showGrid: boolean = true;

  constructor(canvas: HTMLCanvasElement, theme: ThemeConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;
    this.camera = new Camera();
    this.theme = theme;
  }

  public syncCanvasSize(): boolean {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const displayW = Math.max(1, Math.round(rect.width));
    const displayH = Math.max(1, Math.round(rect.height));
    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.camera.resize(displayW, displayH);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    return false;
  }

  public resize(): void {
    this.syncCanvasSize();
  }

  public render(physics: PhysicsEngine, now: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.syncCanvasSize();

    const ctx = this.ctx;
    const cam = this.camera;
    const theme = this.theme;

    // Enforce uniform 1:1 coordinate scaling matching device pixel ratio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cam.width, cam.height);

    // 1. Draw Background
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, cam.width, cam.height);

    // 2. Draw Mathematical Grid & Axes
    if (this.showGrid) {
      this.drawGridAndAxes();
    }

    // 3. Draw Static Gravity Wells
    this.drawGravityWells(physics.gravityWells, now);

    // 4. Draw Boosters
    this.drawBoosters(physics.boosters, now);

    // 5. Draw Portals
    this.drawPortals(physics.portals, now);

    // 6. Draw Obstacles
    this.drawObstacles(physics.obstacles);

    // 7. Draw Bumpers
    this.drawBumpers(physics.bumpers);

    // 8. Draw Ghost Trails (previous run trajectory history)
    if (this.showGhostTrails && physics.ghostTrails.length > 0) {
      this.drawGhostTrails(physics.ghostTrails);
    }

    // 9. Draw Function Curves & Custom Segments
    this.drawSegments(physics.segments);

    // 10. Draw Stars
    this.drawStars(physics.stars, now);

    // 11. Draw Ball Drop Point
    this.drawDropPoint(physics.launcher, physics.marbles, physics.isSimulating, now);

    // 12. Draw Active Marbles & Trails
    this.drawMarbles(physics);

    // 13. Draw Particle Effects
    this.drawParticles(physics.particles);
  }

  private drawGridAndAxes(): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const theme = this.theme;
    const bounds = cam.getViewportWorldBounds();

    // Determine grid step based on camera scale
    let step = 1;
    if (cam.scale < 18) step = 5;
    else if (cam.scale < 32) step = 2;
    else if (cam.scale > 80) step = 0.5;

    const startX = Math.floor(bounds.minX / step) * step;
    const endX = Math.ceil(bounds.maxX / step) * step;
    const startY = Math.floor(bounds.minY / step) * step;
    const endY = Math.ceil(bounds.maxY / step) * step;

    // Minor Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.gridMinor;
    ctx.beginPath();
    const subStep = step / 2;
    for (let x = startX; x <= endX; x += subStep) {
      const p = cam.worldToScreen(x, 0);
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, cam.height);
    }
    for (let y = startY; y <= endY; y += subStep) {
      const p = cam.worldToScreen(0, y);
      ctx.moveTo(0, p.y);
      ctx.lineTo(cam.width, p.y);
    }
    ctx.stroke();

    // Major Grid Lines
    ctx.strokeStyle = theme.gridMajor;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      const p = cam.worldToScreen(x, 0);
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, cam.height);
    }
    for (let y = startY; y <= endY; y += step) {
      const p = cam.worldToScreen(0, y);
      ctx.moveTo(0, p.y);
      ctx.lineTo(cam.width, p.y);
    }
    ctx.stroke();

    // Axes (x = 0, y = 0)
    const origin = cam.worldToScreen(0, 0);

    // In Doodle mode: Draw classic notebook red vertical margin line!
    if (theme.isDoodle) {
      const marginP = cam.worldToScreen(-10, 0);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)';
      ctx.beginPath();
      ctx.moveTo(marginP.x, 0);
      ctx.lineTo(marginP.x, cam.height);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.axis;
    ctx.beginPath();
    // X-axis
    ctx.moveTo(0, origin.y);
    ctx.lineTo(cam.width, origin.y);
    // Y-axis
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, cam.height);
    ctx.stroke();

    // Coordinate Numbers
    if (this.showCoordinates) {
      ctx.fillStyle = theme.axisNumbers;
      ctx.font = theme.isDoodle
        ? '13px "Patrick Hand", "Chalkboard SE", "Comic Sans MS", cursive, monospace'
        : '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelY = Math.max(16, Math.min(cam.height - 18, origin.y + 4));

      for (let x = startX; x <= endX; x += step) {
        if (Math.abs(x) < 0.001) continue;
        const p = cam.worldToScreen(x, 0);
        ctx.fillText(Number(x.toFixed(2)).toString(), p.x, labelY);
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelX = Math.max(28, Math.min(cam.width - 8, origin.x - 6));

      for (let y = startY; y <= endY; y += step) {
        if (Math.abs(y) < 0.001) continue;
        const p = cam.worldToScreen(0, y);
        ctx.fillText(Number(y.toFixed(2)).toString(), labelX, p.y);
      }

      // Draw (0,0) label
      ctx.fillText('0', origin.x - 6, origin.y + 12);
    }
  }

  private drawSegments(segments: Segment[]): void {
    if (segments.length === 0) return;
    const ctx = this.ctx;
    const cam = this.camera;

    // Group segments by color for batch rendering
    const groups = new Map<string, Segment[]>();
    for (const seg of segments) {
      const c = seg.color || this.theme.curveDefault;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(seg);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [rawColor, segs] of groups.entries()) {
      const color = (this.theme.isDoodle && (!rawColor || rawColor === '#38bdf8')) ? '#72b338' : rawColor;

      if (this.theme.isDoodle) {
        // Doodle Jump Platform Style: Cartoon green bouncy platform with solid dark outline
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(4, 0.14 * cam.scale + 3);
        ctx.strokeStyle = '#274e13'; // Dark cartoon outline
        ctx.beginPath();
        for (const seg of segs) {
          const s1 = cam.worldToScreen(seg.p1.x, seg.p1.y);
          const s2 = cam.worldToScreen(seg.p2.x, seg.p2.y);
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
        }
        ctx.stroke();

        // Inner platform body
        ctx.lineWidth = Math.max(2.5, 0.10 * cam.scale);
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (const seg of segs) {
          const s1 = cam.worldToScreen(seg.p1.x, seg.p1.y);
          const s2 = cam.worldToScreen(seg.p2.x, seg.p2.y);
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
        }
        ctx.stroke();

        // Platform top shine highlight
        ctx.lineWidth = Math.max(1, 0.03 * cam.scale);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        for (const seg of segs) {
          const s1 = cam.worldToScreen(seg.p1.x, seg.p1.y);
          const s2 = cam.worldToScreen(seg.p2.x, seg.p2.y);
          ctx.moveTo(s1.x, s1.y - 1);
          ctx.lineTo(s2.x, s2.y - 1);
        }
        ctx.stroke();
      } else {
        // Glow underlayer
        ctx.lineWidth = Math.max(3, 0.12 * cam.scale + 2);
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;

        ctx.beginPath();
        for (const seg of segs) {
          const s1 = cam.worldToScreen(seg.p1.x, seg.p1.y);
          const s2 = cam.worldToScreen(seg.p2.x, seg.p2.y);
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
        }
        ctx.stroke();

        // Sharp inner line
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(2, 0.08 * cam.scale);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        for (const seg of segs) {
          const s1 = cam.worldToScreen(seg.p1.x, seg.p1.y);
          const s2 = cam.worldToScreen(seg.p2.x, seg.p2.y);
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
        }
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;
  }

  private drawStars(stars: Star[], now: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const star of stars) {
      const sp = cam.worldToScreen(star.x, star.y);
      const r = star.radius * cam.scale;

      if (star.collected) {
        // Collected star: faint ghost ring
        ctx.strokeStyle = this.theme.isDoodle ? 'rgba(100, 116, 139, 0.35)' : 'rgba(251, 191, 36, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }

      // Pulsing effect
      const pulse = Math.sin(now * 0.005 + star.x * 2) * 0.15 + 1.0;
      const currentR = r * pulse;

      if (this.theme.isDoodle) {
        // Doodle Jump cartoon star with solid outline & sparkle highlight
        ctx.save();
        ctx.fillStyle = '#ffde59';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 4;
        this.drawStarPolygon(ctx, sp.x, sp.y, 5, currentR, currentR * 0.45, now * 0.001);
        ctx.fill();
        ctx.stroke();

        // Cute white sparkle highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sp.x - currentR * 0.2, sp.y - currentR * 0.22, currentR * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Glow halo
      ctx.save();
      const grad = ctx.createRadialGradient(sp.x, sp.y, currentR * 0.2, sp.x, sp.y, currentR * 2.2);
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.25)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, currentR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Golden Star Polygon
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;

      this.drawStarPolygon(ctx, sp.x, sp.y, 5, currentR, currentR * 0.45, now * 0.001);

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawStarPolygon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerR: number,
    innerR: number,
    rotation: number
  ): void {
    let rot = (Math.PI / 2) * 3 + rotation;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);

    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }

  private drawDropPoint(
    launcher: { x: number; y: number },
    marbles: Array<{ state: string; color: string; radius?: number }>,
    isSimulating: boolean,
    now: number
  ): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const lp = cam.worldToScreen(launcher.x, launcher.y);
    const waitingMarbles = marbles.filter(m => m.state === 'waiting');
    const waitingCount = waitingMarbles.length;
    const radius = 0.42 * cam.scale;

    ctx.save();

    // 1. Dashed drop zone indicator ring
    const ringColor = this.theme.isDoodle
      ? 'rgba(56, 97, 20, 0.75)'
      : 'rgba(168, 85, 247, 0.75)';
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = this.theme.isDoodle ? 2.5 : 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Downward drop cue indicator arrow
    const pulse = Math.sin(now * 0.007) * 3;
    const arrowY = lp.y + radius * 1.45 + pulse;
    ctx.fillStyle = ringColor;
    ctx.beginPath();
    ctx.moveTo(lp.x - 5, arrowY);
    ctx.lineTo(lp.x + 5, arrowY);
    ctx.lineTo(lp.x, arrowY + 6);
    ctx.closePath();
    ctx.fill();

    // 3. Waiting marble resting directly at the drop point
    if (waitingCount > 0) {
      const nextMarble = waitingMarbles[0];
      const mr = (nextMarble.radius || 0.28) * cam.scale;

      // Soft drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(lp.x, lp.y + mr * 0.35, mr * 0.85, mr * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D Spherical Radial Gradient
      const grad = ctx.createRadialGradient(
        lp.x - mr * 0.32,
        lp.y - mr * 0.32,
        mr * 0.08,
        lp.x,
        lp.y,
        mr
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, '#e2e8f0');
      grad.addColorStop(0.80, '#94a3b8');
      grad.addColorStop(1, '#334155');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, mr, 0, Math.PI * 2);
      ctx.fill();

      if (this.theme.isDoodle) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Remaining count badge (e.g. 6) above the marble
      if (waitingCount > 1) {
        const badgeText = `${waitingCount}`;
        ctx.font = 'bold 11px system-ui, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;
        const bw = Math.max(textWidth + 8, 18);
        const bh = 16;
        const bx = lp.x + mr * 0.65;
        const by = lp.y - mr * 0.8;

        ctx.fillStyle = this.theme.isDoodle ? '#4a7c1f' : '#6366f1';
        ctx.beginPath();
        ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx, by);
      }
    } else {
      // Crosshair drop center when all marbles are dropped
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lp.x - 5, lp.y);
      ctx.lineTo(lp.x + 5, lp.y);
      ctx.moveTo(lp.x, lp.y - 5);
      ctx.lineTo(lp.x, lp.y + 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawMarbles(physics: PhysicsEngine): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const m of physics.marbles) {
      if (m.state !== 'active') continue;

      const mp = cam.worldToScreen(m.x, m.y);
      const r = m.radius * cam.scale;

      // Draw Ribbon Trail (Neutral subtle trail)
      if (m.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = r * 0.7;

        ctx.beginPath();
        const startP = cam.worldToScreen(m.trail[0].x, m.trail[0].y);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < m.trail.length; i++) {
          const pt = cam.worldToScreen(m.trail[i].x, m.trail[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(mp.x, mp.y);
        ctx.stroke();
        ctx.restore();
      }

      // Marble Soft Drop Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y + r * 0.35, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Glow (Neutral reflection)
      ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
      ctx.shadowBlur = 4;

      // 3D Spherical Radial Gradient (Neutral / Silver steel ball - no color)
      const grad = ctx.createRadialGradient(
        mp.x - r * 0.32,
        mp.y - r * 0.32,
        r * 0.08,
        mp.x,
        mp.y,
        r
      );
      grad.addColorStop(0, '#ffffff'); // Specular highlight
      grad.addColorStop(0.35, '#e2e8f0'); // Neutral bright silver
      grad.addColorStop(0.80, '#94a3b8'); // Neutral slate / steel gray
      grad.addColorStop(1, '#334155'); // Deep ambient shadow

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Cartoon doodle outline on marbles
      if (this.theme.isDoodle) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private drawGhostTrails(trails: Array<Array<{ x: number; y: number }>>): void {
    const ctx = this.ctx;
    const cam = this.camera;

    ctx.save();
    ctx.strokeStyle = this.theme.ghostTrail;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);

    for (const trail of trails) {
      if (trail.length < 2) continue;
      ctx.beginPath();
      const p0 = cam.worldToScreen(trail[0].x, trail[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < trail.length; i++) {
        const pt = cam.worldToScreen(trail[i].x, trail[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawBumpers(bumpers: Bumper[]): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const b of bumpers) {
      const bp = cam.worldToScreen(b.x, b.y);
      const r = b.radius * cam.scale;

      const isFlashing = b.flashTimer > 0;

      ctx.save();

      // Outer Ripple if hit
      if (isFlashing) {
        ctx.strokeStyle = this.theme.isDoodle ? 'rgba(231, 76, 60, 0.8)' : 'rgba(236, 72, 153, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.theme.isDoodle) {
        // Doodle Jump Trampoline cushion!
        ctx.fillStyle = isFlashing ? '#ff7675' : '#d63031';
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner bouncy trampoline center
        ctx.fillStyle = '#fab1a0';
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
        continue;
      }

      // Bumper Base
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = isFlashing ? 18 : 6;
      ctx.fillStyle = isFlashing ? '#f472b6' : '#be185d';
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Mushroom Cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawBoosters(boosters: Booster[], now: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const b of boosters) {
      const bp = cam.worldToScreen(b.x, b.y);
      const w = b.width * cam.scale;
      const h = b.height * cam.scale;

      ctx.save();
      ctx.translate(bp.x, bp.y);
      ctx.rotate(-b.angle);

      // Translucent Booster Runway
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Animated Flowing Chevrons (>>>)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      const chevronSpacing = 24;
      const offset = (now * 0.06) % chevronSpacing;

      for (let cx = -w / 2 + offset; cx < w / 2; cx += chevronSpacing) {
        ctx.beginPath();
        ctx.moveTo(cx - 6, -h * 0.3);
        ctx.lineTo(cx + 4, 0);
        ctx.lineTo(cx - 6, h * 0.3);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawPortals(portals: Portal[], now: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const p of portals) {
      // Portal 1: Cyan/Blue
      this.drawPortalRing(ctx, cam, p.x1, p.y1, p.angle1, p.radius, '#06b6d4', '#38bdf8', now);
      // Portal 2: Amber/Orange
      this.drawPortalRing(ctx, cam, p.x2, p.y2, p.angle2, p.radius, '#ea580c', '#f97316', now + 100);
    }
  }

  private drawPortalRing(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    wx: number,
    wy: number,
    angle: number,
    radius: number,
    baseColor: string,
    accentColor: string,
    now: number
  ): void {
    const sp = cam.worldToScreen(wx, wy);
    const r = radius * cam.scale;

    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(-angle);

    // Swirling ellipse
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;

    const pulse = Math.sin(now * 0.006) * 0.1 + 1.0;
    ctx.fillStyle = baseColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.35 * pulse, r * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Event horizon core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.12, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawObstacles(obstacles: Obstacle[]): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const obs of obstacles) {
      const sp = cam.worldToScreen(obs.x, obs.y);
      const w = obs.width * cam.scale;
      const h = obs.height * cam.scale;
      const angle = obs.angle || 0;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(-angle);

      // Barrier Body
      ctx.fillStyle = obs.color || '#ef4444';
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 2;
      ctx.shadowColor = obs.color || '#ef4444';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();

      // Diagonal hazard stripes
      ctx.clip();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 4;
      const stripeSpacing = 16;
      for (let x = -w - h; x < w + h; x += stripeSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, -h);
        ctx.lineTo(x + h * 2, h);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawGravityWells(wells: GravityWell[], now: number): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const gw of wells) {
      const sp = cam.worldToScreen(gw.x, gw.y);
      const r = gw.radius * cam.scale;

      ctx.save();
      // Gravitational distortion ripples
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.lineWidth = 1.5;
      const rippleOffset = (now * 0.02) % 20;

      for (let cr = r; cr > 10; cr -= 20) {
        const ringR = Math.max(0, cr - rippleOffset);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Singularity core
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    const cam = this.camera;

    for (const p of particles) {
      const sp = cam.worldToScreen(p.x, p.y);
      const size = Math.max(2, p.size * cam.scale);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'star') {
        this.drawStarPolygon(ctx, sp.x, sp.y, 5, size, size * 0.45, 0);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
