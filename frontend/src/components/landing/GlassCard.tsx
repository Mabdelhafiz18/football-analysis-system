import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  glow?: boolean;
  delay?: number;
}

export const GlassCard = ({
  children,
  className,
  tilt = true,
  glow = false,
  delay = 0
}: GlassCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, filter: "blur(10px)", scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, y: 50, filter: "blur(10px)", scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 25,
        delay,
        mass: 0.8
      }}
      viewport={{ once: false, amount: 0.2 }}
      whileHover={tilt ? {
        rotateX: 2,
        rotateY: -2,
        translateZ: 10,
        transition: { duration: 0.3 }
      } : undefined}
      className={cn(
        "glass-card rounded-2xl p-6 transition-all duration-300",
        tilt && "tilt-hover",
        glow && "lime-glow-soft",
        className
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
};
