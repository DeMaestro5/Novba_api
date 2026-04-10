import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Analyze a freelancer's hourly rate against market data.
 * Returns structured JSON matching the existing analyzeUndercharging response shape.
 */
export async function analyzeRateWithAI(params: {
  role: string;
  experienceLevel: string;
  currentRate: number;
  marketMin: number;
  marketMax: number;
  marketMedian: number;
  marketAverage: number;
  sampleSize: number;
}): Promise<{
  message: string;
  suggestedRate: number;
  confidence: number;
  reasoning: string;
  negotiationTips: string[];
}> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
You are a freelance pricing expert with deep knowledge of the global freelance market.

A freelancer is asking for a rate analysis. Here are the facts:
- Role/Skill: ${params.role}
- Experience Level: ${params.experienceLevel}
- Their current hourly rate: $${params.currentRate}/hr
- Market data for this role at this level (${params.sampleSize.toLocaleString()} data points):
  - Market minimum: $${params.marketMin}/hr
  - Market median: $${params.marketMedian}/hr
  - Market average: $${params.marketAverage}/hr
  - Market maximum: $${params.marketMax}/hr

Respond ONLY with a JSON object. No markdown, no backticks, no explanation outside the JSON.

{
  "message": "A direct, honest 1-2 sentence assessment of their rate vs the market. Be specific with numbers. If they're undercharging, say by how much. If they're competitive, acknowledge it.",
  "suggestedRate": <a specific number between marketMin and marketMax that you recommend, as an integer>,
  "confidence": <a number 70-95 representing confidence in this analysis>,
  "reasoning": "2-3 sentences explaining why you chose this suggested rate, referencing their experience level and the market data",
  "negotiationTips": ["tip 1", "tip 2", "tip 3"]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    throw err;
  }
}

/**
 * Estimate a project's value using AI analysis of the description.
 * Returns structured JSON matching the existing ProjectEstimate shape.
 */
export async function estimateProjectWithAI(params: {
  description: string;
  projectType: string;
}): Promise<{
  low: number;
  recommended: number;
  high: number;
  confidence: number;
  projectType: string;
  reasoning: string[];
  breakdown: { label: string; hours: number; rate: number; total: number }[];
  totalHours: number;
  analyzedKeywords: string[];
}> {
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a senior freelance pricing consultant. A freelancer wants to estimate the value of a project.

Project description: "${params.description}"
Pricing model: ${params.projectType} (FIXED or HOURLY)

Analyze this project and provide a realistic market-rate estimate. Consider:
- Project complexity based on the description
- Typical freelance market rates (USD)
- Reasonable scope and deliverables implied
- Common hourly rates: designers $75-150/hr, developers $85-175/hr, writers $50-100/hr, marketers $60-120/hr, generalists $60-110/hr

Respond ONLY with a JSON object. No markdown, no backticks, no explanation outside the JSON.

{
  "low": <conservative estimate as integer, round to nearest 100>,
  "recommended": <recommended estimate as integer, round to nearest 100>,
  "high": <premium estimate as integer, round to nearest 100>,
  "confidence": <integer 70-95>,
  "projectType": "<detected project category: brand/website/app/content/social/video/marketing/development/general>",
  "reasoning": [
    "<insight about pricing this type of project>",
    "<specific observation about this description>",
    "<tactical advice for proposing this project>"
  ],
  "breakdown": [
    { "label": "<phase name>", "hours": <integer>, "rate": <hourly rate integer> },
    { "label": "<phase name>", "hours": <integer>, "rate": <hourly rate integer> },
    { "label": "<phase name>", "hours": <integer>, "rate": <hourly rate integer> },
    { "label": "<phase name>", "hours": <integer>, "rate": <hourly rate integer> }
  ],
  "analyzedKeywords": ["<keyword1>", "<keyword2>", "<keyword3>"]
}

The breakdown should have exactly 4 phases. Each phase total (hours × rate) should sum roughly to the recommended value.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Add computed totals to breakdown
    parsed.breakdown = parsed.breakdown.map(
      (item: { label: string; hours: number; rate: number }) => ({
        ...item,
        total: item.hours * item.rate,
      }),
    );

    parsed.totalHours = parsed.breakdown.reduce(
      (sum: number, item: { hours: number }) => sum + item.hours,
      0,
    );

    return parsed;
  } catch (err) {
    throw err;
  }
}

/**
 * Generate personalized pricing recommendations using AI.
 */
