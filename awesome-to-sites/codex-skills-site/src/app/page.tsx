import { skills, categories } from "@/data/skills";
import { HeroSection } from "@/components/hero-section";
import { SkillsExplorer } from "@/components/skills-explorer";

export default function Home() {
  const categoryCounts: Record<string, number> = {
    all: skills.length,
    ...Object.fromEntries(
      categories
        .filter((c) => c.id !== "all")
        .map((c) => [c.id, skills.filter((s) => s.category === c.id).length])
    ),
  };

  return (
    <>
      <HeroSection totalSkills={skills.length} categoryCounts={categoryCounts} />
      <SkillsExplorer skills={skills} categoryCounts={categoryCounts} />
    </>
  );
}
