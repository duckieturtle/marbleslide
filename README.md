# 🔮 MarbleSlide

An interactive mathematical physics puzzle game inspired by Desmos Marbleslides. Formulate equations, guide falling marbles through stars, avoid obstacles, and ride ramps, portals, bumpers, and gravity wells!

🎮 **Play Live:** [https://duckieturtle.github.io/marbleslide/](https://duckieturtle.github.io/marbleslide/)

---

## ✨ Features

- 📐 **Authentic Equation Engine**: Explicit $y = f(x)$, piecewise functions, and domain restrictions like `y = -0.5*x + 1.5 { -7 < x < 3 }`.
- 🧮 **KaTeX Math Typesetting**: Live mathematical notation with fractions ($\frac{a}{b}$), powers ($x^2$), square roots ($\sqrt{x}$), absolute values ($|x|$), and quick-input math chips.
- 🎯 **Physics & Marbles**: High-precision sub-stepped numerical integration with zero-friction sliding, inelastic collisions, momentum-conserving portals, and bounce impulse bumpers.
- 🎨 **Doodle Jump Theme**: Hand-drawn graph paper notebook aesthetic with animated platform ramps and custom Web Audio synthesizer effects.
- 🛠️ **Sandbox & Track Editor**: Create your own levels, draw custom ramps with the pen tool, place portals, stars, bumpers, and gravity wells, and export/import levels as JSON.
- ⚡ **100% Static Web Application**: Zero backend server required. Runs entirely client-side in modern web browsers.

---

## 🚀 Development & Local Run

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Production build
npm run build
```

---

## 📜 License

MIT License. Created by [duckieturtle](https://github.com/duckieturtle).
