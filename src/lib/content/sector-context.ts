import { sectorSlugSchema } from "@/lib/data/schema";

export type SectorSlug = (typeof sectorSlugSchema.options)[number];

/**
 * Static, hand-written per-sector context (docs/DECISIONS.md D-099) -- not
 * a `sectors.description` DB column, avoiding a schema change this
 * milestone doesn't need. Every entry follows the same two-sentence
 * template (what the sector covers, then why signals in it are held to the
 * same evidence/verification standard as any other sector) so structure,
 * length, and tone stay comparable across all seven canonical sectors, per
 * D-099's equal-treatment guardrail -- no entry implies one sector is more
 * important, credible, or further along than another, and none describes a
 * fictional company or event as real.
 */
export const SECTOR_CONTEXT: Record<SectorSlug, string> = {
  "politics-civic-technology":
    "Politics and civic technology covers the software used in elections, legislative work, constituent services, and government transparency — tools that shape how citizens interact with public institutions. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since claims about civic impact deserve particular scrutiny.",
  "government-operations":
    "Government operations covers the internal systems public agencies use to deliver services, including case management, benefits processing, procurement, and administrative workflows. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since AI adoption here can directly affect how public services reach the people who rely on them.",
  agriculture:
    "Agriculture covers the technology used to grow, monitor, and distribute food, including precision farming, crop and livestock monitoring, and supply-chain logistics. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since claims about yield or resource impact deserve the same scrutiny as any other public-interest claim.",
  healthcare:
    "Healthcare covers the clinical, administrative, and research systems used to diagnose, treat, and manage patient care, from hospital operations to clinical decision support. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since AI tools here carry direct consequences for patient outcomes, safety, and privacy.",
  education:
    "Education covers the tools used to teach, assess, and administer learning, from classroom instruction aids to institutional administration and student support systems. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since AI adoption here can shape how students learn and how instructors spend their time.",
  nonprofits:
    "Nonprofits covers the technology mission-driven organizations use to deliver programs, manage operations, and measure impact, often with limited resources. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since claims about reduced administrative burden or extended reach deserve the same scrutiny as any other public-interest claim.",
  "climate-energy":
    "Climate and energy covers technology addressing energy production, distribution, efficiency, and the broader climate response, from grid management to emissions monitoring. Signals in this sector are held to the same evidence and verification standard as every other sector on this site, since claims in this area are closely watched and deserve scrutiny in both directions.",
};

export function getSectorContext(slug: SectorSlug): string {
  return SECTOR_CONTEXT[slug];
}
