// src/ui/equationManager.ts
// Handles equation list, compiling, dynamic sliders, color palettes, and segment generation

import { compileEquation, sampleEquation, ParsedEquation } from '../math/evaluator';
import { EquationItem } from '../levels/levelData';
import { Segment } from '../physics/types';
import { renderMathHtml } from '../math/latexRenderer';

export const EQUATION_PALETTE = [
  '#38bdf8', // Sky Cyan
  '#f43f5e', // Rose Coral
  '#a855f7', // Vivid Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Teal Cyan
  '#84cc16', // Lime
];

export interface SliderState {
  value: number;
  min: number;
  max: number;
  step: number;
  isAnimating: boolean;
  animDirection: number; // 1 or -1
}

export class EquationManager {
  public items: EquationItem[] = [];
  public compiled: Map<string, ParsedEquation> = new Map();
  public sliders: Map<string, SliderState> = new Map();
  public onEquationsChanged: () => void = () => {};

  private containerEl: HTMLElement;
  private slidersEl: HTMLElement;

  constructor(containerEl: HTMLElement, slidersEl: HTMLElement) {
    this.containerEl = containerEl;
    this.slidersEl = slidersEl;
  }

  public setEquations(
    items: EquationItem[],
    initialSliders?: Record<string, { value: number; min: number; max: number; step: number }>
  ): void {
    this.items = items.map(item => ({ ...item }));
    this.compiled.clear();

    // Preserve or initialize sliders
    if (initialSliders) {
      this.sliders.clear();
      for (const [v, cfg] of Object.entries(initialSliders)) {
        this.sliders.set(v, {
          value: cfg.value,
          min: cfg.min,
          max: cfg.max,
          step: cfg.step,
          isAnimating: false,
          animDirection: 1,
        });
      }
    }

    this.recompileAll();
    this.render();
  }

