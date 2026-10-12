// src/ui/mathKeyboard.ts
// Desmos-style on-screen mathematical virtual keypad for mobile (iPhone / iPad) and touch devices.
// Enables seamless 1-tap entry of formulas, powers, fractions, roots, trig, logs, constants, and domain restrictions
// with instant toggling between the custom math keypad and the native iOS system keyboard.

export type KeyboardMode = 'custom' | 'native';
export type KeyboardTab = '123' | 'func' | 'bounds';

export interface KeyDefinition {
  label: string;
  latex?: string;
  insert?: string;
  action?: 'backspace' | 'left' | 'right' | 'enter' | 'clear' | 'switch_native' | 'tab' | 'close';
  actionArg?: string;
  className?: string;
  title?: string;
}

export class MathKeyboard {
  private containerEl: HTMLElement | null = null;
  private activeInput: HTMLInputElement | null = null;
  public isOpen: boolean = false;
  public keyboardMode: KeyboardMode = 'custom';
  public activeTab: KeyboardTab = '123';
  private backspaceInterval: ReturnType<typeof setInterval> | null = null;
  private backspaceTimeout: ReturnType<typeof setTimeout> | null = null;

  public onInputChanged?: (input: HTMLInputElement) => void;
  public onEnterPressed?: () => void;

  constructor() {
    // Restore user keyboard preference (default to custom math keypad for superior mobile math UX)
    const saved = localStorage.getItem('marbleslide_keyboard_mode');
    if (saved === 'native' || saved === 'custom') {
      this.keyboardMode = saved;
    } else {
      this.keyboardMode = 'custom';
    }

    this.initDOM();
  }

  private initDOM(): void {
    let container = document.getElementById('math-keyboard-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'math-keyboard-container';
      container.className = 'math-keyboard-container hidden';
      document.body.appendChild(container);
    }
    this.containerEl = container;
    this.render();
  }

  public registerInput(input: HTMLInputElement, onInput?: () => void): void {
    // Prevent iOS native keyboard when custom mode is active
    if (this.keyboardMode === 'custom') {
      input.setAttribute('inputmode', 'none');
    } else {
      input.setAttribute('inputmode', 'text');
    }

    input.addEventListener('focus', () => {
      this.activeInput = input;
      if (this.keyboardMode === 'custom') {
        input.setAttribute('inputmode', 'none');
        this.open();
      }
    });

    input.addEventListener('click', () => {
      this.activeInput = input;
      if (this.keyboardMode === 'custom') {
        input.setAttribute('inputmode', 'none');
        this.open();
      }
    });

    if (onInput) {
      input.addEventListener('input', onInput);
    }
  }

  public setActiveInput(input: HTMLInputElement | null): void {
    this.activeInput = input;
  }

