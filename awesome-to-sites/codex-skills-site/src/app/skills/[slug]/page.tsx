import { notFound } from "next/navigation";
import { skills, getSkillBySlug, categories } from "@/data/skills";
import { SkillDetail } from "@/components/skill-detail";

export function generateStaticParams() {
  return skills.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) return { title: "Skill Not Found" };
  return {
    title: `${skill.name} — Codex Skills`,
    description: skill.description,
  };
}

export default async function SkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) notFound();

  const category = categories.find((c) => c.id === skill.category);
  const related = skills
    .filter((s) => s.category === skill.category && s.slug !== skill.slug)
    .slice(0, 6);

  return <SkillDetail skill={skill} categoryName={category?.name ?? ""} related={related} />;
}
