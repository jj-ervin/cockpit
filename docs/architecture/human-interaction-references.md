# Human Interaction References — Cockpit

**Created:** 2026-07-14. Design reference for building Cockpit's presentation layer
(including the Helm UI surface). This is a learn-and-apply document, not a research
program: it distills existing published standards into build guidance.

Cockpit owns **host-level interaction presentation**: information density, navigation
style, font scale, motion, input emphasis, visual themes, accessibility presentation,
and interruption display. Collaboration behavior (agent initiative, confirmation gates)
belongs to Lasso; runtime enforcement belongs to eco.

## References and what to apply

| Reference | Apply in Cockpit / Helm UI |
| --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Hard baseline: keyboard operability for every control, visible focus, contrast ratios, 24×24 CSS px minimum pointer targets, honor reduced-motion, clear error identification. Audit existing panels against this first. |
| [W3C Cognitive Accessibility Guidance](https://www.w3.org/WAI/cognitive/) | Predictable layout and behavior, low memory demand, plain language, progressive disclosure instead of wall-of-controls. Directly shapes density and guidance modes. |
| [NASA Human Integration Design Handbook](https://www.nasa.gov/human-integration-design-handbook/) | Cockpit-style surface guidance: control placement and grouping, display hierarchy, alarm/alert design (severity-graded, not all-equal), labeling, error tolerance. Use when designing Helm mode indicators and escalation displays. |
| [ISO 9241-210:2019](https://www.iso.org/standard/77520.html) | Iterate against real use; involve the user's actual context (device, screen, urgency) in design decisions. |
| [NIST Human-Centered Design](https://www.nist.gov/itl/iad/human-centered-technologies/human-factors-human-centered-design) | Effectiveness/efficiency framing for demanding environments — relevant to Jäger-Modus precision-mode displays. |

## Presentation profile (Cockpit-owned keys)

```yaml
presentation:
  information_density: balanced
  font_scale: 1.1
  motion: reduced
  guidance_level: contextual
  shortcut_discovery: progressive
```

Invariants:

- Presentation preferences are portable across products that adopt the schema.
- A presentation change (theme, density, LCARS-style skin) must **never** silently
  change confirmation requirements, agent initiative, or any authority-sensitive
  collaboration setting.
- Jäger-Modus may override presentation defaults (density, interruption display) only
  under explicit human trigger, never silently.
- Progression: accessible defaults → explicit personalization → suggested adaptation →
  reversible automation. Adaptation must be inspectable.