  public open(): void {
    if (!this.containerEl) return;
    this.isOpen = true;
    this.containerEl.classList.remove('hidden');
    this.containerEl.classList.add('visible');

    // Add padding to body / equations so input is never blocked
    document.body.classList.add('math-keyboard-open');

    // Scroll active input into view smoothly
    if (this.activeInput) {
      setTimeout(() => {
        this.activeInput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }

    this.updateHeaderUI();
  }

  public close(): void {
    if (!this.containerEl) return;
    this.isOpen = false;
    this.containerEl.classList.remove('visible');
    this.containerEl.classList.add('hidden');
    document.body.classList.remove('math-keyboard-open');
    this.stopBackspaceRepeat();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public switchToNativeKeyboard(): void {
    this.keyboardMode = 'native';
    localStorage.setItem('marbleslide_keyboard_mode', 'native');
    this.close();

    if (this.activeInput) {
      this.activeInput.setAttribute('inputmode', 'text');
      // Briefly blur and refocus to trigger iOS native keyboard
      this.activeInput.blur();
      setTimeout(() => {
        this.activeInput?.focus();
      }, 50);
    }
  }

  public switchToCustomKeyboard(): void {
    this.keyboardMode = 'custom';
    localStorage.setItem('marbleslide_keyboard_mode', 'custom');

    if (this.activeInput) {
      this.activeInput.setAttribute('inputmode', 'none');
      this.activeInput.blur();
      setTimeout(() => {
        this.activeInput?.focus();
        this.open();
      }, 50);
    } else {
      this.open();
    }
  }

  public setTab(tab: KeyboardTab): void {
    this.activeTab = tab;
    this.render();
  }

  private triggerHaptic(): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch (_) {}
  }

  public insertText(text: string): void {
    this.triggerHaptic();
    if (!this.activeInput) {
      // Find first visible equation input if none is actively focused
      const first = document.querySelector('.equation-input') as HTMLInputElement;
      if (first) {
        this.activeInput = first;
        this.activeInput.focus();
      } else {
        return;
      }
    }

    const input = this.activeInput;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const current = input.value;

    let insertVal = text;
    let caretDelta = text.length;

    // Smart cursor positioning for functions: sin() puts cursor inside ()
    if (insertVal.endsWith('()')) {
      caretDelta = insertVal.length - 1;
    } else if (insertVal.endsWith('{}')) {
      caretDelta = insertVal.length - 1;
    } else if (insertVal === '{ x > 0 }' || insertVal === '{ -5 < x < 5 }') {
      // Direct insertion of domain snippet
      caretDelta = insertVal.length;
    }

    input.value = current.slice(0, start) + insertVal + current.slice(end);
    const newPos = start + caretDelta;

    input.focus();
    input.setSelectionRange(newPos, newPos);

    // Dispatch input event for real-time math evaluation & autosave
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (this.onInputChanged) {
      this.onInputChanged(input);
    }
  }

  public deleteChar(): void {
    this.triggerHaptic();
    if (!this.activeInput) return;
    const input = this.activeInput;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const current = input.value;

    if (start !== end) {
      // Delete selection
      input.value = current.slice(0, start) + current.slice(end);
      input.setSelectionRange(start, start);
    } else if (start > 0) {
      // Check if caret is between () or {} and remove both
      if (current[start - 1] === '(' && current[start] === ')') {
        input.value = current.slice(0, start - 1) + current.slice(start + 1);
        input.setSelectionRange(start - 1, start - 1);
      } else if (current[start - 1] === '{' && current[start] === '}') {
        input.value = current.slice(0, start - 1) + current.slice(start + 1);
        input.setSelectionRange(start - 1, start - 1);
      } else {
        input.value = current.slice(0, start - 1) + current.slice(start);
        input.setSelectionRange(start - 1, start - 1);
      }
    }

    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (this.onInputChanged) {
      this.onInputChanged(input);
    }
  }

  public moveCaret(offset: -1 | 1): void {
    this.triggerHaptic();
    if (!this.activeInput) return;
    const input = this.activeInput;
    const start = input.selectionStart ?? input.value.length;
    const newPos = Math.max(0, Math.min(input.value.length, start + offset));
    input.focus();
    input.setSelectionRange(newPos, newPos);
  }

  private startBackspaceRepeat(): void {
    this.deleteChar();
    this.backspaceTimeout = setTimeout(() => {
      this.backspaceInterval = setInterval(() => {
        this.deleteChar();
      }, 70);
    }, 350);
  }

  private stopBackspaceRepeat(): void {
    if (this.backspaceTimeout) {
      clearTimeout(this.backspaceTimeout);
      this.backspaceTimeout = null;
    }
    if (this.backspaceInterval) {
      clearInterval(this.backspaceInterval);
      this.backspaceInterval = null;
    }
  }

  private updateHeaderUI(): void {
    if (!this.containerEl) return;
    this.containerEl.querySelectorAll('.kbd-tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tab === this.activeTab);
    });
  }

  private render(): void {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    // 1. TOOLBAR / HEADER: [Tabs: 123 | f(x) | { }] [📱 ABC (Native)] [▼ Dismiss]
    const header = document.createElement('div');
    header.className = 'math-kbd-header';

    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'kbd-tabs';

    const tab1 = document.createElement('button');
    tab1.className = `kbd-tab-btn ${this.activeTab === '123' ? 'active' : ''}`;
    tab1.setAttribute('data-tab', '123');
    tab1.textContent = '123 / Math';
    tab1.addEventListener('pointerdown', e => { e.preventDefault(); this.setTab('123'); });

    const tab2 = document.createElement('button');
    tab2.className = `kbd-tab-btn ${this.activeTab === 'func' ? 'active' : ''}`;
    tab2.setAttribute('data-tab', 'func');
    tab2.textContent = 'f(x) Functions';
    tab2.addEventListener('pointerdown', e => { e.preventDefault(); this.setTab('func'); });

    const tab3 = document.createElement('button');
    tab3.className = `kbd-tab-btn ${this.activeTab === 'bounds' ? 'active' : ''}`;
    tab3.setAttribute('data-tab', 'bounds');
    tab3.textContent = '{ } Bounds';
    tab3.addEventListener('pointerdown', e => { e.preventDefault(); this.setTab('bounds'); });

    tabsWrap.appendChild(tab1);
    tabsWrap.appendChild(tab2);
    tabsWrap.appendChild(tab3);

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'kbd-header-actions';

    // Native Keyboard Toggle
    const nativeBtn = document.createElement('button');
    nativeBtn.className = 'kbd-action-btn switch-native-btn';
    nativeBtn.innerHTML = '📱 <span class="btn-subtext">ABC</span>';
    nativeBtn.title = 'Switch to iOS Native Keyboard';
    nativeBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.switchToNativeKeyboard();
    });

