# Web design system extensions

The canonical primitives and tokens remain in `design-system.md`. F9.3 reuses those components and
adds lightweight Admin composition styles: a responsive RTL shell, filter grid, semantic
scroll-safe tables, definition-list details, bounded text-only JSON blocks and semantic timelines.
No third-party dashboard, data-grid, chart, JSON editor or state-management dependency is used.

Admin tables require captions and scoped column headers. Forms require visible labels. Operational
actions use the native dialog element, restore control through normal browser focus behavior and
announce success or failure. Status text accompanies color, and all identifiers use isolated LTR
presentation.
