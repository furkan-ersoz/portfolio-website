// ─────────────────────────────────────────────────────────────
// SITE SETTINGS
// Your name, email and social links live here.
// Edit the text between the quotes and save — nothing else needed.
// ─────────────────────────────────────────────────────────────

export const site = {
  name: 'Furkan Ersöz',
  description:
    'Portfolio of Furkan Ersöz — music information retrieval researcher, computer engineer, musician and mixing engineer.',
  email: 'hfurkanersoz@gmail.com',
  // The site's source code (linked in the footer)
  sourceCode: 'https://github.com/furkan-ersoz/portfolio-website',
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
  { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/furkan-ersoz/' },
  { label: 'GitHub', icon: 'github', url: 'https://github.com/furkan-ersoz' },
  { label: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/furkan.ersoz/' },
  { label: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@furkan_ersoz' },
  { label: 'Spotify', icon: 'spotify', url: 'TODO' }, // TODO: add when the artist profile exists
] as const;
