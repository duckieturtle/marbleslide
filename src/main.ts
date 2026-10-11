// src/main.ts
// Main Application Controller for MarbleSlide with enhanced intuitive navigation

import confetti from 'canvas-confetti';
import 'katex/dist/katex.min.css';
import { PhysicsEngine } from './physics/engine';
import { Renderer } from './render/renderer';
import { THEMES, ThemeId } from './render/themes';
import { soundManager } from './audio/soundManager';
import { LEVELS, LevelDefinition } from './levels/levelData';
import { EquationManager } from './ui/equationManager';
import { TrackDrawer } from './editor/trackDrawer';
import { SandboxManager, SandboxTool } from './editor/sandbox';
import { PRESETS } from './ui/presets';
import { renderMathHtml } from './math/latexRenderer';

type GameMode = 'levels' | 'sandbox' | 'draw';

class MarbleSlideApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private physics: PhysicsEngine;
  private eqManager: EquationManager;
  private trackDrawer: TrackDrawer;
  private sandbox: SandboxManager;

  private currentMode: GameMode = 'levels';
  private currentLevelIndex: number = 0;
  private currentLevel: LevelDefinition;
  private simSpeed: number = 1.0;

  // Pointer & Pan State
  private isPanning: boolean = false;
  private isDrawing: boolean = false;
  private isDraggingObject: boolean = false;
  private lastMousePos = { x: 0, y: 0 };

  // Touch State
  private touchStartDist: number = 0;

  private solvedLevels: Set<string> = new Set();
  private lastTime: number = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas element not found');

    // Load solved levels from LocalStorage
    try {
      const savedSolved = localStorage.getItem('marbleslide_solved');
      if (savedSolved) {
        this.solvedLevels = new Set(JSON.parse(savedSolved));
      }
    } catch (e) {}

    // Initialize Theme (Default to Doodle Jump style!)
    const savedTheme = localStorage.getItem('marbleslide_theme') as ThemeId;
    const theme = (savedTheme && savedTheme !== 'cyber' && THEMES[savedTheme]) ? THEMES[savedTheme] : THEMES.doodle;
    document.body.className = `theme-${theme.id}`;

    // Initialize Renderer & Physics
    this.renderer = new Renderer(this.canvas, theme);
    this.physics = new PhysicsEngine({
      onMarbleLaunched: () => soundManager.playLaunch(),
      onStarCollected: (_, count) => {
        soundManager.playStarCollect(count);
        this.updateStarCounterUI();
      },
      onBumperHit: () => soundManager.playBumper(),
      onPortalEnter: () => soundManager.playPortal(),
      onAllStarsCollected: () => this.handleLevelVictory(),
    });

    // Initialize Equation Manager
    const eqListEl = document.getElementById('equations-list')!;
    const slidersListEl = document.getElementById('sliders-list')!;
    this.eqManager = new EquationManager(eqListEl, slidersListEl);
    this.eqManager.onEquationsChanged = () => {
      this.syncPhysicsGeometry();
      this.updateEquationCountUI();
    };

    // Initialize Track Drawer & Sandbox
    this.trackDrawer = new TrackDrawer();
    this.sandbox = new SandboxManager();

    // Check URL hash for shared level
    const sharedLevel = this.sandbox.importFromShareHash();
    if (sharedLevel) {
      this.currentLevel = sharedLevel;
      this.currentMode = 'sandbox';
    } else {
      this.currentLevel = LEVELS[0];
    }

    this.setupEventListeners();
    this.setupNavigationUI();
    this.setupThemeSelector();
    this.setupPresetsModal();
    this.setupMobileUI();
    this.renderHelpCheatSheetMath();

    // ResizeObserver guarantees zero-skew pixel accuracy on all screens and orientation changes
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this.renderer.syncCanvasSize();
        this.syncPhysicsGeometry();
        this.updateZoomUI();
      });
      ro.observe(this.canvas);
    }

    // Load Initial Level
    if (this.currentMode === 'sandbox') {
      this.switchMode('sandbox');
      this.loadLevel(this.currentLevel);
    } else {
      this.loadLevelIndex(0);
    }

    // Start Animation Loop
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
    requestAnimationFrame(time => this.loop(time));
  }

  private handleResize(): void {
    this.renderer.syncCanvasSize();
    this.syncPhysicsGeometry();
    this.updateZoomUI();
  }

  private loop(time: number): void {
    if (this.lastTime === 0) this.lastTime = time;
    const deltaMs = Math.min(100, time - this.lastTime);
    this.lastTime = time;

    const dt = (deltaMs / 1000) * this.simSpeed;

    // Update Slider Animations
    this.eqManager.updateSlidersAnimation(dt);

    // Update Physics
    const wasSimulating = this.physics.isSimulating;
    this.physics.update(dt);
    if (wasSimulating && !this.physics.isSimulating) {
      this.updateSimulationStateUI(false);
    }

    // Render Scene
    this.renderer.render(this.physics, time);

    requestAnimationFrame(t => this.loop(t));
  }

  private loadLevelIndex(index: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    const lvl = LEVELS[this.currentLevelIndex];
    // Deep clone level template so changes don't mutate definition
    this.currentLevel = JSON.parse(JSON.stringify(lvl));
    this.loadLevel(this.currentLevel);
  }

  private loadLevel(level: LevelDefinition): void {
    // Stop and reset simulation
    this.physics.stopSimulation();

    // Populate Physics State from level
    this.physics.launcher = { ...level.launcher };
    this.physics.stars = level.stars.map(s => ({ ...s, collected: false }));
    this.physics.obstacles = level.obstacles ? level.obstacles.map(o => ({ ...o })) : [];
    this.physics.bumpers = level.bumpers ? level.bumpers.map(b => ({ ...b, flashTimer: 0 })) : [];
    this.physics.boosters = level.boosters ? level.boosters.map(b => ({ ...b })) : [];
    this.physics.portals = level.portals ? level.portals.map(p => ({ ...p })) : [];
    this.physics.gravityWells = level.gravityWells ? level.gravityWells.map(g => ({ ...g })) : [];

    // Populate Equations
    this.eqManager.setEquations(level.initialEquations, level.initialSliders);

    // Clear hand-drawn tracks
    this.trackDrawer.clear();

    // Auto-fit camera with wide, comfortable bird's eye view
    this.fitLevelCamera();

    // Reset physics marbles
    this.physics.resetSimulation(true);

    // Update UI Metadata
    this.updateLevelMetaUI();
    this.updateStarCounterUI();
    this.updateLevelDropdownSelection();
    this.updateZoomUI();
    this.updateEquationCountUI();

    // Reset collapsible objective and hint for new level to maximize screen estate
    document.getElementById('level-desc')?.classList.add('hidden');
    document.getElementById('btn-toggle-desc')?.classList.remove('active');
    document.getElementById('hint-content')?.classList.add('hidden');
    document.getElementById('btn-toggle-hint')?.classList.remove('active');
    this.updateSimulationStateUI(false);
  }

  private syncPhysicsGeometry(): void {
    // Generate equation curve segments
    const bounds = this.renderer.camera.getViewportWorldBounds();
    const xMin = Math.min(-35, bounds.minX - 6);
    const xMax = Math.max(35, bounds.maxX + 6);
    const yMin = Math.min(-30, bounds.minY - 6);
    const yMax = Math.max(30, bounds.maxY + 6);

    const eqSegments = this.eqManager.generateSegments(xMin, xMax, yMin, yMax);
    const drawnSegments = this.trackDrawer.getAllSegments();

    this.physics.segments = [...eqSegments, ...drawnSegments];
  }

  private updateStarCounterUI(): void {
    const total = this.physics.stars.length;
    const collected = this.physics.starsCollectedCount;
    const counterEl = document.getElementById('stars-counter');
    if (counterEl) {
      counterEl.textContent = `${collected} / ${total}`;
    }
  }

  private updateLevelMetaUI(): void {
    const titleEl = document.getElementById('level-title');
    const descEl = document.getElementById('level-desc');
    const catEl = document.getElementById('level-category');
    const hintTextEl = document.getElementById('hint-text');

    if (titleEl) titleEl.textContent = this.currentLevel.title;
    if (descEl) descEl.textContent = this.currentLevel.description;
    if (catEl) catEl.textContent = this.currentLevel.category || 'Lines';
    if (hintTextEl) hintTextEl.textContent = this.currentLevel.mathHint || 'Tune equations to hit stars!';
  }

  private updateLevelDropdownSelection(): void {
    const select = document.getElementById('level-select') as HTMLSelectElement;
    if (select) {
      select.value = String(this.currentLevelIndex);
    }
  }

  private updateZoomUI(): void {
    const readout = document.getElementById('zoom-readout');
    if (readout) {
      // Scale 21 is treated as 100% baseline zoom
      const pct = Math.round((this.renderer.camera.scale / 21) * 100);
      readout.textContent = `${pct}%`;
    }
  }

  private handleLevelVictory(): void {
    soundManager.playVictory();

    // Confetti explosion!
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#10b981'],
      });
    } catch (e) {}

    // Record solved status
    this.solvedLevels.add(this.currentLevel.id);
    localStorage.setItem('marbleslide_solved', JSON.stringify(Array.from(this.solvedLevels)));
    this.setupNavigationUI();

    // Show victory modal
    const modal = document.getElementById('victory-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  private switchMode(mode: GameMode): void {
    this.currentMode = mode;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`btn-mode-${mode}`);
    if (btn) btn.classList.add('active');
    const mBtn = document.getElementById(`m-btn-mode-${mode}`);
    if (mBtn) mBtn.classList.add('active');

    const levelNav = document.getElementById('level-nav-container');
    const sandboxNav = document.getElementById('sandbox-nav-container');
    const sandboxTools = document.getElementById('sandbox-tools-panel');
    const drawTools = document.getElementById('draw-tools-panel');

    this.canvas.classList.remove('drawing', 'grabbing');

    if (mode === 'levels') {
      levelNav?.classList.remove('hidden');
      sandboxNav?.classList.add('hidden');
      sandboxTools?.classList.add('hidden');
      drawTools?.classList.add('hidden');
      this.loadLevelIndex(this.currentLevelIndex);
    } else if (mode === 'sandbox') {
      levelNav?.classList.add('hidden');
      sandboxNav?.classList.remove('hidden');
      sandboxTools?.classList.remove('hidden');
      drawTools?.classList.add('hidden');
    } else if (mode === 'draw') {
      levelNav?.classList.remove('hidden');
      sandboxNav?.classList.add('hidden');
      sandboxTools?.classList.add('hidden');
      drawTools?.classList.remove('hidden');
      this.canvas.classList.add('drawing');
    }
  }

  private setupNavigationUI(): void {
    const select = document.getElementById('level-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '';
    LEVELS.forEach((lvl, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const isSolved = this.solvedLevels.has(lvl.id);
      opt.textContent = `${isSolved ? '⭐ ' : ''}Level ${lvl.number}: ${lvl.title}`;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      this.loadLevelIndex(parseInt(select.value, 10));
    });

    document.getElementById('btn-prev-level')?.addEventListener('click', () => {
      if (this.currentLevelIndex > 0) this.loadLevelIndex(this.currentLevelIndex - 1);
    });

    document.getElementById('btn-next-level')?.addEventListener('click', () => {
      if (this.currentLevelIndex < LEVELS.length - 1) this.loadLevelIndex(this.currentLevelIndex + 1);
    });

    // Mode Buttons
    document.getElementById('btn-mode-levels')?.addEventListener('click', () => this.switchMode('levels'));
    document.getElementById('btn-mode-sandbox')?.addEventListener('click', () => {
      this.switchMode('sandbox');
      const templates = this.sandbox.getTemplates();
      this.currentLevel = JSON.parse(JSON.stringify(templates.empty));
      this.loadLevel(this.currentLevel);
    });
    document.getElementById('btn-mode-draw')?.addEventListener('click', () => this.switchMode('draw'));
  }

  private setupThemeSelector(): void {
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    if (!themeSelect) return;

    themeSelect.value = this.renderer.theme.id;
    themeSelect.addEventListener('change', () => {
      const nextId = themeSelect.value as ThemeId;
      const theme = THEMES[nextId] || THEMES.doodle;
      this.renderer.theme = theme;
      document.body.className = `theme-${theme.id}`;
      localStorage.setItem('marbleslide_theme', theme.id);
      const mThemeSelect = document.getElementById('m-theme-select') as HTMLSelectElement;
      if (mThemeSelect) mThemeSelect.value = nextId;
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    if (soundBtn && soundIcon) {
      soundIcon.textContent = soundManager.getIsMuted() ? '🔇' : '🔊';
      soundBtn.addEventListener('click', () => {
        const muted = soundManager.toggleMute();
        soundIcon.textContent = muted ? '🔇' : '🔊';
      });
    }
  }

  private openPresetsModal(): void {
    const presetModal = document.getElementById('preset-modal');
    presetModal?.classList.remove('hidden');
  }

  private handleAddEquation(): void {
    this.ensureEquationsVisibleOnMobile();
    this.eqManager.addEquation();
    this.updateEquationCountUI();
  }

  private ensureEquationsVisibleOnMobile(): void {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.scrollIntoView({ behavior: 'smooth' });
    }
    this.renderer.syncCanvasSize();
    this.syncPhysicsGeometry();
  }

  private updateEquationCountUI(): void {
    const count = this.eqManager.items.length;
    const headerBadge = document.getElementById('eq-count-badge');
    if (headerBadge) headerBadge.textContent = `${count}`;
  }

  private setupPresetsModal(): void {
    const presetModal = document.getElementById('preset-modal');
    const container = document.getElementById('presets-container');
    if (!presetModal || !container) return;

    document.getElementById('btn-add-preset')?.addEventListener('click', () => {
      this.openPresetsModal();
    });

    document.getElementById('btn-close-preset')?.addEventListener('click', () => {
      presetModal.classList.add('hidden');
    });

    container.innerHTML = '';
    PRESETS.forEach(p => {
      const item = document.createElement('div');
      item.className = 'preset-card-item';
      item.innerHTML = `
        <div class="preset-title">${p.title}</div>
        <div class="preset-formula">${renderMathHtml(p.formula)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${p.description}</div>
      `;
      item.addEventListener('click', () => {
        this.ensureEquationsVisibleOnMobile();
        this.eqManager.addEquation(p.formula);
        this.updateEquationCountUI();
        presetModal.classList.add('hidden');
      });
      container.appendChild(item);
    });
  }

  private setupMobileUI(): void {
    // 1. Desktop Sidebar Collapse Toggle
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('btn-collapse-sidebar');
    const expandBtn = document.getElementById('btn-expand-sidebar');

    const toggleDesktopSidebar = () => {
      if (!sidebar) return;
      const isCollapsed = sidebar.classList.toggle('collapsed');
      expandBtn?.classList.toggle('hidden', !isCollapsed);
      this.renderer.syncCanvasSize();
      this.syncPhysicsGeometry();
    };

    collapseBtn?.addEventListener('click', toggleDesktopSidebar);
    expandBtn?.addEventListener('click', toggleDesktopSidebar);

    // 2. Mobile Menu Modal Toggle
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const mobileMenuModal = document.getElementById('mobile-menu-modal');
    const closeMobileMenuBtn = document.getElementById('btn-close-mobile-menu');

    mobileMenuBtn?.addEventListener('click', () => {
      mobileMenuModal?.classList.remove('hidden');
    });

    closeMobileMenuBtn?.addEventListener('click', () => {
      mobileMenuModal?.classList.add('hidden');
    });

    // Mobile Game Mode buttons
    document.getElementById('m-btn-mode-levels')?.addEventListener('click', () => {
      this.switchMode('levels');
      mobileMenuModal?.classList.add('hidden');
    });

    document.getElementById('m-btn-mode-sandbox')?.addEventListener('click', () => {
      this.switchMode('sandbox');
      const templates = this.sandbox.getTemplates();
      this.currentLevel = JSON.parse(JSON.stringify(templates.empty));
      this.loadLevel(this.currentLevel);
      mobileMenuModal?.classList.add('hidden');
    });

    document.getElementById('m-btn-mode-draw')?.addEventListener('click', () => {
      this.switchMode('draw');
      mobileMenuModal?.classList.add('hidden');
    });

    // Mobile Theme Selector
    const mThemeSelect = document.getElementById('m-theme-select') as HTMLSelectElement;
    if (mThemeSelect) {
      mThemeSelect.value = this.renderer.theme.id;
      mThemeSelect.addEventListener('change', () => {
        const nextId = mThemeSelect.value as ThemeId;
        const theme = THEMES[nextId] || THEMES.doodle;
        this.renderer.theme = theme;
        document.body.className = `theme-${theme.id}`;
        localStorage.setItem('marbleslide_theme', theme.id);
        const mainThemeSelect = document.getElementById('theme-select') as HTMLSelectElement;
        if (mainThemeSelect) mainThemeSelect.value = nextId;
      });
    }

    // Mobile Help Button
    document.getElementById('m-btn-help')?.addEventListener('click', () => {
      mobileMenuModal?.classList.add('hidden');
      document.getElementById('help-modal')?.classList.remove('hidden');
    });
  }

  private updateSimulationStateUI(running: boolean): void {
    const launchBtn = document.getElementById('btn-launch');
    if (launchBtn) {
      launchBtn.classList.toggle('simulating', running);
      const textEl = launchBtn.querySelector('.btn-text');
      if (textEl) textEl.textContent = running ? 'PAUSE' : 'LAUNCH';
      const iconEl = launchBtn.querySelector('.play-icon');
      if (iconEl) iconEl.textContent = running ? '⏸' : '▶';
    }
  }

  private renderHelpCheatSheetMath(): void {
    document.querySelectorAll('.cheat-item code').forEach(codeEl => {
      const formula = codeEl.textContent?.trim();
      if (formula) {
        codeEl.innerHTML = renderMathHtml(formula);
      }
    });
  }

  private setupEventListeners(): void {
    // Single, Prominent Launch & Reset Controls (Canvas Playback Bar)
    const launchActions = () => {
      if (this.physics.isSimulating) {
        this.physics.stopSimulation();
        this.updateSimulationStateUI(false);
      } else {
        this.syncPhysicsGeometry();
        this.physics.startSimulation();
        this.updateStarCounterUI();
        this.updateSimulationStateUI(true);
      }
    };

    const resetActions = () => {
      this.physics.resetSimulation();
      this.updateStarCounterUI();
      this.updateSimulationStateUI(false);
    };

    document.getElementById('btn-launch')?.addEventListener('click', launchActions);
    document.getElementById('btn-reset')?.addEventListener('click', resetActions);

    // Simulation Speed Selector
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        const spd = parseFloat((e.target as HTMLElement).dataset.speed || '1.0');
        this.simSpeed = spd;
      });
    });

    // --- NAVIGATION CONTROLS ---
    // Fit View
    document.getElementById('btn-fit-view')?.addEventListener('click', () => {
      this.fitLevelCamera();
    });

    // Zoom In / Out Buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.renderer.camera.zoomAt(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, 1.25);
      this.updateZoomUI();
      this.syncPhysicsGeometry();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.renderer.camera.zoomAt(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2, 0.8);
      this.updateZoomUI();
      this.syncPhysicsGeometry();
    });

    // D-Pad Pan Buttons
    document.getElementById('btn-pan-left')?.addEventListener('click', () => {
      this.renderer.camera.panWorld(-3.5, 0);
      this.syncPhysicsGeometry();
    });
    document.getElementById('btn-pan-right')?.addEventListener('click', () => {
      this.renderer.camera.panWorld(3.5, 0);
      this.syncPhysicsGeometry();
    });
    document.getElementById('btn-pan-up')?.addEventListener('click', () => {
      this.renderer.camera.panWorld(0, 3.5);
      this.syncPhysicsGeometry();
    });
    document.getElementById('btn-pan-down')?.addEventListener('click', () => {
      this.renderer.camera.panWorld(0, -3.5);
      this.syncPhysicsGeometry();
    });

    const trailsBtn = document.getElementById('btn-toggle-trails');
    trailsBtn?.addEventListener('click', () => {
      this.renderer.showGhostTrails = !this.renderer.showGhostTrails;
      trailsBtn.classList.toggle('active', this.renderer.showGhostTrails);
    });

    // Add equation button
    document.getElementById('btn-add-equation')?.addEventListener('click', () => {
      this.handleAddEquation();
    });

    // Hint toggle
    document.getElementById('btn-toggle-hint')?.addEventListener('click', () => {
      const content = document.getElementById('hint-content');
      const btn = document.getElementById('btn-toggle-hint');
      if (content) {
        const isHidden = content.classList.contains('hidden');
        content.classList.toggle('hidden', !isHidden);
        btn?.classList.toggle('active', isHidden);
      }
    });

    // Objective / Info toggle
    document.getElementById('btn-toggle-desc')?.addEventListener('click', () => {
      const desc = document.getElementById('level-desc');
      const btn = document.getElementById('btn-toggle-desc');
      if (desc) {
        const isHidden = desc.classList.contains('hidden');
        desc.classList.toggle('hidden', !isHidden);
        btn?.classList.toggle('active', isHidden);
      }
    });

    // Draw Tool Controls
    const drawColorInput = document.getElementById('draw-color-picker') as HTMLInputElement;
    drawColorInput?.addEventListener('input', () => {
      this.trackDrawer.trackColor = drawColorInput.value;
    });

    document.getElementById('btn-draw-undo')?.addEventListener('click', () => {
      this.trackDrawer.undo();
      this.syncPhysicsGeometry();
    });

    document.getElementById('btn-draw-clear')?.addEventListener('click', () => {
      this.trackDrawer.clear();
      this.syncPhysicsGeometry();
    });

    // Sandbox Tool Selector
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const el = (e.currentTarget as HTMLElement);
        el.classList.add('active');
        const tool = el.dataset.tool as SandboxTool;
        this.sandbox.activeTool = tool;

        const instruction = document.getElementById('tool-instruction');
        if (instruction) {
          if (tool === 'select') instruction.textContent = 'Drag ball drop point, stars, or obstacles to move.';
          else if (tool === 'add_portal') instruction.textContent = 'Click to place Portal A, then click to place Portal B.';
          else if (tool === 'delete') instruction.textContent = 'Click on any object to remove it.';
          else instruction.textContent = `Click anywhere on the grid to place ${tool.replace('add_', '')}.`;
        }
      });
    });

    // Sandbox Templates
    const tplSelect = document.getElementById('sandbox-template-select') as HTMLSelectElement;
    tplSelect?.addEventListener('change', () => {
      const templates = this.sandbox.getTemplates();
      const chosen = templates[tplSelect.value];
      if (chosen) {
        this.currentLevel = JSON.parse(JSON.stringify(chosen));
        this.loadLevel(this.currentLevel);
      }
    });

    // Share link button
    document.getElementById('btn-share-level')?.addEventListener('click', () => {
      const url = this.sandbox.exportShareURL(this.currentLevel);
      navigator.clipboard.writeText(url).then(() => {
        alert('Shareable Level URL copied to clipboard!');
      }).catch(() => {
        prompt('Copy your level URL:', url);
      });
    });

    // Export / Import JSON
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const json = this.sandbox.exportLevelJSON(this.currentLevel);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.currentLevel.title.toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
    });

    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = ev => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = re => {
          try {
            const parsed = JSON.parse(re.target?.result as string);
            this.currentLevel = parsed;
            this.loadLevel(this.currentLevel);
          } catch (e) {
            alert('Invalid level JSON file.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Modals (Victory, Help)
    document.getElementById('btn-help')?.addEventListener('click', () => {
      document.getElementById('help-modal')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      document.getElementById('help-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-replay')?.addEventListener('click', () => {
      document.getElementById('victory-modal')?.classList.add('hidden');
      this.physics.resetSimulation();
      this.updateStarCounterUI();
    });

    document.getElementById('btn-next-level-modal')?.addEventListener('click', () => {
      document.getElementById('victory-modal')?.classList.add('hidden');
      if (this.currentLevelIndex < LEVELS.length - 1) {
        this.loadLevelIndex(this.currentLevelIndex + 1);
      }
    });

    // Prevent default context menu
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // --- CANVAS POINTER INTERACTIONS (MOUSE & DRAG) ---
    this.canvas.addEventListener('mousedown', e => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.lastMousePos = { x: sx, y: sy };

      // Right-click or Middle-click: Always Pan
      if (e.button === 2 || e.button === 1) {
        this.isPanning = true;
        this.canvas.classList.add('grabbing');
        return;
      }

      // Left-click behavior depends on mode:
      if (this.currentMode === 'draw') {
        this.isDrawing = true;
        this.trackDrawer.startStroke(sx, sy, this.renderer.camera);
      } else if (this.currentMode === 'sandbox') {
        if (this.sandbox.activeTool === 'select') {
          // Check if clicking near launcher or objects to drag
          const world = this.renderer.camera.screenToWorld(sx, sy);
          const distL = Math.hypot(world.x - this.physics.launcher.x, world.y - this.physics.launcher.y);
          if (distL < 1.2) {
            this.isDraggingObject = true;
            this.sandbox.draggedObject = { type: 'launcher' };
            this.canvas.classList.add('grabbing');
          } else {
            // Panning on empty space
            this.isPanning = true;
            this.canvas.classList.add('grabbing');
          }
        } else {
          // Placement tool click
          const handled = this.sandbox.handleCanvasClick(sx, sy, this.renderer.camera, this.currentLevel);
          if (handled) {
            this.loadLevel(this.currentLevel);
          }
        }
      } else {
        // Levels Mode: PRIMARY LEFT-CLICK DRAG PANS THE CAMERA!
        this.isPanning = true;
        this.canvas.classList.add('grabbing');
      }
    });

    window.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Update Coordinates Readout
      const world = this.renderer.camera.screenToWorld(sx, sy);
      const readout = document.getElementById('coords-readout');
      if (readout) {
        readout.textContent = `x: ${world.x.toFixed(2)}, y: ${world.y.toFixed(2)}`;
      }

      // Pan Camera smoothly with mouse movement
      if (this.isPanning) {
        const dx = sx - this.lastMousePos.x;
        const dy = sy - this.lastMousePos.y;
        this.renderer.camera.pan(dx, dy);
        this.lastMousePos = { x: sx, y: sy };
        this.syncPhysicsGeometry();
        return;
      }

      // Handle Freehand Draw
      if (this.isDrawing && this.currentMode === 'draw') {
        this.trackDrawer.addPoint(sx, sy, this.renderer.camera);
        this.syncPhysicsGeometry();
        return;
      }

      // Handle Dragging in Sandbox
      if (this.isDraggingObject && this.sandbox.draggedObject) {
        if (this.sandbox.draggedObject.type === 'launcher') {
          this.currentLevel.launcher.x = Math.round(world.x * 2) / 2;
          this.currentLevel.launcher.y = Math.round(world.y * 2) / 2;
          this.physics.launcher.x = this.currentLevel.launcher.x;
          this.physics.launcher.y = this.currentLevel.launcher.y;
          this.physics.resetSimulation();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDrawing && this.currentMode === 'draw') {
        this.trackDrawer.endStroke();
        this.syncPhysicsGeometry();
      }
      this.isPanning = false;
      this.isDrawing = false;
      this.isDraggingObject = false;
      this.sandbox.draggedObject = null;
      this.canvas.classList.remove('grabbing');
    });

    // --- TOUCH INTERACTIONS (MOBILE / TRACKPAD TOUCH) ---
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const sx = t.clientX - rect.left;
        const sy = t.clientY - rect.top;
        this.lastMousePos = { x: sx, y: sy };

        if (this.currentMode === 'draw') {
          this.isDrawing = true;
          this.trackDrawer.startStroke(sx, sy, this.renderer.camera);
        } else {
          this.isPanning = true;
          this.canvas.classList.add('grabbing');
        }
      } else if (e.touches.length === 2) {
        // Pinch-to-zoom start
        this.isPanning = false;
        this.isDrawing = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchStartDist = Math.hypot(dx, dy);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault(); // prevent page bounce

      if (e.touches.length === 1 && (this.isPanning || this.isDrawing)) {
        const t = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const sx = t.clientX - rect.left;
        const sy = t.clientY - rect.top;

        if (this.isPanning) {
          const dx = sx - this.lastMousePos.x;
          const dy = sy - this.lastMousePos.y;
          this.renderer.camera.pan(dx, dy);
          this.lastMousePos = { x: sx, y: sy };
          this.syncPhysicsGeometry();
        } else if (this.isDrawing && this.currentMode === 'draw') {
          this.trackDrawer.addPoint(sx, sy, this.renderer.camera);
          this.syncPhysicsGeometry();
        }
      } else if (e.touches.length === 2 && this.touchStartDist > 0) {
        // Pinch-to-zoom move
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / this.touchStartDist;

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = this.canvas.getBoundingClientRect();

        this.renderer.camera.zoomAt(midX - rect.left, midY - rect.top, factor);
        this.touchStartDist = dist;
        this.updateZoomUI();
        this.syncPhysicsGeometry();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.isPanning = false;
      this.isDrawing = false;
      this.touchStartDist = 0;
      this.canvas.classList.remove('grabbing');
    });

    // Zoom on Wheel
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.renderer.camera.zoomAt(sx, sy, factor);
      this.updateZoomUI();
      this.syncPhysicsGeometry();
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', e => {
      // Ignore if typing inside input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.physics.isSimulating) {
          this.physics.stopSimulation();
          this.updateSimulationStateUI(false);
        } else {
          this.syncPhysicsGeometry();
          this.physics.startSimulation();
          this.updateStarCounterUI();
          this.updateSimulationStateUI(true);
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.physics.resetSimulation();
        this.updateStarCounterUI();
        this.updateSimulationStateUI(false);
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        this.renderer.showGhostTrails = !this.renderer.showGhostTrails;
        document.getElementById('btn-toggle-trails')?.classList.toggle('active', this.renderer.showGhostTrails);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        this.fitLevelCamera();
      } else if (e.code === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    });
  }

  private fitLevelCamera(): void {
    const stars = this.physics.stars;
    const launcher = this.physics.launcher;

    let minX = launcher.x;
    let maxX = launcher.x;
    let minY = launcher.y;
    let maxY = launcher.y;

    for (const s of stars) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }

    for (const obs of this.physics.obstacles) {
      minX = Math.min(minX, obs.x - obs.width / 2);
      maxX = Math.max(maxX, obs.x + obs.width / 2);
      minY = Math.min(minY, obs.y - obs.height / 2);
      maxY = Math.max(maxY, obs.y + obs.height / 2);
    }

    for (const b of this.physics.bumpers) {
      minX = Math.min(minX, b.x - b.radius);
      maxX = Math.max(maxX, b.x + b.radius);
      minY = Math.min(minY, b.y - b.radius);
      maxY = Math.max(maxY, b.y + b.radius);
    }

    for (const p of this.physics.portals) {
      minX = Math.min(minX, p.x1, p.x2);
      maxX = Math.max(maxX, p.x1, p.x2);
      minY = Math.min(minY, p.y1, p.y2);
      maxY = Math.max(maxY, p.y1, p.y2);
    }

    // Generous framing so user gets a great wide bird's-eye view of the puzzle
    this.renderer.camera.fitBounds(minX, maxX, minY, maxY, 0.25);
    this.updateZoomUI();
    this.syncPhysicsGeometry();
  }
}

// Instantiate App on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new MarbleSlideApp();
});
