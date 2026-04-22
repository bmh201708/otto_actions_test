```markdown
# Design System Specification: The Digital Talisman

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Modern Talisman."** 

This system bridges the ancient, mystical world of Taoist tradition with the precision of modern robotics. We are moving away from the "industrial machine" aesthetic and toward a "living artifact." The UI should feel like a digital scroll—lightweight, breathable, and intentional. We reject the rigid, boxy constraints of standard mobile apps in favor of organic flow, asymmetrical layouts, and editorial-grade typography. 

Every screen is a composition. By using overlapping elements and high-contrast typography scales, we create a signature experience that feels curated rather than generated.

---

## 2. Colors: The Cinnabar & Silk Palette
Our palette is rooted in the "Five Elements" but refined for a premium digital display. We avoid the clinical coldness of pure white and the harshness of pure black.

### Color Tokens
*   **Primary (Cinnabar):** `#b7102a` — Used for active states, primary actions, and vital robot feedback.
*   **Surface (Silk Paper):** `#fbfbe2` — Our primary canvas. It mimics aged silk or handmade paper.
*   **On-Surface (Ink Wash):** `#1b1d0e` — A deep, warm charcoal that provides soft contrast without the "starkness" of black.

### The "No-Line" Rule
To maintain the "Modern Talisman" aesthetic, **1px solid borders are strictly prohibited** for sectioning content. Boundaries must be defined through:
1.  **Background Shifts:** Nesting a `surface-container-low` component inside a `surface` background.
2.  **Tonal Transitions:** Using subtle gradients to suggest the end of a container.
3.  **Whitespace:** Using the spacing scale to imply grouping.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create depth:
*   **Bottom Layer:** `surface` (The paper).
*   **Intermediate Layer:** `surface-container-low` (Subtle groupings).
*   **Floating Layer:** `surface-container-highest` (Interactive cards).

### The "Glass & Gradient" Rule
Floating elements (like the robot's directional controls) should utilize **Glassmorphism**. Apply `surface-tint` at 40% opacity with a `20px` backdrop blur. For primary CTAs, use a subtle radial gradient transitioning from `primary` (#b7102a) to `primary_container` (#db313f) to give the button a "glowing ink" soul.

---

## 3. Typography: Calligraphic Authority
We pair a traditional serif with a high-performance sans-serif to balance heritage with legibility.

*   **Display & Headlines (Noto Serif):** These are our "Brushstrokes." Use `display-lg` and `headline-md` for screen titles and robot status. The serif adds a sense of calligraphic history and weight.
*   **Body & Labels (Manrope):** These are our "Script." Manrope provides a clean, modern contrast. It ensures that technical data (battery life, motor speed) remains hyper-legible.

**Editorial Tip:** Use extreme scale contrast. Pair a massive `display-sm` header with a tiny, wide-tracked `label-md` uppercase subtitle to create a "luxury editorial" feel.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows look like "UI clutter." In this system, we use light and tone to imply height.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-high` background creates a natural "lift" through color value alone.
*   **Ambient Shadows:** If a "floating" effect is required (e.g., for a Modal), use a tinted shadow. The shadow should be `on-surface` at 6% opacity with a `48px` blur. Never use a neutral grey shadow.
*   **The "Ghost Border" Fallback:** If a container needs more definition, use a "Ghost Border": the `outline-variant` token at 15% opacity. It should be felt, not seen.
*   **Organic Rounding:** Follow the `xl` (1.5rem) or `full` rounding scale. Avoid sharp 90-degree corners to maintain the "organic" Taoist theme.

---

## 5. Components: The Alchemist's Tools

### Buttons (Sacred Actions)
*   **Primary:** Pill-shaped (`full` rounded). `primary` fill with `on-primary` text. Use a subtle inner glow (1px white at 10% opacity) on the top edge to simulate a "beaded" look.
*   **Secondary:** Ghost-style but with a `surface-container-highest` background. No border.

### The "Bagua" Controller (Robot Joystick)
Instead of a standard joystick, the Otto controller uses a circular Bagua-inspired element.
*   The center "void" uses `surface-bright`.
*   Directional arrows are simplified `primary` icons.
*   Background utilizes a backdrop blur to show the "silk" texture beneath.

### Cards & Lists (The Sutras)
*   **Forbid Divider Lines.** Separate list items using `16px` of vertical whitespace or a alternating subtle shift in `surface-container` tiers.
*   **Cloud Motifs:** Use simplified, geometric cloud patterns (SVG masks) in the corners of `surface-container-high` cards to denote "Special Abilities" or "Automation Modes."

### Input Fields
*   **The "Inked Line":** Instead of a box, use a single bottom-weighted line using `outline-variant`. When focused, the line expands into a `primary` (Cinnabar) underline with a soft outer glow.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical spacing. If the left margin is `24px`, try a `32px` right margin for a more "hand-crafted" layout.
*   **Do** use calligraphy-inspired icons. Icons should have varied stroke weights, mimicking a brush tip.
*   **Do** leverage "Ink Wash" (Muted Grey) for secondary information to create a clear hierarchy.

### Don't:
*   **Don't** use pure black (`#000000`). It kills the "organic paper" feel.
*   **Don't** use standard Material Design drop shadows. They look too "software-default."
*   **Don't** clutter the screen. Taoist philosophy prizes the "Void." If a feature isn't essential, remove it to allow the background silk texture to breathe.
*   **Don't** use sharp corners. Everything should feel like it was smoothed by a river.

---

## 7. Interaction Patterns
*   **State Changes:** When a button is pressed, it should not "sink." Instead, it should "bloom"—the `primary` color should expand slightly in scale (1.05x) with a soft Cinnabar outer glow.
*   **Loading States:** Use a pulsing "Circular Bagua" animation rather than a standard spinner. The rotation should be slow and meditative.
*   **Haptics:** Soft, "thud-like" haptics (low-frequency) should accompany button presses to mimic the feel of a physical stamp hitting paper.```