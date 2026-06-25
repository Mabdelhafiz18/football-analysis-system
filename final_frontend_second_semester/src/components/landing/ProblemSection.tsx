import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { DollarSign, Video, AlertTriangle, EyeOff } from "lucide-react";

const problems = [
  {
    icon: DollarSign,
    title: "Budget Paralysis",
    description:
      "Small clubs cannot afford $50,000+ camera systems, leaving them stuck with zero data.",
  },
  {
    icon: Video,
    title: 'The "Hand-Cam" Struggle',
    description:
      "Coaches spend hours re-watching shaky phone footage with no way to measure player performance accurately.",
  },
  {
    icon: AlertTriangle,
    title: "Unfair Outcomes",
    description:
      "Crucial goals in local derbies are missed or wrongly called, leading to player frustration and disputes.",
  },
  {
    icon: EyeOff,
    title: "Talent Blindness",
    description:
      'Young players in academies don\'t get the "FIFA-style" stats they need to get scouted by bigger teams.',
  },
];

export const ProblemSection = () => {
  return (
    <section className="relative py-24">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 120,
            damping: 25
          }}
          viewport={{ once: false }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-block font-mono text-sm uppercase tracking-wider text-primary">
            The Problem
          </span>
          <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl">
            The Professional Gap
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Small clubs and academies face insurmountable barriers to accessing
            the same technology that elite teams use.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, index) => (
            <GlassCard
              key={problem.title}
              delay={index * 0.1}
              className="group moody-section"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 transition-colors group-hover:bg-primary/20">
                <problem.icon className="h-7 w-7 text-destructive transition-colors group-hover:text-primary" />
              </div>
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                {problem.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {problem.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};
