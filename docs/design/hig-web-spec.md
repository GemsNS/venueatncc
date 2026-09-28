# Venue Web Design Spec (derived from Apple HIG, fetched 2026-09-28)

> **Superseded in part.** [brand.md](brand.md) is the source of truth for color, type, and imagery. It replaces the
> typefaces in section 3, the palette and contrast values in section 4, and every mention here of purple gradients,
> system purple, or hero imagery. The interaction rules in this spec (glass, layout, components, motion, accessibility)
> still apply.

Citation markers: `[slug]` = HIG page `…/human-interface-guidelines/<slug>`; `[ALG]` = Apple doc *Adopting Liquid Glass* (TechnologyOverviews/adopting-liquid-glass); `[UIKit]` = UIKit default, not published in HIG; `[web]` = our web derivation (not Apple guidance).

## 1. Core principles
HIG reintroduced eight principles on June 8, 2026 [design-principles]: **Purpose** "Make something meaningful"; **Agency** "Let people do things their own way"; **Responsibility** "Act in people's best interest"; **Familiarity** "Build on what people know"; **Flexibility** "Adapt to diverse contexts and needs"; **Simplicity** "Be clear and direct" ("Simplicity isn't minimalism"); **Craft** "Care about every detail"; **Delight** "Make it human" ("Don't mistake delight for decoration").
Implications for this site:
- In the booking wizard, "make it easy to skip or escape" and "Help people recover from mistakes" [design-principles].
- For purple: "Apply your app's accent color judiciously… use it intentionally for primary actions or status indicators… consider moving it into the content layer, where it scrolls beneath Liquid Glass controls" [branding]. "Ensure branding always defers to content" [branding].
- Color: "Avoid using the same color to mean different things" [color]. Purple means *interactive or selected*; brand expression lives in hero imagery and gradients.

## 2. Liquid Glass
**What it is:** "a dynamic material that unifies the design language across Apple platforms". It "forms a distinct functional layer for controls and navigation elements… that floats above the content layer" [materials]. "By default, Liquid Glass has no inherent color, and instead takes on colors from the content directly behind it" [color].
**Use it on:** the top nav bar, the floating tab bar, the admin sidebar, toolbars, sheets, popovers and menus [materials][ALG], plus the prominent primary button as tinted glass [color].
**Don't use it on:** "Don't use Liquid Glass in the content layer" [materials]. Cards, hero, pricing, calendar grid and list sections get solid or standard-material surfaces. One exception: a toggle knob may turn glass *while it is being pressed* [materials]. "Use Liquid Glass effects sparingly" [materials]. Avoid "layering Liquid Glass elements on top of each other" [ALG]. Our cap is ≤3 glass surfaces per viewport [web].
**Variants:** *Regular* "blurs and adjusts the luminosity" of what's behind it. Use it for text-heavy surfaces (alerts, sidebars, popovers). *Clear* is "highly translucent" and meant only for surfaces over media; if the content behind is bright, add "a dark dimming layer of 35% opacity" [materials].
**Color on glass:** tint the *background* of the primary action, not its label. "Refrain from adding color to the background of multiple controls" [color]. Bar labels stay monochrome [tab-bars].
**Separation from content:** use a scroll edge effect rather than a solid bar background [layout]. "Scroll edge effects aren't decorative" [scroll-views].

