# ADR-0030: User Web foundation and design system

Status: Accepted

Arena Core uses Next.js App Router server components for route protection and initial private
fetches, with small client islands for forms and mutations. A dependency-free tokenized CSS
system supplies the F9.1 primitives, RTL layout, responsive shell, and accessibility baseline.
Native browser dialog/details primitives avoid a UI framework dependency.

The Web uses the backend's HttpOnly cookie and Origin-plus-JSON CSRF policy. A same-origin Next
proxy preserves credentials without exposing the API URL or tokens to client code. Public
leaderboards may be briefly cached; all private data is no-store. Backend authorization remains
authoritative.
