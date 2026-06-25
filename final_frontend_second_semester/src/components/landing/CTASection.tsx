import { motion } from "framer-motion";
import { AnimatedButton } from "./AnimatedButton";
import { Sparkles, ArrowRight } from "lucide-react";

export const CTASection = () => {
  return (
    <section className="relative overflow-hidden py-24">
      {/* Gradient background */}
      <motion.div
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-background"
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid-background opacity-30" />

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
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="mb-6 inline-flex items-center justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary lime-glow">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>

          <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl">
            Ready to Transform Your Club?
          </h2>

          <p className="mb-10 text-lg text-muted-foreground">
            Join hundreds of clubs already using AI-powered analysis to improve
            performance, develop talent, and win more matches.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <AnimatedButton variant="primary" size="lg" href="/dashboard">
              Try Demo Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </AnimatedButton>
            <AnimatedButton 
              variant="secondary" 
              size="lg"
              onClick={() => {
                const element = document.getElementById("how-it-works");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Learn More
            </AnimatedButton>
          </div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            viewport={{ once: false }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
          >

            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Setup in minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Cancel anytime</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