export async function generateRecommendationsWithAI(params: {
  currentRate: number;
  marketMedian: number;
  experienceLevel: string;
  category: string;
  invoiceCount: number;
}): Promise<
  Array<{
    type: string;
    title: string;
    description: string;
    impact: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>
> {
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const annualHours = 40 * 48;
  const potentialIncrease = Math.round(
    (params.marketMedian - params.currentRate) * annualHours,
  );

  const prompt = `
You are a senior freelance business advisor. Generate actionable pricing recommendations for a freelancer.

Their profile:
- Category: ${params.category}
- Experience Level: ${params.experienceLevel}
- Current average rate: $${params.currentRate}/hr
- Market median for their role: $${params.marketMedian}/hr
- Invoices sent so far: ${params.invoiceCount}
- Potential annual increase if at market rate: $${potentialIncrease.toLocaleString()}

Generate exactly 5 recommendations. Respond ONLY with a JSON array. No markdown, no backticks.

[
  {
    "type": "RATE_INCREASE",
    "title": "<short title>",
    "description": "<2 sentences, specific to their numbers>",
    "impact": "<specific dollar or percentage impact>",
    "priority": "HIGH"
  },
  {
    "type": "POSITIONING",
    "title": "<short title>",
    "description": "<2 sentences about positioning/niche>",
    "impact": "<business impact>",
    "priority": "HIGH"
  },
  {
    "type": "PRICING_MODEL",
    "title": "<short title>",
    "description": "<2 sentences about pricing strategy>",
    "impact": "<revenue impact>",
    "priority": "MEDIUM"
  },
  {
    "type": "MINIMUM_PROJECT",
    "title": "<short title>",
    "description": "<2 sentences about minimum rates>",
    "impact": "<efficiency impact>",
    "priority": "MEDIUM"
  },
  {
    "type": "ANNUAL_REVIEW",
    "title": "<short title>",
    "description": "<2 sentences about rate review cadence>",
    "impact": "<long term impact>",
    "priority": "LOW"
  }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    throw err;
  }
}

/**
 * Generate personalized pricing insights from real user data.
 * Returns 4-6 actionable insight cards with specific numbers.
 */
export async function generatePricingInsightsWithAI(context: {
  category: string;
  experienceLevel: string;
  avgRate: number;
  marketMedian: number;
  marketMin: number;
  marketMax: number;
  totalInvoices: number;
  totalRevenue: number;
  avgDaysToPay: number;
  overdueRate: number;
  revenueGrowth: number;
  topClientRevenuePct: number;
  totalExpenses: number;
  expenseToRevenueRatio: number;
}): Promise<
  Array<{
    id: string;
    type: 'warning' | 'opportunity' | 'positive' | 'tip';
    title: string;
    description: string;
    impact: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>
> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const isUndercharging =
    context.avgRate > 0 && context.avgRate < context.marketMedian;
  const rateDelta = context.marketMedian - context.avgRate;
  const annualGap = Math.round(rateDelta * 40 * 48);

  const prompt = `
You are a senior freelance business analyst. Generate personalized pricing insights for a freelancer based on their REAL business data. Be specific, direct, and use the exact numbers provided.

FREELANCER'S ACTUAL DATA:
- Skill category: ${context.category}
- Experience level: ${context.experienceLevel}
- Their average rate: $${context.avgRate}/hr
- Market median for their role: $${context.marketMedian}/hr (range: $${
    context.marketMin
  }–$${context.marketMax}/hr)
- Total invoices issued: ${context.totalInvoices}
- Total revenue to date: $${context.totalRevenue.toLocaleString()}
- Average days to get paid: ${
    context.avgDaysToPay
  } days (industry standard: 14 days)
- Overdue invoice rate: ${context.overdueRate}% of invoices
- Revenue growth (last 3 months vs prior 3 months): ${
    context.revenueGrowth > 0 ? '+' : ''
  }${context.revenueGrowth}%
- Top client revenue concentration: ${
    context.topClientRevenuePct
  }% of total revenue from one client
- Total expenses: $${context.totalExpenses.toLocaleString()}
- Expense-to-revenue ratio: ${context.expenseToRevenueRatio}%

RULES:
- Generate exactly 5 insight cards
- Every card MUST reference specific numbers from the data above — no generic advice
- type must be one of: "warning" (problem), "opportunity" (upside), "positive" (strength), "tip" (strategy)
- priority must be: "HIGH" for issues costing money now, "MEDIUM" for important improvements, "LOW" for long-term
- title: max 6 words, punchy
- description: 2 sentences max, specific numbers required
- impact: one line, quantified where possible

Prioritize insights in this order:
1. Rate gap (if undercharging by >15%)
2. Payment collection speed (if >21 days)
3. Client concentration risk (if >60% from one client)
4. Overdue rate (if >20%)
5. Revenue trend (growing or declining)
6. Expense ratio (if >30%)

Respond ONLY with a JSON array. No markdown, no backticks, no explanation outside the JSON.

[
  {
    "id": "insight_1",
    "type": "warning|opportunity|positive|tip",
    "title": "<max 6 words>",
    "description": "<2 sentences with specific numbers from their data>",
    "impact": "<quantified impact>",
    "priority": "HIGH|MEDIUM|LOW"
  }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    // Ensure IDs are unique
    return parsed.map((item: Record<string, unknown>, i: number) => ({
      ...item,
      id: `insight_${i + 1}_${Date.now()}`,
    }));
  } catch (err) {
    throw err;
  }
}
