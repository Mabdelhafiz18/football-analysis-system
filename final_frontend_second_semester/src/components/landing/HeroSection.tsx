import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { AnimatedButton } from "./AnimatedButton";
import { Play, Sparkles } from "lucide-react";

export const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for the mouse tilt
  const rotateXMouse = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 25 });
  const rotateYMouse = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 25 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = (e.clientX - rect.left) / width - 0.5;
    const y = (e.clientY - rect.top) / height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Scroll-based motion for the tablet
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  // Transform values based on scroll
  const scrollY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const scrollRotateX = useTransform(scrollYProgress, [0, 0.5], [0, 20]);
  const scrollScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.85]);
  const scrollOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return <section ref={sectionRef} className="relative min-h-screen overflow-hidden pt-24">
    {/* Hero Content */}
    <div className="container relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-6 text-center">



      <motion.h1 initial={{
        opacity: 0,
        y: 30,
        filter: "blur(10px)"
      }} animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)"
      }} transition={{
        type: "spring",
        stiffness: 120,
        damping: 25,
        delay: 0.2
      }} className="mb-6 max-w-4xl text-4xl font-extrabold leading-tight text-foreground md:text-6xl lg:text-7xl">
        Bring the Power of the{" "}
        <span className="text-primary text-glow">Premier League</span> to the
        Local League.
      </motion.h1>

      <motion.p initial={{
        opacity: 0,
        y: 30,
        filter: "blur(10px)"
      }} animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)"
      }} transition={{
        type: "spring",
        stiffness: 120,
        damping: 25,
        delay: 0.3
      }} className="mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
        Professional-grade VAR and Tactical Analysis for small clubs,
        academies, and private pitches. No expensive hardware, just pure AI
        intelligence.
      </motion.p>

      <motion.div initial={{
        opacity: 0,
        y: 30,
        filter: "blur(10px)"
      }} animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)"
      }} transition={{
        type: "spring",
        stiffness: 120,
        damping: 25,
        delay: 0.4
      }} className="flex flex-col gap-4 sm:flex-row">
        <AnimatedButton variant="primary" size="lg" href="/upload" className="px-10 py-6 text-lg">
          Revolutionize Your Club
        </AnimatedButton>
        <AnimatedButton variant="secondary" size="lg" href="/dashboard">
          <Play className="mr-2 h-4 w-4" />
          Try Demo
        </AnimatedButton>
      </motion.div>

      {/* Floating 3D Tablet with Enhanced Motion */}
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{
          opacity: 0,
          y: 50,
          rotateX: 15
        }}
        animate={{
          opacity: 1,
          y: 0,
          rotateX: 0
        }}
        transition={{
          type: "spring",
          stiffness: 80,
          damping: 25,
          delay: 0.5
        }}
        style={{
          y: scrollY,
          rotateX: useTransform(() => scrollRotateX.get() + rotateXMouse.get()),
          rotateY: rotateYMouse,
          scale: scrollScale,
          opacity: scrollOpacity,
          transformStyle: "preserve-3d",
          perspective: "1200px"
        }}
        className="mt-16 w-full max-w-5xl cursor-default"
      >
        <motion.div
          animate={{
            y: [0, -12, 0]
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="group relative w-full overflow-hidden border-y border-primary/20 bg-black/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500"
        >
          {/* Video Container - Aggressive crop to hide internal bezel */}
          <div className="relative aspect-[21/9] w-full overflow-hidden bg-black">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-[125%] w-[125%] -translate-x-[10%] -translate-y-[10%] object-cover transition-transform duration-700 group-hover:scale-110"
              style={{
                maxWidth: 'none'
              }}
            >
              <source src="/hero-video.mp4" type="video/mp4" />
            </video>

            {/* Overlay Gradient for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-80" />
          </div>
        </motion.div>

        {/* Shadow under the tablet */}
        <div className="mx-auto mt-8 h-6 w-3/4 rounded-[100%] bg-primary/10 blur-2xl transition-opacity duration-1000 group-hover:bg-primary/20" />
      </motion.div>
    </div>

    {/* Bottom gradient fade */}
    <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent" />
  </section>;
};
