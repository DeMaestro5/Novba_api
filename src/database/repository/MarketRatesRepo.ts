
/**
 * Market rate data structure
 * This will store aggregated market rates by category
 * In production, this would be updated regularly from real invoice data
 */
interface MarketRate {
  category: string;
  subcategory?: string;
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
  location?: string;
  minRate: number;
  maxRate: number;
  avgRate: number;
  medianRate: number;
  currency: string;
  sampleSize: number;
  lastUpdated: Date;
}

/**
 * Seed market rates (MVP - simulate with real-world data)
 * In production, this would come from aggregated user data + external APIs
 */
const MARKET_RATES: MarketRate[] = [
  // Web Development
  {
    category: 'Web Development',
    subcategory: 'Full Stack',
    experienceLevel: 'BEGINNER',
    minRate: 25,
    maxRate: 50,
    avgRate: 35,
    medianRate: 35,
    currency: 'USD',
    sampleSize: 1234,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Full Stack',
    experienceLevel: 'INTERMEDIATE',
    minRate: 50,
    maxRate: 100,
    avgRate: 75,
    medianRate: 70,
    currency: 'USD',
    sampleSize: 2341,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Full Stack',
    experienceLevel: 'EXPERT',
    minRate: 100,
    maxRate: 200,
    avgRate: 150,
    medianRate: 145,
    currency: 'USD',
    sampleSize: 891,
    lastUpdated: new Date(),
  },
  
  // Frontend Development
  {
    category: 'Web Development',
    subcategory: 'Frontend',
    experienceLevel: 'BEGINNER',
    minRate: 20,
    maxRate: 45,
    avgRate: 30,
    medianRate: 30,
    currency: 'USD',
    sampleSize: 987,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Frontend',
    experienceLevel: 'INTERMEDIATE',
    minRate: 45,
    maxRate: 90,
    avgRate: 65,
    medianRate: 65,
    currency: 'USD',
    sampleSize: 1876,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Frontend',
    experienceLevel: 'EXPERT',
    minRate: 90,
    maxRate: 180,
    avgRate: 130,
    medianRate: 125,
    currency: 'USD',
    sampleSize: 654,
    lastUpdated: new Date(),
  },

  // Backend Development
  {
    category: 'Web Development',
    subcategory: 'Backend',
    experienceLevel: 'BEGINNER',
    minRate: 30,
    maxRate: 55,
    avgRate: 40,
    medianRate: 40,
    currency: 'USD',
    sampleSize: 876,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Backend',
    experienceLevel: 'INTERMEDIATE',
    minRate: 55,
    maxRate: 110,
    avgRate: 80,
    medianRate: 80,
    currency: 'USD',
    sampleSize: 1543,
    lastUpdated: new Date(),
  },
  {
    category: 'Web Development',
    subcategory: 'Backend',
    experienceLevel: 'EXPERT',
    minRate: 110,
    maxRate: 220,
    avgRate: 160,
    medianRate: 155,
    currency: 'USD',
    sampleSize: 543,
    lastUpdated: new Date(),
  },

  // Graphic Design
  {
    category: 'Graphic Design',
    subcategory: 'Logo Design',
    experienceLevel: 'BEGINNER',
    minRate: 15,
    maxRate: 35,
    avgRate: 25,
    medianRate: 25,
    currency: 'USD',
    sampleSize: 2341,
    lastUpdated: new Date(),
  },
  {
    category: 'Graphic Design',
    subcategory: 'Logo Design',
    experienceLevel: 'INTERMEDIATE',
    minRate: 35,
    maxRate: 75,
    avgRate: 55,
    medianRate: 50,
    currency: 'USD',
    sampleSize: 3214,
    lastUpdated: new Date(),
  },
  {
    category: 'Graphic Design',
    subcategory: 'Logo Design',
    experienceLevel: 'EXPERT',
    minRate: 75,
    maxRate: 150,
    avgRate: 110,
    medianRate: 105,
    currency: 'USD',
    sampleSize: 1234,
    lastUpdated: new Date(),
  },

  // UI/UX Design
  {
    category: 'Design',
    subcategory: 'UI/UX',
    experienceLevel: 'BEGINNER',
    minRate: 25,
    maxRate: 50,
    avgRate: 35,
    medianRate: 35,
    currency: 'USD',
    sampleSize: 1432,
    lastUpdated: new Date(),
  },
  {
    category: 'Design',
    subcategory: 'UI/UX',
    experienceLevel: 'INTERMEDIATE',
    minRate: 50,
    maxRate: 100,
    avgRate: 75,
    medianRate: 70,
    currency: 'USD',
    sampleSize: 2145,
    lastUpdated: new Date(),
  },
  {
    category: 'Design',
    subcategory: 'UI/UX',
    experienceLevel: 'EXPERT',
    minRate: 100,
    maxRate: 200,
    avgRate: 145,
    medianRate: 140,
    currency: 'USD',
    sampleSize: 876,
    lastUpdated: new Date(),
  },

  // Content Writing
  {
    category: 'Content Writing',
    subcategory: 'Blog Posts',
    experienceLevel: 'BEGINNER',
    minRate: 10,
    maxRate: 25,
    avgRate: 15,
    medianRate: 15,
    currency: 'USD',
    sampleSize: 3421,
    lastUpdated: new Date(),
  },
  {
    category: 'Content Writing',
    subcategory: 'Blog Posts',
    experienceLevel: 'INTERMEDIATE',
    minRate: 25,
    maxRate: 60,
    avgRate: 40,
    medianRate: 40,
    currency: 'USD',
    sampleSize: 4532,
    lastUpdated: new Date(),
  },
  {
    category: 'Content Writing',
    subcategory: 'Blog Posts',
    experienceLevel: 'EXPERT',
    minRate: 60,
    maxRate: 150,
    avgRate: 95,
    medianRate: 90,
    currency: 'USD',
    sampleSize: 1876,
    lastUpdated: new Date(),
  },

  // Video Editing
  {
    category: 'Video Production',
    subcategory: 'Video Editing',
    experienceLevel: 'BEGINNER',
    minRate: 20,
    maxRate: 40,
    avgRate: 30,
    medianRate: 30,
    currency: 'USD',
    sampleSize: 1543,
    lastUpdated: new Date(),
  },
  {
    category: 'Video Production',
    subcategory: 'Video Editing',
    experienceLevel: 'INTERMEDIATE',
    minRate: 40,
    maxRate: 85,
    avgRate: 60,
    medianRate: 60,
    currency: 'USD',
    sampleSize: 2341,
    lastUpdated: new Date(),
  },
  {
    category: 'Video Production',
    subcategory: 'Video Editing',
    experienceLevel: 'EXPERT',
    minRate: 85,
    maxRate: 175,
    avgRate: 125,
    medianRate: 120,
    currency: 'USD',
    sampleSize: 987,
    lastUpdated: new Date(),
  },

  // Social Media Management
  {
    category: 'Marketing',
    subcategory: 'Social Media Management',
    experienceLevel: 'BEGINNER',
    minRate: 15,
    maxRate: 30,
    avgRate: 22,
    medianRate: 20,
    currency: 'USD',
    sampleSize: 2134,
    lastUpdated: new Date(),
  },
  {
    category: 'Marketing',
    subcategory: 'Social Media Management',
    experienceLevel: 'INTERMEDIATE',
    minRate: 30,
    maxRate: 65,
    avgRate: 45,
    medianRate: 45,
    currency: 'USD',
    sampleSize: 3214,
    lastUpdated: new Date(),
  },
  {
    category: 'Marketing',
    subcategory: 'Social Media Management',
    experienceLevel: 'EXPERT',
    minRate: 65,
    maxRate: 130,
    avgRate: 95,
    medianRate: 90,
    currency: 'USD',
    sampleSize: 1432,
    lastUpdated: new Date(),
  },

  // Data Analysis
  {
    category: 'Data Science',
    subcategory: 'Data Analysis',
    experienceLevel: 'BEGINNER',
    minRate: 30,
    maxRate: 60,
    avgRate: 45,
    medianRate: 45,
    currency: 'USD',
    sampleSize: 876,
    lastUpdated: new Date(),
  },
  {
    category: 'Data Science',
    subcategory: 'Data Analysis',
    experienceLevel: 'INTERMEDIATE',
    minRate: 60,
    maxRate: 120,
    avgRate: 90,
    medianRate: 85,
    currency: 'USD',
    sampleSize: 1234,
    lastUpdated: new Date(),
  },
  {
    category: 'Data Science',
    subcategory: 'Data Analysis',
    experienceLevel: 'EXPERT',
    minRate: 120,
    maxRate: 250,
    avgRate: 175,
    medianRate: 170,
    currency: 'USD',
    sampleSize: 543,
    lastUpdated: new Date(),
  },
];

