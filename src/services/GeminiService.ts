import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

function getClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
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
  freelancerLocation?: string;
  clientMarket?: string;
}): Promise<{
  message: string;
  suggestedRate: number;
  confidence: number;
  reasoning: string;
  negotiationTips: string[];
  localRate: {
    min: number;
    median: number;
    max: number;
    context: string;
  } | null;
  internationalRate: {
    min: number;
    median: number;
    max: number;
    context: string;
  } | null;
}> {
  const {
    role,
    experienceLevel,
    currentRate,
    marketMin,
    marketMax,
    marketMedian,
    marketAverage,
    sampleSize,
    freelancerLocation,
    clientMarket,
  } = params;

  const isInternationalMarket =
    !freelancerLocation ||
    [
      'United States',
      'United Kingdom',
      'Canada',
      'Australia',
      'Germany',
      'Netherlands',
      'Remote (Global)',
    ].includes(freelancerLocation ?? '');

  const locationContext =
    freelancerLocation && !isInternationalMarket
      ? `The freelancer is based in ${freelancerLocation}. This is important:
     - Local market rates in ${freelancerLocation} are significantly
       lower than US/EU rates
     - International clients (US, UK, EU, Australia) pay global rates
       regardless of freelancer location
     - You MUST provide TWO separate rate recommendations:
       1. localRate: what to charge local clients in ${freelancerLocation}
       2. internationalRate: what to charge international clients
     - The international rate should be competitive globally, NOT
       discounted because of freelancer location
     - Location-based pricing is about where the CLIENT is, not the
       freelancer`
      : `The freelancer operates in the standard international/US market.
     Provide standard market rates. No location adjustment needed.`;

  const prompt = `
You are a senior freelance business advisor with deep knowledge of
global market rates. Analyze this freelancer's rate and provide
specific, actionable guidance.

FREELANCER PROFILE:
- Role: ${role}
- Experience level: ${experienceLevel}
- Current rate: $${currentRate}/hr
- Location: ${freelancerLocation || 'Not specified'}
- Client market focus: ${clientMarket || 'BOTH'}

MARKET DATA FOR ${role.toUpperCase()} (${experienceLevel}):
- Market minimum: $${marketMin}/hr
- Market median: $${marketMedian}/hr
- Market maximum: $${marketMax}/hr
- Market average: $${marketAverage}/hr
- Data sample size: ${sampleSize}+ data points

${locationContext}

INSTRUCTIONS:
Generate a precise rate analysis. Be direct and specific with numbers.
Never give vague advice like "it depends" — give exact dollar amounts.

${
  !isInternationalMarket && freelancerLocation
    ? `
LOCATION-SPECIFIC REQUIREMENTS:
You MUST include both localRate and internationalRate in your response.
For ${freelancerLocation}-based freelancers:
- Local rates are typically 20-40% of US/EU rates
- International rates should be competitive globally (70-100% of US rates)
- The gap represents a massive opportunity freelancers often miss
`
    : ''
}

Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.

{
  "message": "2-3 sentence direct assessment of their current rate",
  "suggestedRate": <number — the single best rate recommendation in USD>,
  "confidence": <number 0-100>,
  "reasoning": "2-3 sentences explaining the recommendation with specific numbers",
  "negotiationTips": [
    "Specific tip 1 with exact numbers or scripts",
    "Specific tip 2",
    "Specific tip 3"
  ],
  "localRate": ${
    !isInternationalMarket
      ? `{
    "min": <number>,
    "median": <number>,
    "max": <number>,
    "context": "1 sentence about local market reality"
  }`
      : 'null'
  },
  "internationalRate": ${
    !isInternationalMarket
      ? `{
    "min": <number>,
    "median": <number>,
    "max": <number>,
    "context": "1 sentence about international opportunity"
  }`
      : 'null'
  },
  "isUndercharging": <boolean>,
  "percentBelow": <number — how far below market median as percentage>,
  "annualGap": <number — potential annual increase if they raise to suggested rate>
}
`;

  try {
    const completion = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      ...parsed,
      localRate: parsed.localRate ?? null,
      internationalRate: parsed.internationalRate ?? null,
    };
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
    const completion = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
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
    const completion = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
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
  const _isUndercharging =
    context.avgRate > 0 && context.avgRate < context.marketMedian;
  const rateDelta = context.marketMedian - context.avgRate;
  const _annualGap = Math.round(rateDelta * 40 * 48);

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
    const completion = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
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
