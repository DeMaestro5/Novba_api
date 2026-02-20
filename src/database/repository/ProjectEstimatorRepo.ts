export interface ProjectEstimate {
  low: number;
  recommended: number;
  high: number;
  confidence: number;
  projectType: string;
  reasoning: string[];
  breakdown: { label: string; hours: number; rate: number; total: number }[];
  totalHours: number;
  analyzedKeywords: string[];
}

function detectProjectType(description: string): {
  type: string;
  keywords: string[];
} {
  const desc = description.toLowerCase();
  const detected: string[] = [];

  if (
    desc.includes('brand') ||
    desc.includes('identity') ||
    desc.includes('logo')
  ) {
    detected.push('brand');
  }
  if (
    desc.includes('website') ||
    desc.includes('landing') ||
    desc.includes('web')
  ) {
    detected.push('website');
  }
  if (
    desc.includes('app') ||
    desc.includes('mobile') ||
    desc.includes('saas') ||
    desc.includes('dashboard')
  ) {
    detected.push('app');
  }
  if (
    desc.includes('content') ||
    desc.includes('copy') ||
    desc.includes('writing') ||
    desc.includes('blog')
  ) {
    detected.push('content');
  }
  if (
    desc.includes('social') ||
    desc.includes('instagram') ||
    desc.includes('tiktok')
  ) {
    detected.push('social');
  }
  if (
    desc.includes('video') ||
    desc.includes('animation') ||
    desc.includes('motion')
  ) {
    detected.push('video');
  }
  if (
    desc.includes('seo') ||
    desc.includes('marketing') ||
    desc.includes('campaign')
  ) {
    detected.push('marketing');
  }

  const primary = detected[0] ?? 'general';
  return { type: primary, keywords: detected };
}