  public addEquation(raw = 'y = -0.5*x + 2', color?: string, autoFocus = true): void {
    const nextColor = color || EQUATION_PALETTE[this.items.length % EQUATION_PALETTE.length];
    const item: EquationItem = {
      id: `eq_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      raw,
      color: nextColor,
    };
    this.items.push(item);
    this.recompileAll();
    this.render();
    this.onEquationsChanged();

    if (autoFocus) {
      setTimeout(() => {
        const card = this.containerEl.querySelector(`[data-id="${item.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const input = card.querySelector('input') as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
          }
        }
      }, 50);
    }
  }

  public removeEquation(id: string): void {
    this.items = this.items.filter(item => item.id !== id);
    this.compiled.delete(id);
    this.updateSlidersFromVariables();
    this.render();
    this.onEquationsChanged();
  }

  public duplicateEquation(id: string): void {
    const orig = this.items.find(i => i.id === id);
    if (!orig) return;
    const color = EQUATION_PALETTE[(this.items.length + 1) % EQUATION_PALETTE.length];
    this.addEquation(orig.raw, color);
  }

  public updateEquationRaw(id: string, newRaw: string): void {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.raw = newRaw;
    const compiled = compileEquation(newRaw);
    this.compiled.set(id, compiled);

    // Update math display and error badge immediately in-place without re-rendering input
    const card = this.containerEl.querySelector(`[data-id="${id}"]`);
    if (card) {
      const mathDisplay = card.querySelector('.equation-math-display');
      if (mathDisplay) {
        mathDisplay.innerHTML = renderMathHtml(newRaw);
      }

      const statusEl = card.querySelector('.equation-status');
      if (statusEl) {
        if (!compiled.isValid) {
          statusEl.className = 'equation-status error';
          statusEl.textContent = compiled.errorMessage || 'Invalid equation';
        } else {
          statusEl.className = 'equation-status';
          statusEl.textContent = '';
        }
      }
    }

    this.updateSlidersFromVariables();
    this.renderSlidersOnly();
    this.onEquationsChanged();
  }

  public setEquationColor(id: string, color: string): void {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.color = color;
    this.render();
    this.onEquationsChanged();
  }

  public recompileAll(): void {
    for (const item of this.items) {
      const compiled = compileEquation(item.raw);
      this.compiled.set(item.id, compiled);
    }
    this.updateSlidersFromVariables();
  }

  private updateSlidersFromVariables(): void {
    const detectedVars = new Set<string>();
    for (const compiled of this.compiled.values()) {
      if (compiled.isValid) {
        for (const v of compiled.freeVariables) {
          detectedVars.add(v);
        }
      }
    }

    // Add new sliders with smart defaults
    for (const v of detectedVars) {
      if (!this.sliders.has(v)) {
        this.sliders.set(v, {
          value: 1.0,
          min: -10,
          max: 10,
          step: 0.1,
          isAnimating: false,
          animDirection: 1,
        });
      }
    }

    // Clean up variables that no longer exist
    for (const v of this.sliders.keys()) {
      if (!detectedVars.has(v)) {
        this.sliders.delete(v);
      }
    }
  }

  public getVariableValues(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const [k, s] of this.sliders.entries()) {
      res[k] = s.value;
    }
    return res;
  }

  public generateSegments(
    xMin: number,
    xMax: number,
    yMin: number = -30,
    yMax: number = 30
  ): Segment[] {
    const segments: Segment[] = [];
    const vars = this.getVariableValues();

    for (const item of this.items) {
      const comp = this.compiled.get(item.id);
      if (!comp || !comp.isValid) continue;

      const polylines = sampleEquation(comp, xMin, xMax, yMin, yMax, vars, 0.04);

      for (const line of polylines) {
        for (let i = 0; i < line.length - 1; i++) {
          segments.push({
            p1: line[i],
            p2: line[i + 1],
            thickness: 0.12,
            color: item.color,
          });
        }
      }
    }

    return segments;
  }

  public updateSlidersAnimation(dt: number): void {
    let changed = false;
    for (const [_, slider] of this.sliders.entries()) {
      if (slider.isAnimating) {
        const span = slider.max - slider.min;
        const speed = span * 0.25; // cycle every ~4 seconds
        slider.value += slider.animDirection * speed * dt;

        if (slider.value >= slider.max) {
          slider.value = slider.max;
          slider.animDirection = -1;
        } else if (slider.value <= slider.min) {
          slider.value = slider.min;
          slider.animDirection = 1;
        }

        // Clamp & round to reasonable precision
        slider.value = Math.round(slider.value * 100) / 100;
        changed = true;
      }
    }

    if (changed) {
      this.renderSlidersOnly();
      this.onEquationsChanged();
    }
  }

  public render(): void {
    this.containerEl.innerHTML = '';

    this.items.forEach((item, index) => {
      const comp = this.compiled.get(item.id);
      const isError = comp && !comp.isValid;

      const card = document.createElement('div');
      card.className = 'equation-card';
      card.dataset.id = item.id;

      // 1. TOP DISPLAY ROW: [num] [colorDot] [Rendered KaTeX Math] [Actions]
      const topRow = document.createElement('div');
      topRow.className = 'equation-render-row';

      // Line number badge
      const numBadge = document.createElement('span');
      numBadge.className = 'equation-num';
      numBadge.textContent = String(index + 1);

      // Color picker dot
      const colorDot = document.createElement('div');
      colorDot.className = 'color-dot';
      colorDot.style.backgroundColor = item.color;
      colorDot.title = 'Change line color';
      colorDot.addEventListener('click', e => {
        this.openColorPicker(e, item.id);
      });

      // Rendered Math Display (KaTeX: Powers, fractions, roots, etc.)
      const mathDisplay = document.createElement('div');
      mathDisplay.className = 'equation-math-display';
      mathDisplay.title = 'Click to edit formula';
      mathDisplay.innerHTML = renderMathHtml(item.raw);

      // Action buttons (duplicate & delete)
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'eq-row-actions';

      const dupBtn = document.createElement('button');
      dupBtn.className = 'eq-btn-icon';
      dupBtn.innerHTML = '❐';
      dupBtn.title = 'Duplicate equation';
      dupBtn.addEventListener('click', () => {
        this.duplicateEquation(item.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'eq-btn-icon';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Delete equation';
      delBtn.addEventListener('click', () => {
        this.removeEquation(item.id);
      });

      actionsWrap.appendChild(dupBtn);
      actionsWrap.appendChild(delBtn);

      topRow.appendChild(numBadge);
      topRow.appendChild(colorDot);
      topRow.appendChild(mathDisplay);
      topRow.appendChild(actionsWrap);
      card.appendChild(topRow);

      // 2. INPUT ROW: Text input for formula editing
      const inputRow = document.createElement('div');
      inputRow.className = 'equation-input-row';

      const inputWrap = document.createElement('div');
      inputWrap.className = 'equation-input-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'equation-input';
      input.value = item.raw;
      input.placeholder = 'Type formula, e.g. y = -0.5x^2 + 3/2';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('inputmode', 'text');

      input.addEventListener('pointerdown', e => e.stopPropagation());
      input.addEventListener('mousedown', e => e.stopPropagation());
      input.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

      input.addEventListener('input', () => {
        this.updateEquationRaw(item.id, input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addEquation('', undefined, true);
        }
      });
      inputWrap.appendChild(input);

      inputWrap.addEventListener('pointerdown', () => {
        input.focus();
      });
      inputWrap.addEventListener('click', () => {
        input.focus();
      });

      mathDisplay.addEventListener('click', () => {
        input.focus();
      });

      inputRow.appendChild(inputWrap);
      card.appendChild(inputRow);

      // 3. QUICK MATH CHIP BUTTONS: Powers, fractions, roots, functions
      const shortcutsRow = document.createElement('div');
      shortcutsRow.className = 'math-shortcuts-row';

      const chips = [
        { label: 'x²', insert: '^2', title: 'Power / Exponent (x²)' },
        { label: 'a/b', insert: '/', title: 'Fraction (/)' },
        { label: '√x', insert: 'sqrt()', title: 'Square Root' },
        { label: '|x|', insert: 'abs()', title: 'Absolute Value' },
        { label: 'sin', insert: 'sin()', title: 'Sine Wave' },
        { label: 'π', insert: 'pi', title: 'Pi Constant' },
      ];

      chips.forEach(c => {
        const chipBtn = document.createElement('button');
        chipBtn.type = 'button';
        chipBtn.className = 'math-chip-btn';
        chipBtn.textContent = c.label;
        chipBtn.title = c.title;

        chipBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          const val = input.value;
          input.value = val.slice(0, start) + c.insert + val.slice(end);

          let newPos = start + c.insert.length;
          if (c.insert.endsWith('()')) {
            newPos = start + c.insert.length - 1;
          }
          input.focus();
          input.setSelectionRange(newPos, newPos);
          this.updateEquationRaw(item.id, input.value);
        });

        shortcutsRow.appendChild(chipBtn);
      });

      card.appendChild(shortcutsRow);

      // 4. Status badge (if error)
      const status = document.createElement('div');
      status.className = `equation-status ${isError ? 'error' : ''}`;
      if (isError) {
        status.textContent = comp?.errorMessage || 'Invalid equation';
      }
      card.appendChild(status);

      this.containerEl.appendChild(card);
    });

    this.renderSlidersOnly();
  }

  public renderSlidersOnly(): void {
    this.slidersEl.innerHTML = '';

    if (this.sliders.size === 0) {
      const panel = document.getElementById('sliders-panel');
      if (panel) panel.classList.add('hidden');
      return;
    }

    const panel = document.getElementById('sliders-panel');
    if (panel) panel.classList.remove('hidden');

    for (const [varName, slider] of this.sliders.entries()) {
      const item = document.createElement('div');
      item.className = 'slider-item';

      const nameLabel = document.createElement('span');
      nameLabel.className = 'slider-name';
      nameLabel.textContent = varName;

      const rangeInput = document.createElement('input');
      rangeInput.type = 'range';
      rangeInput.className = 'slider-input';
      rangeInput.min = String(slider.min);
      rangeInput.max = String(slider.max);
      rangeInput.step = String(slider.step);
      rangeInput.value = String(slider.value);

      const valInput = document.createElement('input');
      valInput.type = 'number';
      valInput.className = 'slider-val-input';
      valInput.min = String(slider.min);
      valInput.max = String(slider.max);
      valInput.step = String(slider.step);
      valInput.value = String(slider.value);

      const playBtn = document.createElement('button');
      playBtn.className = 'slider-play-btn';
      playBtn.innerHTML = slider.isAnimating ? '⏸' : '▶';
      playBtn.title = slider.isAnimating ? 'Pause animation' : 'Animate variable';

      rangeInput.addEventListener('input', () => {
        slider.value = parseFloat(rangeInput.value);
        valInput.value = String(slider.value);
        this.onEquationsChanged();
      });

      valInput.addEventListener('change', () => {
        const val = parseFloat(valInput.value);
        if (!isNaN(val)) {
          slider.value = val;
          rangeInput.value = String(val);
          this.onEquationsChanged();
        }
      });

      playBtn.addEventListener('click', () => {
        slider.isAnimating = !slider.isAnimating;
        playBtn.innerHTML = slider.isAnimating ? '⏸' : '▶';
      });

      item.appendChild(nameLabel);
      item.appendChild(rangeInput);
      item.appendChild(valInput);
      item.appendChild(playBtn);

      this.slidersEl.appendChild(item);
    }
  }

  private openColorPicker(e: MouseEvent, eqId: string): void {
    // Remove existing popovers
    document.querySelectorAll('.color-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'color-picker-popover';

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${rect.left}px`;

    for (const color of EQUATION_PALETTE) {
      const opt = document.createElement('div');
      opt.className = 'popover-color-option';
      opt.style.backgroundColor = color;
      opt.addEventListener('click', () => {
        this.setEquationColor(eqId, color);
        popover.remove();
      });
      popover.appendChild(opt);
    }

    document.body.appendChild(popover);

    const closeHandler = (ev: MouseEvent) => {
      if (!popover.contains(ev.target as Node) && ev.target !== e.target) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 10);
  }
}
