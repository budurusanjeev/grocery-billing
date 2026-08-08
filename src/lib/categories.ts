// Matches the natural grouping in seed.json; categories not listed here
// (e.g. "Custom", from shopkeeper-added items) are appended at the end.
export const CATEGORY_ORDER = [
  'Rice & Grains',
  'Pulses',
  'Flours',
  'Oils & Ghee',
  'Spices',
  'Sugar & Salt',
  'Tea & Coffee',
  'Biscuits & Snacks',
  'Soaps & Detergents',
  'Personal Care',
  'Kitchen Essentials',
  'Dairy & Bread',
  'Vegetables',
];
export const ALL_CATEGORIES = [...CATEGORY_ORDER, 'Custom'];

// No real product photos exist in the catalog — a colorful category emoji
// stands in as the "image" on quick-add grid tiles, cheap to render and
// recognizable at a glance without needing an image asset pipeline.
export const categoryEmoji: Record<string, string> = {
  'Rice & Grains': '🌾',
  Pulses: '🫘',
  Flours: '🌾',
  'Oils & Ghee': '🫗',
  Spices: '🌶️',
  'Sugar & Salt': '🧂',
  'Tea & Coffee': '☕',
  'Biscuits & Snacks': '🍪',
  'Soaps & Detergents': '🧼',
  'Personal Care': '🪥',
  'Kitchen Essentials': '🧽',
  'Dairy & Bread': '🥛',
  Vegetables: '🥦',
  Custom: '🛒',
};

export function iconFor(category: string): string {
  return categoryEmoji[category] ?? '🛒';
}