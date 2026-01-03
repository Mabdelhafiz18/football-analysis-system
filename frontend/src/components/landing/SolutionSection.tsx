import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { GlassCard } from "./GlassCard";
import { Crosshair, Shield, Target, Map } from "lucide-react";
import { LordIcon } from "./LordIcon";

const solutions = [
  {
    icon: null,
    lordicon: "https://cdn.lordicon.com/dicvhxpz.json",
    title: "Automated Offside Engine",
    description:
      "Instantly draws the defensive line to prove the call. Never miss an offside again with AI-powered precision.",
    stat: "99.2%",
    statLabel: "Accuracy",
    color: "from-primary/10 via-primary/5 to-transparent",
  },
  {
    icon: Shield,
    title: "Foul Prediction Logic",
    description:
      'Identifies illegal contact and provides a "Referee Recommendation" based on AI confidence scores.',
    stat: "< 0.5s",
    statLabel: "Detection",
    color: "from-primary/15 via-primary/5 to-transparent",
  },
  {
    icon: Target,
    title: "Dynamic Goal Probability",
    description:
      "Calculates the difficulty of a shot (xG) to teach strikers better decision-making and improve finishing.",
    stat: "xG",
    statLabel: "Analytics",
    color: "from-primary/10 via-primary/5 to-transparent",
  },
  {
    icon: Map,
    title: "Tactical Blueprint",
    description:
      'Converts the video into a 2D top-down "Minimap" to analyze team formation and spacing in real-time.',
    stat: "360°",
    statLabel: "Coverage",
    color: "from-primary/15 via-primary/5 to-transparent",
  },
];

export const SolutionSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({
    container: containerRef,
  });

  return (
    <section id="features" className="relative py-24">
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
          className="mb-12 text-center"
        >
          <span className="mb-4 inline-block font-mono text-sm uppercase tracking-wider text-primary">
            The Solution
          </span>
          <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl">
            VisionVAR Intelligence
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Four powerful AI models working in harmony to deliver professional-grade analysis.
          </p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
          className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground md:hidden"
        >
          <span>Scroll horizontally</span>
          <motion.span
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
        </motion.div>

        {/* Horizontal scroll container */}
        <div
          ref={containerRef}
          className="horizontal-scroll -mx-6 px-6 pb-4 md:mx-0 md:overflow-visible md:px-0"
        >
          <div className="flex gap-6 md:grid md:grid-cols-4">
            {solutions.map((solution, index) => (
              <GlassCard
                key={solution.title}
                delay={index * 0.1}
                className={`group h-full scroll-snap-item w-[300px] flex-shrink-0 md:w-auto solution-card-${index}`}
                glow
                tilt
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.5
                  }}
                  className="h-full"
                >

                  {/* Gradient background */}
                  <div
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${solution.color} opacity-0 transition-opacity group-hover:opacity-100`}
                  />

                  <div className="relative z-10">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 transition-all group-hover:bg-primary/10 group-hover:lime-glow-soft">
                      {solution.lordicon ? (
                        <LordIcon
                          src={solution.lordicon}
                          trigger="hover"
                          target={`.solution-card-${index}`}
                          size={56}
                          speed={2}
                          colors="primary:#bef264,secondary:#bef264"
                          className="text-primary"
                        />
                      ) : (
                        solution.icon && <solution.icon className="h-8 w-8 text-primary" />
                      )}
                    </div>

                    <h3 className="mb-3 text-lg font-semibold text-foreground">
                      {solution.title}
                    </h3>

                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      {solution.description}
                    </p>

                    {/* Stat display */}
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-bold text-primary text-glow">
                        {solution.stat}
                      </span>
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {solution.statLabel}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Progress bar for mobile */}
        <motion.div
          className="mt-4 h-1 w-full overflow-hidden rounded-full bg-border md:hidden"
        >
          <motion.div
            className="h-full bg-primary"
            style={{ scaleX: scrollXProgress, transformOrigin: "left" }}
          />
        </motion.div>
      </div>
    </section >
  );
};
