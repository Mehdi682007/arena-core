# Arena Core design system

F9.1 uses a dependency-free, light-only CSS design system. Tokens cover accessible color roles,
spacing, radii, shadows, typography, and focus. Components consume semantic tokens instead of
literal colors. Persian is the default (`lang=fa`, `dir=rtl`), layout uses logical properties, and
emails, IDs, handles, and codes use isolated LTR spans.

Primitives include buttons, icon buttons, fields, inputs, password inputs, textarea, select,
checkbox, cards, badges, alerts, spinner, skeleton, empty/error states, native dialog, native
details-based dropdown, tabs, avatar, separator, and tooltip foundation. Native dialog/details
were chosen to avoid adding a large UI framework while retaining browser keyboard semantics.

The shell switches from desktop sidebar to a five-item mobile navigation. Focus visibility,
skip-link, reduced-motion, semantic labels, error associations, disabled/loading states, and
horizontal table overflow form the accessibility baseline. Dark mode is intentionally deferred
until its contrast and persistence policy can be completed.
