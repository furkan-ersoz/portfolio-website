// ─────────────────────────────────────────────────────────────
// SITE SETTINGS
// Your name, email and social links live here.
// Edit the text between the quotes and save — nothing else needed.
// ─────────────────────────────────────────────────────────────

export const site = {
  name: 'Hanifi Furkan Ersöz',
  subtitle: 'Music information retrieval · Sound & music computing · Musician & mixing engineer',
  description:
    'Portfolio of Hanifi Furkan Ersöz — music information retrieval researcher, computer engineer, musician and mixing engineer.',
  email: 'hfurkanersoz@gmail.com',
};

// Main navigation (header + homepage buttons). Order matters.
export const nav = [
  { label: 'Listen', href: '/listen' },
  { label: 'Projects', href: '/projects' },
  { label: 'Concerts', href: '/concerts' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// Social links shown on the Contact page.
// Replace each 'TODO' with your full profile URL, e.g. 'https://github.com/furkan-ersoz'.
// A link whose url is still 'TODO' is shown greyed out and isn't clickable.
export const socials = [
  { label: 'LinkedIn', icon: 'linkedin', url: 'TODO' },
  { label: 'GitHub', icon: 'github', url: 'TODO' },
  { label: 'Instagram', icon: 'instagram', url: 'TODO' },
  { label: 'Spotify', icon: 'spotify', url: 'TODO' },
] as const;
