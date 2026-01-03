import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GraduationCap, Users, User } from "lucide-react";
const audiences = [{
  icon: GraduationCap,
  title: "Youth Academies",
  description: 'Give your players professional feedback and "Player Cards" to track growth and showcase talent to scouts.',
  benefit: "Track player development"
}, {
  icon: Users,
  title: "Small/Semi-Pro Clubs",
  description: "Use tactical analysis to beat bigger opponents with smarter positioning and data-driven strategies.",
  benefit: "Level the playing field"
}, {
  icon: User,
  title: "Individual Coaches",
  description: "Save 10+ hours a week on manual video tagging and let the AI do the work while you focus on coaching.",
  benefit: "Save time, coach better"
}];
export const TargetAudienceSection = () => {
  return <section id="for-who" className="relative py-24">
    <div className="container mx-auto px-6">
      <motion.div initial={{
        opacity: 0,
        y: 30
      }} whileInView={{
        opacity: 1,
        y: 0
      }} transition={{
        type: "spring",
        stiffness: 120,
        damping: 25
      }} viewport={{
        once: false
      }} className="mb-16 text-center">
        <span className="mb-4 inline-block font-mono text-sm uppercase tracking-wider text-primary">
          Who Is It For
        </span>
        <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl">
          Built for Champions at Every Level
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Whether you're developing the next generation of stars or competing
          in your local league, VisionVAR empowers you to play smarter.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {audiences.map((audience, index) => <GlassCard key={audience.title} delay={index * 0.1} className="group">
          <div className="flex items-start gap-5">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all group-hover:bg-primary group-hover:lime-glow-soft">
              <audience.icon className="h-7 w-7 text-primary transition-colors group-hover:text-primary-foreground" />
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {audience.title}
                </h3>

              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {audience.description}
              </p>
            </div>
          </div>
        </GlassCard>)}
      </div>
    </div>
  </section>;
};