```css
/* [web] approximation */
:root{ --glass-bg: rgb(255 255 255/.62); --glass-stroke: rgb(255 255 255/.55); --glass-specular: rgb(255 255 255/.75); }
.glass{ /* regular variant */
  background-color: var(--glass-bg);
  background-image: linear-gradient(180deg, rgb(255 255 255/.28), transparent 42%); /* sheen */
  -webkit-backdrop-filter: blur(24px) saturate(180%);
          backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-stroke);
  box-shadow: inset 0 1px 0 var(--glass-specular),   /* specular top edge */
              inset 0 -1px 0 rgb(0 0 0/.04),
              0 8px 32px rgb(40 0 60/.12), 0 1px 2px rgb(40 0 60/.08);
}
.glass--clear{ --glass-bg: rgb(255 255 255/.16); -webkit-backdrop-filter: blur(8px) saturate(160%); backdrop-filter: blur(8px) saturate(160%); }
.glass--clear.over-bright::before{ content:""; position:absolute; inset:0; border-radius:inherit; background:rgb(0 0 0/.35); } /* HIG 35% dim */
.glass--tint{ --glass-bg: color-mix(in srgb, var(--accent-fill) 90%, transparent); color:#fff; }
.scroll-edge{ position:fixed; inset:0 0 auto; height:calc(88px + env(safe-area-inset-top)); pointer-events:none;
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); mask-image:linear-gradient(#000 45%, transparent); }
@media (prefers-color-scheme: dark){ :root{ --glass-bg: rgb(28 28 30/.58); --glass-stroke: rgb(255 255 255/.12); --glass-specular: rgb(255 255 255/.18); } }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more){
  .glass,.glass--clear,.scroll-edge{ -webkit-backdrop-filter:none; backdrop-filter:none; background:var(--bg-elevated); } }
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){ .glass{ background:var(--bg-elevated); } }
```

## 3. Typography
iOS Dynamic Type at the Large (default) size [typography]. Mapping rule [web]: 1 pt = 1 CSS px, root left at 100% (16px), so the rem value is pt/16. Line-height is leading ÷ size.

| Style | pt | Leading | Weight (emph.) | rem | line-height |
|---|---|---|---|---|---|
| Large Title | 34 | 41 | 400 (700) | 2.125 | 1.206 |
| Title 1 | 28 | 34 | 400 (700) | 1.75 | 1.214 |
| Title 2 | 22 | 28 | 400 (700) | 1.375 | 1.273 |
| Title 3 | 20 | 25 | 400 (600) | 1.25 | 1.25 |
| Headline | 17 | 22 | 600 (600) | 1.0625 | 1.294 |
| Body | 17 | 22 | 400 (600) | 1.0625 | 1.294 |
| Callout | 16 | 21 | 400 (600) | 1 | 1.3125 |
| Subhead | 15 | 20 | 400 (600) | .9375 | 1.333 |
| Footnote | 13 | 18 | 400 (600) | .8125 | 1.385 |
| Caption 1 | 12 | 16 | 400 (600) | .75 | 1.333 |
| Caption 2 | 11 | 13 | 400 (600) | .6875 | 1.182 |

- Default text is 17pt and the minimum is 11pt [typography]. "Avoid Ultralight, Thin, and Light" weights [typography]. Marketing display sizes may exceed Large Title: `clamp(2.125rem, 1.4rem + 3vw, 3.75rem)` [web].
- Tracking: "the system font dynamically adjusts tracking"; HIG's tracking table (17pt −0.43pt, 34pt +0.40pt) is for mockups [typography]. Leave `letter-spacing: normal` [web].
- Font stack [web]: `-apple-system, BlinkMacSystemFont, "Inter", system-ui, "Segoe UI", Roboto, sans-serif; font-optical-sizing:auto`. SF Pro is licensed only for Apple platforms: reference it only via the system keywords and never self-host it. Self-host Inter (OFL) as the close fallback. SF Symbols carry the same restriction, so use an open SVG icon set. Icons need "a consistent size, level of detail, stroke thickness (or weight), and perspective"; "match the weights of interface icons and adjacent text"; center them optically; give custom icons alt labels [icons].
- "Minimize the number of typefaces" [typography]. An optional brand display face is allowed for headlines only, with the system font for body and captions [branding].

## 4. Color
HIG: "Avoid hard-coding system color values… actual color values may fluctuate from release to release" [color]. The web has no system colors, so we freeze these values as tokens.

| Token | Light | Dark | Inc. contrast L | Inc. contrast D | Source |
|---|---|---|---|---|---|
| systemPurple | #CB30E0 | #DB34F2 | #B02FC2 | #EA8DFF | [color] |
| systemGray | #8E8E93 | #8E8E93 | #6C6C70 | #AEAEB2 | [color] |
| Gray2 | #AEAEB2 | #636366 | #8E8E93 | #7C7C80 | [color] |
| Gray3 | #C7C7CC | #48484A | #AEAEB2 | #545456 | [color] |
| Gray4 | #D1D1D6 | #3A3A3C | #BCBCC0 | #444446 | [color] |
| Gray5 | #E5E5EA | #2C2C2E | #D8D8DC | #363638 | [color] |
| Gray6 | #F2F2F7 | #1C1C1E | #EBEBF0 | #242426 | [color] |

