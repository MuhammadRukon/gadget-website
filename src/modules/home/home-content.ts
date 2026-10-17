/**
 * Static editorial content for the homepage sections.
 *
 * Everything here is meant to move to an admin-managed source later (the
 * banner CMS item in docs/product/FEATURE-GAPS.md). Until then it is plain
 * data: change copy, images and links here, not in the section components.
 *
 * Rule for this file: guidance and links only. No prices, stock counts,
 * delivery times, ratings or product claims; those come from the catalog.
 */

export interface HomeLink {
  label: string;
  href: string;
}

export interface HomeBanner {
  image: string;
  alt: string;
  title: string;
  subtitle: string;
  primary: HomeLink;
  secondary?: HomeLink;
}

export interface HomeStory {
  title: string;
  intro: string;
  /** Line drawing shown large while the steps scroll past. */
  drawing: string;
  steps: { term: string; text: string }[];
  cta: HomeLink;
}

export interface HomeTile {
  title: string;
  blurb: string;
  href: string;
  /** Optional drawing; tiles without one are set as type. */
  drawing?: string;
  tone: 'ink' | 'field' | 'raven';
}

export interface HomeStep {
  title: string;
  text: string;
  link?: HomeLink;
}

export const HOME_BANNER: HomeBanner = {
  image: '/banner.webp',
  alt: '',
  title: 'Sharp eyes for good tech.',
  subtitle: 'Phones, laptops and accessories with the price, stock and warranty on every page.',
  primary: { label: 'Shop all products', href: '/products' },
  secondary: { label: 'Browse phones', href: '/category/phones' },
};

export const HOME_STORY: HomeStory = {
  title: 'Before you buy earbuds',
  intro: 'Four things worth checking on any pair, whichever brand you pick.',
  drawing: '/earphone.svg',
  steps: [
    {
      term: 'Fit',
      text: 'Comfort decides how often you wear them. Check which ear tip sizes come in the box.',
    },
    {
      term: 'Battery',
      text: 'Compare the maker’s listed hours for the buds alone and with the charging case.',
    },
    {
      term: 'Connection',
      text: 'Make sure the Bluetooth version and codecs match the phone you already own.',
    },
    {
      term: 'Warranty',
      text: 'Every product page here shows its warranty term. Read it before you add to cart.',
    },
  ],
  cta: { label: 'Search earbuds', href: '/products?q=earbuds' },
};

export const HOME_TILES: HomeTile[] = [
  {
    title: 'Phones',
    blurb: 'Flagships and everyday phones.',
    href: '/category/phones',
    tone: 'ink',
  },
  {
    title: 'Laptops',
    blurb: 'For study, work and travel.',
    href: '/category/laptops',
    tone: 'field',
  },
  {
    title: 'Watches',
    blurb: 'Smartwatches and fitness bands.',
    href: '/products?q=watch',
    drawing: '/smartwatch.svg',
    tone: 'raven',
  },
  {
    title: 'Audio',
    blurb: 'Earbuds and headphones.',
    href: '/products?q=earbuds',
    drawing: '/earphone.svg',
    tone: 'field',
  },
  {
    title: 'Accessories',
    blurb: 'Chargers, cables and cases.',
    href: '/category/accessories',
    tone: 'field',
  },
];

export const HOME_STEPS: HomeStep[] = [
  {
    title: 'Choose',
    text: 'Price, stock, specifications and warranty are on the product page. Pick an option and add it to your cart.',
    link: { label: 'Browse products', href: '/products' },
  },
  {
    title: 'Check out',
    text: 'Delivery fee and the total are shown before you place the order. Pay with any method listed at checkout.',
  },
  {
    title: 'Track',
    text: 'Every order has a step-by-step timeline in your account, from confirmed to delivered.',
    link: { label: 'Your orders', href: '/account/orders' },
  },
  {
    title: 'After delivery',
    text: 'Review what you bought, or raise a warranty claim from the delivered order.',
    link: { label: 'Refund and return policy', href: '/refund-policy' },
  },
];

export const HOME_CLOSING = {
  title: 'Not sure which one?',
  text: 'Message us before you buy and ask anything about a product, an order or delivery.',
  whatsapp: { label: 'Ask on WhatsApp', href: 'whatsapp://send?phone=+8801815780053' },
  contact: { label: 'Other ways to reach us', href: '/contact' },
};
