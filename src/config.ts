import type { AccentColor, BaseColor } from './colors';

// Environment-specific configuration
const isDev = process.env.NODE_ENV === 'development';
const isVercel = process.env.VERCEL === '1';

// Production flag
export const PROD = !isDev;

// Base URL configuration
export const BASE = isDev ? '' : isVercel ? '' : '/ask-municipal-memory';

// Site URL configuration
export const SITE = isDev
  ? 'http://localhost:4321'
  : isVercel
    ? 'https://ask-municipal-memory.vercel.app'
    : 'https://alice.github.io';

// MORE SETTINGS:

// will be used for the the title and meta tags and in the header (if SITE_NAME is left blank)
export const SITE_TITLE = 'Mémoires municipales';

// will be used in the meta tags (and for example shown in search results)
export const SITE_DESCRIPTION = 'A blog about municipal memory and knowledge management';

// will be used as the icon in the header and the favicon
export const SITE_FAVICON = '📚';

// will be used in the footer as the name of the author (c) <YEAR> <NAME> - LICENSE
export const NAME = 'Alice';

// will be used in the footer as the license of the content (e.g. "All right reserved" or "CC-BY-SA 4.0")
export const LICENSE = 'MIT licensed.';

export const SOURCE_LINK = 'https://github.com/Alice-Po/ask-municipal-memory';

// will be used to set the base color of the blog
export const BASE_COLOR: BaseColor = 'stone';

// will be used to set the accent color of the blog
export const ACCENT_COLOR: AccentColor = 'pink';

// will show all icons that are not empty in the footer as links
export const SOCIAL_LINKS: {
  FACEBOOK_URL?: string;
  TWITTER_URL?: string;
  GITHUB_URL?: string;
  INSTAGRAM_URL?: string;
  LINKEDIN_URL?: string;
  YOUTUBE_URL?: string;
  SUBSTACK_URL?: string;
  EMAIL?: string;
  BLUESKY_URL?: string;
  SHOW_RSS?: boolean;
} = {
  SHOW_RSS: false,
  GITHUB_URL: 'https://github.com/Alice-Po/ask-municipal-memory',
  EMAIL: 'alicepoggioli.fr/#contact-form',
};

// EVEN MORE SETTINGS:

// if true, will show theme toggle in header (otherwise theme is automatically detected and can't be changed by the readers)
export const MANUAL_DARK_MODE = true;

// if true, will enable the search functionality
export const SEARCH_ENABLED = true;

// if true, will show images in the posts
export const SHOW_IMAGES = true;

// will be used to set the number of posts per page
export const POSTS_PER_PAGE = 8;

// will be shown in the header, if left blank will instead show the SITE_TITLE
export const SITE_NAME = '';

// if true, will show the SITE_FAVICON in the header
export const SHOW_FAVICON_IN_HEADER = true;