function estimateProject(
  description: string,
  projectType: string,
): ProjectEstimate {
  const { type, keywords } = detectProjectType(description);
  const desc = description.toLowerCase();

  // Complexity multipliers based on description signals
  let complexityMultiplier = 1.0;
  if (
    desc.includes('enterprise') ||
    desc.includes('large') ||
    desc.includes('complex')
  )
    complexityMultiplier = 1.4;
  if (
    desc.includes('simple') ||
    desc.includes('basic') ||
    desc.includes('small')
  )
    complexityMultiplier = 0.7;
  if (desc.includes('startup') || desc.includes('mvp'))
    complexityMultiplier = 0.85;
  if (desc.includes('redesign') || desc.includes('rebuild'))
    complexityMultiplier = 1.2;
  if (desc.includes('rush') || desc.includes('urgent') || desc.includes('asap'))
    complexityMultiplier *= 1.25;

  const estimates: Record<
    string,
    {
      low: number;
      recommended: number;
      high: number;
      confidence: number;
      reasoning: string[];
      breakdown: { label: string; hours: number; rate: number }[];
    }
  > = {
    brand: {
      low: 3500,
      recommended: 6500,
      high: 12000,
      confidence: 89,
      reasoning: [
        'Brand identity projects carry high strategic value — they define how a company presents itself for years.',
        'Discovery and strategy phases are often underpriced; include 8–12 hours for research and positioning.',
        'Deliverable scope (guidelines doc, file formats, usage rights) significantly affects ceiling — always itemize these.',
      ],
      breakdown: [
        { label: 'Discovery & Strategy', hours: 10, rate: 120 },
        { label: 'Concept Development', hours: 16, rate: 120 },
        { label: 'Refinement & Revisions', hours: 12, rate: 120 },
        { label: 'Final Files & Guidelines', hours: 8, rate: 120 },
      ],
    },
    website: {
      low: 4500,
      recommended: 8500,
      high: 18000,
      confidence: 91,
      reasoning: [
        'Website projects are routinely underpriced because scope creep is invisible at proposal stage — charge per page, not just design.',
        'Development complexity (CMS, animations, integrations) should be scoped separately from visual design.',
        'Always include a content strategy phase — most projects stall waiting for client copy.',
      ],
      breakdown: [
        { label: 'Strategy & Wireframes', hours: 12, rate: 130 },
        { label: 'UI Design', hours: 24, rate: 130 },
        { label: 'Development', hours: 32, rate: 130 },
        { label: 'Testing & Launch', hours: 8, rate: 130 },
      ],
    },
    app: {
      low: 8000,
      recommended: 18000,
      high: 45000,
      confidence: 86,
      reasoning: [
        'App and SaaS engagements command premium rates because the work directly impacts product revenue.',
        'Always insist on a discovery phase before designing — it protects you from scope creep and educates the client.',
        'Embedded design systems significantly increase value delivered and raise the price ceiling.',
      ],
      breakdown: [
        { label: 'Discovery & UX Research', hours: 20, rate: 150 },
        { label: 'Information Architecture', hours: 16, rate: 150 },
        { label: 'UI Design & Prototyping', hours: 48, rate: 150 },
        { label: 'Design System & Handoff', hours: 24, rate: 150 },
      ],
    },
    content: {
      low: 800,
      recommended: 2200,
      high: 5000,
      confidence: 85,
      reasoning: [
        'Content projects priced per word leave margin on the table — pivot to per-project pricing.',
        'Strategy and research phases are commonly given away free; charge for them explicitly in every proposal.',
        'Cap revision rounds — unlimited revisions silently destroy project margins.',
      ],
      breakdown: [
        { label: 'Research & Strategy', hours: 6, rate: 95 },
        { label: 'First Draft', hours: 10, rate: 95 },
        { label: 'Revisions (2 rounds)', hours: 4, rate: 95 },
        { label: 'Final Delivery', hours: 2, rate: 95 },
      ],
    },
    social: {
      low: 1200,
      recommended: 2800,
      high: 6000,
      confidence: 83,
      reasoning: [
        'Social media management is chronically underpriced — charge for strategy, not just posting.',
        'Package monthly retainers with clear deliverables (X posts, Y stories, monthly report) to avoid scope creep.',
        'Content creation (copy + design) should be scoped and priced separately from management.',
      ],
      breakdown: [
        { label: 'Strategy & Planning', hours: 8, rate: 95 },
        { label: 'Content Creation', hours: 16, rate: 95 },
        { label: 'Scheduling & Publishing', hours: 6, rate: 95 },
        { label: 'Analytics & Reporting', hours: 4, rate: 95 },
      ],
    },
    video: {
      low: 2000,
      recommended: 5000,
      high: 12000,
      confidence: 84,
      reasoning: [
        'Video projects are heavily underpriced when scoped by minute — charge by deliverable, not duration.',
        'Pre-production (scripting, storyboarding, planning) is often given away free; always charge for it.',
        'Revision rounds for video are extremely expensive in time — set strict limits at proposal stage.',
      ],
      breakdown: [
        { label: 'Pre-production & Script', hours: 10, rate: 110 },
        { label: 'Production', hours: 16, rate: 110 },
        { label: 'Editing & Post', hours: 20, rate: 110 },
        { label: 'Revisions & Delivery', hours: 8, rate: 110 },
      ],
    },
    marketing: {
      low: 2500,
      recommended: 5500,
      high: 12000,
      confidence: 82,
      reasoning: [
        'Marketing projects should be priced on potential ROI for the client, not hours invested.',
        'Always tie deliverables to measurable outcomes — this justifies premium pricing.',
        'Retainer arrangements work better than project pricing for ongoing marketing work.',
      ],
      breakdown: [
        { label: 'Strategy & Research', hours: 12, rate: 115 },
        { label: 'Campaign Development', hours: 20, rate: 115 },
        { label: 'Execution & Management', hours: 24, rate: 115 },
        { label: 'Reporting & Optimization', hours: 8, rate: 115 },
      ],
    },
    general: {
      low: 2500,
      recommended: 5500,
      high: 10000,
      confidence: 75,
      reasoning: [
        'Without a specific project type detected, this estimate is based on a mid-complexity freelance engagement.',
        'Add more detail about deliverables, timeline, and technology stack for a sharper estimate.',
        'Always anchor proposals to deliverables and outcomes — never to hours alone.',
      ],
      breakdown: [
        { label: 'Discovery & Planning', hours: 8, rate: 110 },
        { label: 'Core Deliverable', hours: 24, rate: 110 },
        { label: 'Revisions & Refinement', hours: 10, rate: 110 },
        { label: 'Handoff & Support', hours: 6, rate: 110 },
      ],
    },
  };

  const base = estimates[type] ?? estimates.general;

  // Apply complexity multiplier
  const adjustedLow = Math.round((base.low * complexityMultiplier) / 100) * 100;
  const adjustedRecommended =
    Math.round((base.recommended * complexityMultiplier) / 100) * 100;
  const adjustedHigh =
    Math.round((base.high * complexityMultiplier) / 100) * 100;

  // Add totals to breakdown
  const breakdownWithTotals = base.breakdown.map((item) => ({
    ...item,
    total: item.hours * item.rate,
  }));

  const totalHours = base.breakdown.reduce((s, i) => s + i.hours, 0);

  return {
    low: adjustedLow,
    recommended: adjustedRecommended,
    high: adjustedHigh,
    confidence: base.confidence,
    projectType: type,
    reasoning: base.reasoning,
    breakdown: breakdownWithTotals,
    totalHours,
    analyzedKeywords: keywords,
  };
}

export default { estimateProject, detectProjectType };
