/**
 * POS Terminal Item Catalog
 * Hardcoded items for merchant Point of Sale functionality
 * Prices stored in cents (smallest unit) for precision
 */

export interface PosItem {
  id: string;
  name: string;
  description: string;
  priceCents: number; // Price in cents
  icon: string; // Emoji icon
  category: "medicines" | "supplies" | "devices";
}

/**
 * Medical shop themed catalog
 * Prices are in cents for precision, converted to token amount when needed
 */
export const POS_ITEMS: PosItem[] = [
  {
    id: "paracetamol",
    name: "Paracetamol",
    description: "20 tablets",
    priceCents: 599, // $5.99
    icon: "💊",
    category: "medicines",
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    description: "30 tablets",
    priceCents: 749, // $7.49
    icon: "💊",
    category: "medicines",
  },
  {
    id: "vitamin-c",
    name: "Vitamin C",
    description: "60 capsules",
    priceCents: 1299, // $12.99
    icon: "🍊",
    category: "medicines",
  },
  {
    id: "bandages",
    name: "Bandages",
    description: "Pack of 10",
    priceCents: 450, // $4.50
    icon: "🩹",
    category: "supplies",
  },
  {
    id: "antiseptic",
    name: "Antiseptic",
    description: "100ml spray",
    priceCents: 625, // $6.25
    icon: "🧴",
    category: "supplies",
  },
  {
    id: "thermometer",
    name: "Thermometer",
    description: "Digital",
    priceCents: 1599, // $15.99
    icon: "🌡️",
    category: "devices",
  },
  {
    id: "cough-syrup",
    name: "Cough Syrup",
    description: "150ml",
    priceCents: 875, // $8.75
    icon: "🍯",
    category: "medicines",
  },
  {
    id: "first-aid-kit",
    name: "First Aid Kit",
    description: "Basic kit",
    priceCents: 2499, // $24.99
    icon: "🏥",
    category: "supplies",
  },
];

/**
 * Format price in cents to dollar display string
 * @param cents - Price in cents
 * @returns Formatted dollar string (e.g., "$4.75")
 */
export function formatPriceCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainingCents = cents % 100;
  return `$${dollars}.${remainingCents.toString().padStart(2, "0")}`;
}

/**
 * Calculate total from cart items
 * @param cart - Map of item ID to item and quantity
 * @returns Total in cents
 */
export function calculateCartTotal(
  cart: Map<string, { item: PosItem; quantity: number }>
): number {
  let total = 0;
  cart.forEach(({ item, quantity }) => {
    total += item.priceCents * quantity;
  });
  return total;
}

/**
 * Calculate total number of items in cart
 * @param cart - Map of item ID to item and quantity
 * @returns Total quantity
 */
export function calculateCartItemCount(
  cart: Map<string, { item: PosItem; quantity: number }>
): number {
  let count = 0;
  cart.forEach(({ quantity }) => {
    count += quantity;
  });
  return count;
}

/**
 * Convert cents to token amount string (with 18 decimals)
 * Assuming 1 token = $1 USD for simplicity
 * @param cents - Price in cents
 * @returns Token amount as string with 2 decimal places
 */
export function centsToTokenAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
