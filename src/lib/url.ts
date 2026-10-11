// Builds a link that works whether the site lives at "/" or at "/portfolio-website/".
// Use it for every internal link: withBase('/projects') → '/portfolio-website/projects'
export function withBase(path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}` || '/';
}

// Removes the base and trailing slash so pages can be compared: '/portfolio-website/projects/' → '/projects'
export function stripBase(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  p = p.replace(/\/$/, '');
  return p || '/';
}

export function formatDate(date: Date, label?: string): string {
  if (label) return label;
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
