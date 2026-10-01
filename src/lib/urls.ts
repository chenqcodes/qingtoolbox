/** Canonical route paths are directory URLs; strip query/hash from SEO URLs. */
export function canonicalPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0];
  return `${path.replace(/\/+$/, '')}/`;
}

export function toolHref(tool: { slug: string; path?: string }): string {
  return canonicalPath(tool.path || `/tools/${tool.slug}`);
}
