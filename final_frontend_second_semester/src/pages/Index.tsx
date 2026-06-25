import { CursorGradient } from "@/components/landing/CursorGradient";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TargetAudienceSection } from "@/components/landing/TargetAudienceSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    // Force dark theme on landing page
    <div className="dark relative min-h-screen bg-background">
      {/* Global Effects */}
      <CursorGradient />

      {/* Grid Background */}
      <div className="pointer-events-none fixed inset-0 grid-background opacity-40" />

      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <TargetAudienceSection />
        <CTASection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
