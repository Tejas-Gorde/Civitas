---
name: Sovereign Ledger
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464555'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#004598'
  on-tertiary: '#ffffff'
  tertiary-container: '#005cc6'
  on-tertiary-container: '#cedbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2.5rem
  xl: 4rem
  gutter: 24px
  margin-mobile: 16px
  max-width-content: 1200px
---

## Brand & Style
The design system is engineered to evoke absolute institutional trust, transparency, and accessibility. It targets a diverse demographic—from first-time voters to high-level election officials—requiring a UI that feels both technologically advanced and familiar.

The aesthetic follows a **Modern Corporate/Fintech** direction. It prioritizes clarity through a structured layout, purposeful use of white space, and a refined color palette that emphasizes "Safe Passage" through the voting process. Visual metaphors should lean toward stability and precision rather than "disruptive" tech trends.

## Colors
The palette is rooted in a spectrum of blues to communicate stability and authority. 

- **Primary Indigo (#4F46E5):** Used for primary actions and brand presence. It suggests modern intelligence and reliability.
- **Secure Navy (#1E293B):** Reserved for text, headers, and structural elements to provide a grounded, serious foundation.
- **Trust Blue (#3B82F6):** Used for informative accents, focus states, and progress indicators.
- **Success Green (#10B981):** Specifically for "Vote Cast" confirmations and verified identity states.
- **Backgrounds:** Use `#F8FAFC` for page backgrounds to provide a soft, low-glare surface that differentiates from white content cards.

## Typography
Inter is selected for its exceptional legibility and neutral, systematic character. It ensures that complex information is easily digestible.

- **Scale:** High contrast between headlines and body text is used to guide the user through the voting hierarchy.
- **Weight:** Use Semi-Bold (600) for interactive labels and Bold (700) for major headers. Medium (500) is used for tertiary labels.
- **Accessibility:** Line heights are intentionally generous (1.5x for body) to ensure readability for users with varying visual abilities.

## Layout & Spacing
The layout uses a **Fluid-to-Fixed Grid** model. On desktop, content is contained within a 1200px max-width container to prevent eye strain. On mobile, a 4-column grid with 16px margins is used.

- **Rhythm:** An 8pt spatial system governs all padding and margins. 
- **Generous Whitespace:** Critical for a high-trust system. Voting screens should never feel cluttered; each candidate or proposition requires significant "breathing room" to prevent accidental selections.
- **Vertical Flow:** Use a centered, single-column flow for the actual voting process to minimize distraction and maximize focus on the task at hand.

## Elevation & Depth
This design system utilizes **Tonal Layers** combined with **Ambient Shadows** to create a clear sense of hierarchy without excessive decoration.

- **Level 0 (Background):** `#F8FAFC` - The canvas.
- **Level 1 (Cards):** White (`#FFFFFF`) with a 1px border of `#E2E8F0`. This is the primary container for content.
- **Level 2 (Interactive):** Same as Level 1 but with a subtle, diffused shadow (Blur: 12px, Y: 4px, Color: `rgba(30, 41, 59, 0.05)`). Used for hover states on candidate cards.
- **Level 3 (Overlays):** Modals and dropdowns use a deeper shadow (Blur: 24px, Y: 8px, Color: `rgba(30, 41, 59, 0.1)`) to pull focus.

## Shapes
A **Rounded (0.5rem / 8px)** shape language is used to strike a balance between friendly accessibility and institutional precision.

- **Standard Buttons & Inputs:** 8px radius.
- **Content Cards:** 12px (`rounded-lg`) to create a softer, more modern framing for candidates.
- **Progress Bars:** Fully rounded (pill-shaped) to represent a continuous, smooth journey.
- **Avoid:** Do not use sharp 0px corners, as they appear too aggressive/technical for a public-facing civic tool.

## Components
- **Buttons:** 
  - *Primary:* Indigo background with white text. High-contrast, 8px radius.
  - *Secondary:* White background, 1px Navy border, Navy text.
  - *Size:* Minimum touch target of 48px height for mobile accessibility.
- **Candidate Cards:** Large cards containing a candidate's name, photo, and a "Select" button. When selected, the card should gain a 2px Indigo border and a subtle Trust Blue background tint.
- **Progress Stepper:** A horizontal bar at the top of the screen showing "Identity," "Ballot," "Review," and "Finalize." Completed steps are marked with a Green check icon.
- **Input Fields:** Clean white backgrounds with `#CBD5E1` borders. Focus state uses a 2px Trust Blue outline.
- **Trust Badges:** Small, non-intrusive labels (e.g., "End-to-End Encrypted," "Identity Verified") using Label-SM typography and a small shield icon.
- **Review Screen:** A summary list of all selections made, presented in a "receipt-like" format for final verification before submission.