HIG defines the roles (label, secondaryLabel, separator, opaqueSeparator, and system vs grouped backgrounds as primary/secondary/tertiary) [color] but does not publish their values. The values below are UIKit's [UIKit]; verify them against Apple Design Resources.
- label: #000 / #FFF
- secondaryLabel: rgb(60 60 67/.6) / rgb(235 235 245/.6)
- tertiaryLabel: rgb(60 60 67/.3) / rgb(235 235 245/.3)
- separator: rgb(60 60 67/.29) / rgb(84 84 88/.6)
- opaqueSeparator: #C6C6C8 / #38383A
- systemBackground: #FFF / #000; secondary #F2F2F7 / #1C1C1E; tertiary #FFF / #2C2C2E
- groupedBackground: #F2F2F7 / #000; secondaryGrouped #FFF / #1C1C1E; tertiaryGrouped #F2F2F7 / #2C2C2E
- fill (tertiarySystemFill): rgb(118 118 128/.12) / rgb(118 118 128/.24)
- Dark mode has *elevated* backgrounds for sheets and popovers [dark-mode]: #1C1C1E / #2C2C2E / #3A3A3C [UIKit]. Set `--bg-elevated` to #FFF in light mode and #1C1C1E in dark.

**Contrast decisions** (WCAG 2 ratios we computed; thresholds are 4.5:1 for text ≤17pt and 3:1 for ≥18pt or bold [accessibility], and HIG says "strive for… 7:1, especially in small text" [dark-mode]):
- #CB30E0 on white is **4.17:1, which fails for body text**. Accent text and links in light mode use **#B02FC2** (5.21:1 on #FFF, 4.67:1 on #F2F2F7). Keep #CB30E0 for decoration or large text.
- `--accent-fill` is **#B02FC2 in both modes** (white label 5.21:1). White on #DB34F2 is only 3.63:1.
- Dark accent text is #DB34F2 (5.79:1 on #000, 4.69:1 on #1C1C1E). With `prefers-contrast: more`, use #EA8DFF (7.9:1).
- UIKit secondaryLabel in light mode is 3.44:1 on white. For small web text raise the alpha to **.72** (4.72:1), or .74 on #F2F2F7 [web]. systemGray (3.26:1) is for icons and borders only, never text.
- Provide "an increased contrast option for each variant" [color] via `@media (prefers-contrast: more)`.
- "Avoid relying solely on color" [color]: pair state with an icon or text.

## 5. Layout
- Controls default to 44×44pt with a 28×28pt minimum [accessibility]. "A button needs a hit region of at least 44x44 pt" [buttons]; on the web that means 44 CSS px.
- Add "about 12 points of padding around elements that include a bezel" and "about 24 points" around unbezeled ones [accessibility].
- Margins are 16px when compact and 20px when wide [UIKit]. Spacing scale: 4/8/12/16/20/24/32/44/64. Text measure ≤ 70ch [web].
- Breakpoints follow size classes, not device [layout]: <744px is compact (bottom tab bar); ≥744px is regular (top nav; admin sidebar). "Keep functionality the same as size classes change" [layout].
- Safe areas: "Respecting the safe area is essential" [layout]. Use `viewport-fit=cover` and pad fixed bars with `env(safe-area-inset-*)` [web]. Extend hero and background content under the bars [layout].
- On phones, put key controls in the middle or bottom of the screen [designing-for-ios].
- **Concentric radii:** make custom components' "corner radius… concentric with the bar's corners" [toolbars]; shapes should be "concentric to their containers" [ALG]. Formula [web]: inner radius = outer radius − inset.
  - Sheet 32px radius with 12px padding gives a 20px inner card.
  - Tab bar 64px tall (radius 32) with a 4px inset gives a 28px selected pill.
  - Grouped sections use a 24px radius, since "Sections have an increased corner radius" [ALG].
  - Standalone controls are capsules (`border-radius: 999px`).

