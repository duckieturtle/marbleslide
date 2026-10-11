// src/render/camera.ts
// Mathematical coordinate camera mapping Cartesian space to Screen Canvas

export class Camera {
  public centerX: number = 0;
  public centerY: number = 0;
  public scale: number = 22; // comfortable default pixels per unit (not zoomed in too close)
  public width: number = 800;
  public height: number = 600;

  // Zoom limits (allows wide bird's-eye view)
  public readonly minScale = 5;
  public readonly maxScale = 100;

  constructor(centerX = 0, centerY = 0, scale = 22) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.scale = scale;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.width / 2 + (wx - this.centerX) * this.scale,
      y: this.height / 2 - (wy - this.centerY) * this.scale,
    };
  }

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.centerX + (sx - this.width / 2) / this.scale,
      y: this.centerY - (sy - this.height / 2) / this.scale,
    };
  }

  public pan(deltaScreenX: number, deltaScreenY: number): void {
    this.centerX -= deltaScreenX / this.scale;
    this.centerY += deltaScreenY / this.scale;
  }

  public panWorld(deltaWorldX: number, deltaWorldY: number): void {
    this.centerX += deltaWorldX;
    this.centerY += deltaWorldY;
  }

  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    if (newScale === this.scale) return;

    this.scale = newScale;
    const worldAfter = this.screenToWorld(screenX, screenY);

    this.centerX += worldBefore.x - worldAfter.x;
    this.centerY += worldBefore.y - worldAfter.y;
  }

  public fitBounds(minX: number, maxX: number, minY: number, maxY: number, paddingFraction = 0.25): void {
    // Add margin around objects
    const marginX = Math.max(6, (maxX - minX) * 0.35);
    const marginY = Math.max(4, (maxY - minY) * 0.35);

    const spanX = Math.max(16, (maxX - minX) + marginX * 2);
    const spanY = Math.max(12, (maxY - minY) + marginY * 2);

    const availW = this.width * (1 - paddingFraction);
    const availH = this.height * (1 - paddingFraction);

    const scaleX = availW / spanX;
    const scaleY = availH / spanY;
    // Cap maximum scale at 24 so it is never zoomed too close
    const targetScale = Math.max(this.minScale, Math.min(24, Math.min(scaleX, scaleY)));

    this.scale = targetScale;
    this.centerX = (minX + maxX) / 2;
    this.centerY = (minY + maxY) / 2;
  }

  public getViewportWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.width, this.height);
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  }
}
