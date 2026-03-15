import { config as dotenvConfig } from 'dotenv';
import { connect, connection, disconnect } from 'mongoose';
import { sanitizeForLogs } from '../../../shared/logging/sanitize-for-logs';

dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env' });

interface SeedModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

interface SeedModifierGroup {
  id: string;
  name: string;
  type: 'protein' | 'toppings' | 'sauces';
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: SeedModifierOption[];
}

interface SeedMenuItem {
  sku: string;
  name: string;
  description: string;
  category: string;
  basePriceCents: number;
  isCustomizable: boolean;
  modifierGroups: SeedModifierGroup[];
}

const customizableBowlGroups: SeedModifierGroup[] = [
  {
    id: 'protein',
    name: 'Protein',
    type: 'protein',
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: 'chicken', name: 'Chicken', priceDeltaCents: 0 },
      { id: 'beef', name: 'Beef', priceDeltaCents: 150 },
      { id: 'tofu', name: 'Tofu', priceDeltaCents: 0 },
    ],
  },
  {
    id: 'toppings',
    name: 'Toppings',
    type: 'toppings',
    required: false,
    minSelect: 0,
    maxSelect: 3,
    options: [
      { id: 'avocado', name: 'Avocado', priceDeltaCents: 120 },
      { id: 'pickled-onion', name: 'Pickled Onion', priceDeltaCents: 50 },
      { id: 'jalapeno', name: 'Jalapeno', priceDeltaCents: 40 },
      { id: 'corn', name: 'Corn', priceDeltaCents: 30 },
    ],
  },
  {
    id: 'sauces',
    name: 'Sauces',
    type: 'sauces',
    required: false,
    minSelect: 0,
    maxSelect: 2,
    options: [
      { id: 'chipotle-mayo', name: 'Chipotle Mayo', priceDeltaCents: 35 },
      { id: 'garlic-aioli', name: 'Garlic Aioli', priceDeltaCents: 35 },
      { id: 'teriyaki', name: 'Teriyaki', priceDeltaCents: 25 },
    ],
  },
];

const seedMenu: SeedMenuItem[] = [
  {
    sku: 'BOWL-CLASSIC',
    name: 'Classic Bowl',
    description: 'Rice bowl with fresh vegetables and your selected protein.',
    category: 'Bowls',
    basePriceCents: 1090,
    isCustomizable: true,
    modifierGroups: customizableBowlGroups,
  },
  {
    sku: 'BOWL-SPICY',
    name: 'Spicy Bowl',
    description: 'Signature spicy bowl with customizable protein and toppings.',
    category: 'Bowls',
    basePriceCents: 1190,
    isCustomizable: true,
    modifierGroups: customizableBowlGroups,
  },
  {
    sku: 'DRINK-LEMONADE',
    name: 'House Lemonade',
    description: 'Freshly squeezed lemonade.',
    category: 'Drinks',
    basePriceCents: 350,
    isCustomizable: false,
    modifierGroups: [],
  },
  {
    sku: 'DRINK-ICED-TEA',
    name: 'Iced Tea',
    description: 'Black tea with light citrus.',
    category: 'Drinks',
    basePriceCents: 320,
    isCustomizable: false,
    modifierGroups: [],
  },
  {
    sku: 'SIDE-FRIES',
    name: 'Crispy Fries',
    description: 'Golden fries with sea salt.',
    category: 'Sides',
    basePriceCents: 450,
    isCustomizable: false,
    modifierGroups: [],
  },
  {
    sku: 'SIDE-SALAD',
    name: 'Garden Salad',
    description: 'Mixed greens with vinaigrette.',
    category: 'Sides',
    basePriceCents: 490,
    isCustomizable: false,
    modifierGroups: [],
  },
  {
    sku: 'DESSERT-BROWNIE',
    name: 'Chocolate Brownie',
    description: 'Warm brownie with chocolate chips.',
    category: 'Desserts',
    basePriceCents: 420,
    isCustomizable: false,
    modifierGroups: [],
  },
];

const run = async (): Promise<void> => {
  const uri =
    process.env.MONGODB_URI ??
    'mongodb://root:root@localhost:27017/restaurant?authSource=admin';
  const dbName = process.env.MONGODB_DB_NAME ?? 'restaurant';

  await connect(uri, { dbName });

  const collection = connection.collection('menu_items');

  for (const item of seedMenu) {
    await collection.updateOne(
      { sku: item.sku },
      {
        $set: {
          name: item.name,
          description: item.description,
          category: item.category,
          basePriceCents: item.basePriceCents,
          isCustomizable: item.isCustomizable,
          modifierGroups: item.modifierGroups,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  await disconnect();
};

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Menu seed migration completed successfully.');
  })
  .catch(async (error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Menu seed migration failed:', sanitizeForLogs(error));
    await disconnect();
    process.exit(1);
  });