## 6. Components (web)
- **Glass nav bar:**
  - Fixed, height 56px plus the top safe area; on ≥744px it floats as a 12px-inset capsule. Uses `.glass` with `.scroll-edge` beneath.
  - Title under 15 characters, never the site name [toolbars]; keep the logo minimal [branding].
  - "Only specify one primary action, and put it on the trailing side" [toolbars]: "Check Availability".
  - Every icon gets an `aria-label` [ALG].
- **Floating tab bar** (mobile site and admin): "floats above content at the bottom" on glass [tab-bars].
  - Inset 16px from the sides, height 64px, bottom at `env(safe-area-inset-bottom)+8px`.
  - 3–5 tabs with filled icons and one-word labels. The selected tab gets an accent icon and label over a fill pill.
  - Navigation only, no actions. Never hide or disable a tab [tab-bars].
  - May minimize on scroll down [tab-bars]; turn that off under reduced motion.
  - ≥744px in admin: glass sidebar, "no more than two levels of hierarchy" [sidebars].
- **Buttons** (capsule; heights 32/44/52px, adapted from the visionOS size table in [buttons]):
  - **Primary:** `--accent-fill` background, white 17px/600 label, 0 20px padding. "one or two per view" [buttons].
  - **Secondary:** fill `rgb(118 118 128/.12)` with accent text. Over media, use `.glass`.
  - **Tinted:** `color-mix(in srgb,var(--accent-fill) 14%,transparent)` background with accent text.
  - "Always include a press state" [buttons]: `scale(.97)` plus `brightness(.92)`. Focus ring is 3px accent at 2px offset [web].
  - Destructive buttons are red and never primary [buttons].
  - In-flight actions show a spinner and change the label, e.g. "Booking…" [buttons]. Labels are verb-first title case [buttons][writing].
- **Segmented control:** track uses the fill color on a 36px capsule (44px under `pointer:coarse`). The selected thumb is #FFF (dark: #636366) with a small shadow.
  - Equal-width segments, ≤5 on phone, nouns, and "either text or images — not a mix" [segmented-controls].
  - Implement as a `radiogroup` with arrow-key support [web].
- **Stepper:** a −/+ capsule of two 44px targets, always next to its visible value [steppers].
  - For guest count, pair it with a numeric field (`inputmode="numeric"`) because values "vary widely" [steppers]. Shift+click steps by ×10 [steppers].
- **Date picker/calendar:** shown in context, so "avoid switching views" [pickers].
  - The wizard uses an inline calendar; admin filters use a compact button showing the date in accent that opens a popover [pickers].
  - Time slots use a minute interval that "divides evenly into 60" (15 or 30) [pickers]. Format dates by locale with `Intl.DateTimeFormat` [pickers].
  - Day cells are 44px. Selected: accent-fill circle with a white numeral. Today: accent numeral. Unavailable: tertiaryLabel plus strikethrough, so color isn't the only signal [accessibility].
  - The calendar is content, so no glass [materials].
- **Sheet** (`<dialog>`): for scoped tasks such as add-ons, a space's details, or editing a booking [sheets].
  - HIG says to "consider alternatives to sheets" for long flows [sheets]. The full booking wizard is a full page on mobile and a centered form sheet on desktop.
  - Detents: medium ≈ 50dvh and large ≈ full height [sheets]. At medium the sheet is inset from the edges [ALG] by 8px [web]; at large it becomes more opaque [ALG].
  - Grabber 36×5px [web]. Swipe down, Esc, and a Close button all dismiss; confirm first if there are unsaved changes [sheets][accessibility]. One sheet at a time [sheets].
  - Button placement [sheets]: step 1 has Cancel leading and an inactive Done/Next trailing. Later steps: "the Back button replaces the Cancel button". Final step: Back + Done. Never show all three.
- **Inset grouped list** (admin settings, booking summary): page on groupedBackground, sections on secondaryGrouped with a 24px radius and 16/20px margins [color][ALG].
  - Rows are ≥52px [web], since lists got "a larger row height and padding" [ALG]. Separators are 0.5px, inset 16px.
  - Section headers use title-style capitalization, not all caps [ALG]. Use a chevron for navigation rows [lists-and-tables].
  - Admin tables: sortable headers where a second click reverses the order, resizable columns, and alternating rows [lists-and-tables].