/**
 * Get market rates by category and experience
 */
function getMarketRates(
  category?: string,
  subcategory?: string,
  experienceLevel?: string,
): MarketRate[] {
  let filtered = MARKET_RATES;

  if (category) {
    filtered = filtered.filter((rate) =>
      rate.category.toLowerCase().includes(category.toLowerCase()),
    );
  }

  if (subcategory) {
    filtered = filtered.filter((rate) =>
      rate.subcategory?.toLowerCase().includes(subcategory.toLowerCase()),
    );
  }

  if (experienceLevel) {
    filtered = filtered.filter(
      (rate) => rate.experienceLevel === experienceLevel.toUpperCase(),
    );
  }

  return filtered;
}

/**
 * Get all unique categories
 */
function getCategories(): string[] {
  const categories = new Set(MARKET_RATES.map((rate) => rate.category));
  return Array.from(categories).sort();
}

/**
 * Get subcategories for a category
 */
function getSubcategories(category: string): string[] {
  const subcategories = new Set(
    MARKET_RATES.filter((rate) => rate.category === category)
      .map((rate) => rate.subcategory)
      .filter((sub): sub is string => sub !== undefined),
  );
  return Array.from(subcategories).sort();
}

export default {
  getMarketRates,
  getCategories,
  getSubcategories,
  MARKET_RATES,
};