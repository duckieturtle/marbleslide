// src/editor/trackDrawer.ts
// Freehand Ramp / Track Drawing with curve smoothing and segment generation

import { Vec2, Segment } from '../physics/types';
import { Camera } from '../render/camera';

export class TrackDrawer {
  public isDrawing: boolean = false;
  public currentStroke: Vec2[] = [];
  public completedTracks: Segment[][] = [];
  public trackColor: string = '#38bdf8';
  public thickness: number = 0.14;

  public startStroke(screenX: number, screenY: number, camera: Camera): void {
    this.isDrawing = true;
    const worldPt = camera.screenToWorld(screenX, screenY);
    this.currentStroke = [worldPt];
  }

  public addPoint(screenX: number, screenY: number, camera: Camera): void {
    if (!this.isDrawing) return;
    const worldPt = camera.screenToWorld(screenX, screenY);

    if (this.currentStroke.length > 0) {
      const last = this.currentStroke[this.currentStroke.length - 1];
      const dx = worldPt.x - last.x;
      const dy = worldPt.y - last.y;
      // Minimum distance threshold to avoid redundant points
      if (dx * dx + dy * dy < 0.08 * 0.08) return;
    }

    this.currentStroke.push(worldPt);
  }

  public endStroke(): Segment[] {
    if (!this.isDrawing || this.currentStroke.length < 2) {
      this.isDrawing = false;
      this.currentStroke = [];
      return [];
    }

    // Smooth stroke using moving average
    const smoothed = this.smoothPoints(this.currentStroke);

    // Convert into segments
    const newSegments: Segment[] = [];
    for (let i = 0; i < smoothed.length - 1; i++) {
      newSegments.push({
        p1: { x: smoothed[i].x, y: smoothed[i].y },
        p2: { x: smoothed[i + 1].x, y: smoothed[i + 1].y },
        thickness: this.thickness,
        color: this.trackColor,
        isCustomDraw: true,
      });
    }

    this.completedTracks.push(newSegments);
    this.isDrawing = false;
    this.currentStroke = [];

    return newSegments;
  }

  public undo(): Segment[] {
    if (this.completedTracks.length > 0) {
      this.completedTracks.pop();
    }
    return this.getAllSegments();
  }

  public clear(): void {
    this.completedTracks = [];
    this.currentStroke = [];
    this.isDrawing = false;
  }

  public getTracks(): Segment[][] {
    return JSON.parse(JSON.stringify(this.completedTracks));
  }

  public setTracks(tracks: Segment[][]): void {
    this.completedTracks = tracks ? JSON.parse(JSON.stringify(tracks)) : [];
  }

  public getAllSegments(): Segment[] {
    const all: Segment[] = [];
    for (const track of this.completedTracks) {
      all.push(...track);
    }
    return all;
  }

  private smoothPoints(pts: Vec2[]): Vec2[] {
    if (pts.length <= 2) return pts;
    const res: Vec2[] = [pts[0]];

    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      res.push({
        x: p0.x * 0.25 + p1.x * 0.5 + p2.x * 0.25,
        y: p0.y * 0.25 + p1.y * 0.5 + p2.y * 0.25,
      });
    }

    res.push(pts[pts.length - 1]);
    return res;
  }
}
