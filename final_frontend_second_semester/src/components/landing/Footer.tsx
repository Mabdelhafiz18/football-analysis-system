import { motion } from "framer-motion";
import { Twitter, Linkedin, Github } from "lucide-react";
const footerLinks = {
  Product: ["Features", "Pricing", "Demo", "API"],
  Company: ["About", "Blog", "Careers", "Contact"],
  Resources: ["Documentation", "Help Center", "Community", "Status"],
  Legal: ["Privacy", "Terms", "Cookies", "Licenses"]
};
export const Footer = () => {
  return <footer className="relative border-t border-border bg-card/50">
    <div className="container mx-auto px-6 py-16">
      <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-6">
        {/* Brand column */}
        <div className="lg:col-span-2">
          <motion.div initial={{
            opacity: 0
          }} whileInView={{
            opacity: 1
          }} viewport={{
            once: true
          }} className="mb-6 flex items-center gap-2">

            <span className="text-xl font-bold text-foreground">
              Kora<span className="text-primary">Vision</span>
            </span>
          </motion.div>

          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Professional-grade VAR and Tactical Analysis for football clubs of
            all sizes. Powered by AI.
          </p>

          {/* Social links */}
          <div className="flex gap-4">
            {[Twitter, Linkedin, Github].map((Icon, index) => <motion.a key={index} href="#" whileHover={{
              scale: 1.1,
              y: -2
            }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </motion.a>)}
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([title, links], colIndex) => <motion.div key={title} initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          type: "spring",
          stiffness: 120,
          damping: 25,
          delay: colIndex * 0.1
        }} viewport={{
          once: true
        }}>


        </motion.div>)}
      </div>

      {/* Bottom bar */}
      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
        <p className="text-sm text-muted-foreground">
          © 2024 KoraVision. All rights reserved.
        </p>

      </div>
    </div>
  </footer>;
};