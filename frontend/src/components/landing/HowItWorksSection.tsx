import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { Camera, Cloud, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Camera,
    title: "Capture",
    description:
      "Record your match using a single standard camera or smartphone. No special equipment required.",
  },
  {
    number: "02",
    icon: Cloud,
    title: "Analyze",
    description:
      "Upload to the KoraVision cloud; our 4 AI models process the footage frame-by-frame.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Improve",
    description:
      "Receive a professional PDF report and an interactive video dashboard within minutes.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="relative py-24">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="container relative z-10 mx-auto px-6">
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
            How It Works
          </span>
          <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl">
            The 3-Step Flow
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            From raw footage to professional insights in minutes. No technical expertise required.
          </p>
        </motion.div>

        <div className="relative flex flex-col gap-8 md:flex-row md:items-start md:justify-center">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative flex-1"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-20 hidden h-[2px] w-full -translate-x-1/2 md:block">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 + index * 0.2 }}
                    viewport={{ once: false }}
                    className="h-full w-full origin-left bg-gradient-to-r from-primary/50 to-primary/10"
                  />
                  <ArrowRight className="absolute -right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary/50" />
                </div>
              )}

              <GlassCard className="text-center" glow delay={index * 0.1}>
                {/* Step number */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 15,
                    delay: 0.2 + index * 0.1
                  }}
                  viewport={{ once: false }}
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary lime-glow"
                >
                  <step.icon className="h-8 w-8 text-primary-foreground" />
                </motion.div>

                {/* Number badge */}
                <span className="mb-2 inline-block font-mono text-xs text-primary">
                  STEP {step.number}
                </span>

                <h3 className="mb-3 text-xl font-semibold text-foreground">
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