- **Text field:** 48px tall, radius 12px, fill background, no border, 2px accent focus ring, 17px text [web]. At 17px iOS Safari won't zoom on focus.
  - Keep a visible label, because placeholders disappear [text-fields]. Hint text like "name@example.com" [writing].
  - Trailing clear button [text-fields]. Set the right `type`, `autocomplete` and `inputmode` [text-fields].
  - Validate email on blur [text-fields]. Errors sit next to the field and say how to fix the problem [writing].
- **Toggle:** use the switch "only in a list row" [toggles]; `role="switch"`. Track ~51×31px [UIKit].
  - Default green (#34C759 / #30D158 [color]); switch to accent only if needed [toggles]. State must not rely on color alone [toggles].
  - Outside lists, use an `aria-pressed` toggle button instead [toggles].
- **Toasts/feedback:** use a glass capsule banner with an icon, text, and an explicit close or Undo, placed above the tab bar or below the nav.
  - "Minimize use of time-boxed interface elements… Prefer dismissing views with an explicit action" [accessibility]: no timer-only dismissal. Non-critical toasts may auto-hide after ≥6s but pause on hover or focus.
  - Confirm only significant events, such as "Booking request sent" [feedback]. Use alerts only for critical or irreversible actions, such as forfeiting a deposit [feedback].
  - `role="status"` for toasts, `role="alert"` for errors [web].
  - Loading: "Show something as soon as possible" with skeletons [loading]. Use a determinate "Step 2 of 4" indicator [progress-indicators] and avoid a vague "Loading" [progress-indicators].

## 7. Motion
- HIG gives rules, not numbers [motion]: "Add motion purposefully", "Make motion optional", "Aim for brevity and precision", "avoid adding motion to UI interactions that occur frequently", and "Let people cancel motion".
- Tokens [web]:
  - `--dur-fast:150ms` for press, hover and toggle.
  - `--dur-base:250ms` for the segmented thumb and popovers.
  - `--dur-slow:380ms` for presenting a sheet; dismissal takes 250ms with `cubic-bezier(.4,0,1,1)`.
  - `--ease-out-spring: cubic-bezier(.32,.72,0,1)` for sheets and bars (no overshoot). `--ease-bounce: cubic-bezier(.34,1.36,.64,1)` only for glass press-release.
- Reduced motion follows the list in [accessibility]:
  - Tighten springs (switch the bounce easing to `ease-out`).
  - Replace x/y/z transitions with opacity fades.
  - No zoom or scale, no animating into or out of blur, no parallax or auto-advancing carousels, and no tab-bar minimize.
- Hero video: visible pause, no autoplay audio [accessibility].

```css
@media (prefers-reduced-motion: reduce){
  :root{ --ease-bounce: ease-out; --ease-out-spring: ease-out; }
  .sheet,.toast,.tabbar{ transform:none!important; transition-property:opacity; }
  *{ scroll-behavior:auto!important; animation-iteration-count:1!important; }
}
```

## 8. Accessibility
- **Dynamic Type equivalent:** all type uses rem and never sets a px root. "Enlarge text by at least 200 percent" [accessibility].
  - At large sizes, stack side-by-side items and "Reduce the number of columns" [typography]. Minimize truncation [typography].
- **Contrast:** apply §4. Test glass over the *worst* hero frame [color].
- **Reduce Transparency and Increase Contrast:** under `prefers-reduced-transparency` or `prefers-contrast: more`, glass becomes opaque `--bg-elevated` (see the §2 CSS). Increased contrast also swaps in the palette's increased-contrast column [materials][color][ALG].
- **Appearance:** follow `prefers-color-scheme`. "Avoid offering an app-specific appearance setting" [dark-mode]. Slightly dim white-background images in dark mode [dark-mode].
- **Input:** full keyboard operation, a logical tab order, visible focus, and an alternative to every gesture [accessibility][text-fields].
- **Wizard:** from the Assistive Access guidance in [accessibility], apply "focus on a single interaction per screen" and confirm destructive admin actions twice.