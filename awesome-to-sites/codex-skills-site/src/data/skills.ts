import skillsData from "../../content/sources/awesome-codex-skills.json";
import categoriesData from "../../content/categories.json";

export interface Skill {
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  isLocal: boolean;
  repoUrl?: string;
  installCommand?: string;
  tags: string[];
}

interface Category {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
}

// Map JSON category format to the UI format
export const categories = [
  { id: "all", name: "All Skills", icon: "grid" },
  ...categoriesData.categories.map((c) => ({
    id: c.slug,
    name: c.name,
    icon: c.icon,
  })),
] as const;

export type CategoryId = (typeof categories)[number]["id"];

// Transform JSON items to Skill interface
export const skills: Skill[] = skillsData.items.map((item) => ({
  slug: item.slug,
  name: item.name,
  description: item.description,
  shortDescription: item.shortDescription || undefined,
  category: item.category,
  isLocal: item.isLocal,
  repoUrl: item.repoUrl || undefined,
  installCommand: item.installCommand || undefined,
  tags: item.tags,
}));

export function getSkillBySlug(slug: string): Skill | undefined {
  return skills.find((s) => s.slug === slug);
}

export function getSkillsByCategory(category: string): Skill[] {
  if (category === "all") return skills;
  return skills.filter((s) => s.category === category);
}

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.includes(q))
  );
}
