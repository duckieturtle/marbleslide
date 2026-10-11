// src/storage/storageManager.ts
// Robust local storage persistence for game snapshots, custom designs, and state

import { LevelDefinition } from '../levels/levelData';
import { Segment, Star, Bumper, Booster, Portal, GravityWell, Obstacle, Launcher } from '../physics/types';

export interface LevelDesignSnapshot {
  equations: Array<{ id: string; raw: string; color: string }>;
  sliders: Record<string, { value: number; min: number; max: number; step: number }>;
  drawnTracks?: Segment[][];
  camera?: { centerX: number; centerY: number; scale: number };
  launcher?: Launcher;
  stars?: Star[];
  obstacles?: Obstacle[];
  bumpers?: Bumper[];
  boosters?: Booster[];
  portals?: Portal[];
  gravityWells?: GravityWell[];
  savedAt: number;
}

export interface AppStateSnapshot {
  version: number;
  currentMode: 'levels' | 'sandbox' | 'draw' | 'play';
  currentLevelIndex: number;
  currentLevelId: string;
  theme?: string;
  designs: Record<string, LevelDesignSnapshot>;
  sandboxLevel?: LevelDefinition;
  updatedAt: number;
}

const STORAGE_KEY = 'marbleslide_snapshot_v1';

export class StorageManager {
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Load the entire application snapshot from localStorage
   */
  public static loadSnapshot(): AppStateSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as AppStateSnapshot;
      if (data && typeof data === 'object' && data.designs) {
        return data;
      }
    } catch (err) {
      console.warn('Failed to load MarbleSlide snapshot from localStorage:', err);
    }
    return null;
  }

  /**
   * Save the entire application snapshot to localStorage
   */
  public static saveSnapshotImmediate(snapshot: AppStateSnapshot): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      snapshot.updatedAt = Date.now();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('Failed to save MarbleSlide snapshot to localStorage:', err);
    }
  }

  /**
   * Debounced save to prevent excessive storage writes during rapid typing or dragging
   */
  public static saveSnapshotDebounced(snapshot: AppStateSnapshot, delayMs = 300): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveSnapshotImmediate(snapshot);
      this.saveTimeout = null;
    }, delayMs);
  }

  /**
   * Clear the saved snapshot for a specific level (revert to default)
   */
  public static clearLevelDesign(levelId: string): void {
    const snapshot = this.loadSnapshot();
    if (snapshot && snapshot.designs && snapshot.designs[levelId]) {
      delete snapshot.designs[levelId];
      this.saveSnapshotImmediate(snapshot);
    }
  }

  /**
   * Clear everything
   */
  public static clearAll(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear storage:', err);
    }
  }
}
