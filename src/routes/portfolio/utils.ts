import { Portfolio } from '@prisma/client';

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

/**
 * Generate unique slug with suffix if needed
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Format portfolio data for response
 */
export function formatPortfolioData(portfolio: Portfolio) {
  return {
    id: portfolio.id,
    title: portfolio.title,
    slug: portfolio.slug,
    description: portfolio.description,
    category: portfolio.category,
    imageUrl: portfolio.imageUrl,
    images: portfolio.images,
    projectDate: portfolio.projectDate,
    client: portfolio.client,
    technologies: portfolio.technologies,
    liveUrl: portfolio.liveUrl,
    githubUrl: portfolio.githubUrl,
    caseStudy: portfolio.caseStudy,
    testimonial: portfolio.testimonial,
    isPublished: portfolio.isPublished,
    order: portfolio.order,
    views: portfolio.views,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
  };
}

/**
 * Validate image URLs
 */
export function validateImageUrls(urls: string[]): boolean {
  const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i;
  return urls.every((url) => urlPattern.test(url));
}