    // Dismiss / Hide Keypad
    const closeBtn = document.createElement('button');
    closeBtn.className = 'kbd-action-btn close-kbd-btn';
    closeBtn.innerHTML = '▼';
    closeBtn.title = 'Hide Math Keypad';
    closeBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.close();
    });

    actionsWrap.appendChild(nativeBtn);
    actionsWrap.appendChild(closeBtn);

    header.appendChild(tabsWrap);
    header.appendChild(actionsWrap);
    this.containerEl.appendChild(header);

    // 2. KEYS GRID
    const grid = document.createElement('div');
    grid.className = `math-kbd-grid tab-${this.activeTab}`;

    const keys = this.getTabKeys(this.activeTab);
    keys.forEach(k => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `kbd-key ${k.className || ''}`;
      btn.innerHTML = k.label;
      if (k.title) btn.title = k.title;

      // Handle pointerdown to prevent focus loss on input
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();

        if (k.action === 'backspace') {
          this.startBackspaceRepeat();
        } else if (k.action === 'left') {
          this.moveCaret(-1);
        } else if (k.action === 'right') {
          this.moveCaret(1);
        } else if (k.action === 'enter') {
          this.triggerHaptic();
          if (this.onEnterPressed) {
            this.onEnterPressed();
          } else {
            // Find Add Equation button or advance
            document.getElementById('btn-add-equation')?.click();
          }
        } else if (k.action === 'switch_native') {
          this.switchToNativeKeyboard();
        } else if (k.action === 'clear') {
          if (this.activeInput) {
            this.activeInput.value = '';
            this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else if (k.insert !== undefined) {
          this.insertText(k.insert);
        }
      });

      if (k.action === 'backspace') {
        btn.addEventListener('pointerup', () => this.stopBackspaceRepeat());
        btn.addEventListener('pointerleave', () => this.stopBackspaceRepeat());
        btn.addEventListener('pointercancel', () => this.stopBackspaceRepeat());
      }

      grid.appendChild(btn);
    });

    this.containerEl.appendChild(grid);
  }

  private getTabKeys(tab: KeyboardTab): KeyDefinition[] {
    if (tab === '123') {
      return [
        // ROW 1: Variables, Exponents, Grouping, Delete
        { label: '<i>x</i>', insert: 'x', className: 'key-var', title: 'Variable x' },
        { label: '<i>y</i>', insert: 'y', className: 'key-var', title: 'Variable y' },
        { label: '<i>x</i>²', insert: '^2', className: 'key-math', title: 'Square (^2)' },
        { label: '<i>x</i><sup><i>y</i></sup>', insert: '^', className: 'key-math', title: 'Power (^)' },
        { label: '(', insert: '()', className: 'key-bracket', title: 'Parenthesis' },
        { label: ')', insert: ')', className: 'key-bracket', title: 'Closing Parenthesis' },
        { label: '{', insert: '{}', className: 'key-bracket', title: 'Domain restriction brace' },
        { label: '}', insert: '}', className: 'key-bracket', title: 'Closing brace' },
        { label: '⌫', action: 'backspace', className: 'key-del', title: 'Backspace' },

        // ROW 2: 7, 8, 9, /, √, π, e, m, b
        { label: '7', insert: '7', className: 'key-num' },
        { label: '8', insert: '8', className: 'key-num' },
        { label: '9', insert: '9', className: 'key-num' },
        { label: '÷', insert: '/', className: 'key-op', title: 'Division (/)' },
        { label: '√<i>x</i>', insert: 'sqrt()', className: 'key-func', title: 'Square Root' },
        { label: 'π', insert: 'pi', className: 'key-const', title: 'Pi Constant (3.14159...)' },
        { label: 'e', insert: 'e', className: 'key-const', title: 'Euler Constant (2.71828...)' },
        { label: '<i>m</i>', insert: 'm', className: 'key-param', title: 'Slope variable (m)' },
        { label: '<i>b</i>', insert: 'b', className: 'key-param', title: 'Intercept variable (b)' },

        // ROW 3: 4, 5, 6, *, |x|, sin, cos, tan, <
        { label: '4', insert: '4', className: 'key-num' },
        { label: '5', insert: '5', className: 'key-num' },
        { label: '6', insert: '6', className: 'key-num' },
        { label: '×', insert: '*', className: 'key-op', title: 'Multiplication (*)' },
        { label: '|<i>x</i>|', insert: 'abs()', className: 'key-func', title: 'Absolute Value' },
        { label: 'sin', insert: 'sin()', className: 'key-func', title: 'Sine Function' },
        { label: 'cos', insert: 'cos()', className: 'key-func', title: 'Cosine Function' },
        { label: 'tan', insert: 'tan()', className: 'key-func', title: 'Tangent Function' },
        { label: '&lt;', insert: '<', className: 'key-rel', title: 'Less Than' },

        // ROW 4: 1, 2, 3, -, ln, log, ,, >, <=
        { label: '1', insert: '1', className: 'key-num' },
        { label: '2', insert: '2', className: 'key-num' },
        { label: '3', insert: '3', className: 'key-num' },
        { label: '−', insert: '-', className: 'key-op', title: 'Subtraction / Negative' },
        { label: 'ln', insert: 'ln()', className: 'key-func', title: 'Natural Logarithm (ln)' },
        { label: 'log', insert: 'log()', className: 'key-func', title: 'Logarithm Base 10' },
        { label: ',', insert: ', ', className: 'key-rel', title: 'Comma separator' },
        { label: '&gt;', insert: '>', className: 'key-rel', title: 'Greater Than' },
        { label: '≤', insert: '<=', className: 'key-rel', title: 'Less Than or Equal' },

        // ROW 5: 📱 ABC, 0, ., =, +, ◀, ▶, ↵ Add
        { label: '📱 ABC', action: 'switch_native', className: 'key-special', title: 'Switch to iOS Native Keyboard' },
        { label: '0', insert: '0', className: 'key-num' },
        { label: '.', insert: '.', className: 'key-num', title: 'Decimal Point' },
        { label: '=', insert: '=', className: 'key-eq', title: 'Equals Sign' },
        { label: '+', insert: '+', className: 'key-op', title: 'Addition' },
        { label: '◀', action: 'left', className: 'key-nav', title: 'Move Cursor Left' },
        { label: '▶', action: 'right', className: 'key-nav', title: 'Move Cursor Right' },
        { label: '↵ <b>+Eq</b>', action: 'enter', className: 'key-enter', title: 'Add New Equation' },
      ];
    }

    if (tab === 'func') {
      return [
        // Trigonometric & Hyperbolic Functions
        { label: 'sin', insert: 'sin()', className: 'key-func' },
        { label: 'cos', insert: 'cos()', className: 'key-func' },
        { label: 'tan', insert: 'tan()', className: 'key-func' },
        { label: 'sin⁻¹', insert: 'asin()', className: 'key-func' },
        { label: 'cos⁻¹', insert: 'acos()', className: 'key-func' },
        { label: 'tan⁻¹', insert: 'atan()', className: 'key-func' },
        { label: 'sinh', insert: 'sinh()', className: 'key-func' },
        { label: 'cosh', insert: 'cosh()', className: 'key-func' },
        { label: 'tanh', insert: 'tanh()', className: 'key-func' },

        // Logarithms & Powers
        { label: 'ln(<i>x</i>)', insert: 'ln()', className: 'key-func' },
        { label: 'log(<i>x</i>)', insert: 'log()', className: 'key-func' },
        { label: 'log₁₀', insert: 'log10()', className: 'key-func' },
        { label: 'log₂', insert: 'log2()', className: 'key-func' },
        { label: 'e<sup><i>x</i></sup>', insert: 'exp()', className: 'key-func' },
        { label: '√<i>x</i>', insert: 'sqrt()', className: 'key-func' },
        { label: '∛<i>x</i>', insert: 'cbrt()', className: 'key-func' },
        { label: '|<i>x</i>|', insert: 'abs()', className: 'key-func' },
        { label: '<i>x</i>³', insert: '^3', className: 'key-math' },

        // Calculus / Rounding / Helper Functions
        { label: 'floor', insert: 'floor()', className: 'key-func' },
        { label: 'ceil', insert: 'ceil()', className: 'key-func' },
        { label: 'round', insert: 'round()', className: 'key-func' },
        { label: 'sign', insert: 'sign()', className: 'key-func' },
        { label: 'min', insert: 'min()', className: 'key-func' },
        { label: 'max', insert: 'max()', className: 'key-func' },
        { label: 'π', insert: 'pi', className: 'key-const' },
        { label: 'e', insert: 'e', className: 'key-const' },
        { label: '⌫', action: 'backspace', className: 'key-del' },

        // Navigation bottom row
        { label: '📱 ABC', action: 'switch_native', className: 'key-special' },
        { label: '(', insert: '()', className: 'key-bracket' },
        { label: ')', insert: ')', className: 'key-bracket' },
        { label: ',', insert: ', ', className: 'key-rel' },
        { label: '◀', action: 'left', className: 'key-nav' },
        { label: '▶', action: 'right', className: 'key-nav' },
        { label: '↵ Done', action: 'enter', className: 'key-enter' },
      ];
    }

    // Bounds & Domain tab
    return [
      // Domain Symbols & Comparison Operators
      { label: '{', insert: '{}', className: 'key-bracket' },
      { label: '}', insert: '}', className: 'key-bracket' },
      { label: '&lt;', insert: '<', className: 'key-rel' },
      { label: '&gt;', insert: '>', className: 'key-rel' },
      { label: '≤', insert: '<=', className: 'key-rel' },
      { label: '≥', insert: '>=', className: 'key-rel' },
      { label: '=', insert: '=', className: 'key-eq' },
      { label: '≠', insert: '!=', className: 'key-rel' },
      { label: '⌫', action: 'backspace', className: 'key-del' },

      // Variable tokens
      { label: '<i>x</i>', insert: 'x', className: 'key-var' },
      { label: '<i>y</i>', insert: 'y', className: 'key-var' },
      { label: '<i>m</i>', insert: 'm', className: 'key-param' },
      { label: '<i>b</i>', insert: 'b', className: 'key-param' },
      { label: '<i>a</i>', insert: 'a', className: 'key-param' },
      { label: '<i>k</i>', insert: 'k', className: 'key-param' },
      { label: ',', insert: ', ', className: 'key-rel' },
      { label: '−', insert: '-', className: 'key-op' },
      { label: '0', insert: '0', className: 'key-num' },

      // Quick Snippets (common Desmos domain restrictions)
      { label: '{ <i>x</i> &gt; 0 }', insert: '{ x > 0 }', className: 'key-snippet' },
      { label: '{ <i>x</i> &lt; 0 }', insert: '{ x < 0 }', className: 'key-snippet' },
      { label: '{ -5 &lt; <i>x</i> &lt; 5 }', insert: '{ -5 < x < 5 }', className: 'key-snippet' },
      { label: '{ <i>y</i> &gt; 0 }', insert: '{ y > 0 }', className: 'key-snippet' },
      { label: '{ -3 &lt; <i>y</i> &lt; 3 }', insert: '{ -3 < y < 3 }', className: 'key-snippet' },
      { label: '📱 ABC', action: 'switch_native', className: 'key-special' },
      { label: '◀', action: 'left', className: 'key-nav' },
      { label: '▶', action: 'right', className: 'key-nav' },
      { label: '↵ Done', action: 'enter', className: 'key-enter' },
    ];
  }
}
