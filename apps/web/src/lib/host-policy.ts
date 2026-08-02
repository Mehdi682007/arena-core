export function canonicalHostname(value: string | null): string | null {
  if (!value || /[\s\\/@]/.test(value)) return null;
  try {
    const url = new URL(`http://${value}`);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function configuredHostname(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function requestOriginForHost(host: string | null): string | null {
  const hostname = canonicalHostname(host);
  const publicOrigin = process.env.WEB_BASE_URL;
  const adminOrigin = process.env.ADMIN_ORIGIN;
  if (hostname && hostname === configuredHostname(adminOrigin)) return adminOrigin ?? null;
  if (hostname && hostname === configuredHostname(publicOrigin)) return publicOrigin ?? null;
  return null;
}

export function isAdminHostname(host: string | null): boolean {
  const hostname = canonicalHostname(host);
  return Boolean(hostname && hostname === configuredHostname(process.env.ADMIN_ORIGIN));
}
