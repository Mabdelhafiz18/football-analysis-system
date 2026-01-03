import { motion } from "framer-motion";
import { AnimatedButton } from "./AnimatedButton";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export const Navigation = () => {
  const { isAuthenticated } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed left-0 right-0 top-0 z-50 glass border-b border-border/50"
    >
      <nav className="container mx-auto grid grid-cols-3 items-center px-6 py-4">
        {/* Left: Logo */}
        <div className="flex justify-start">
          <Link to="/">
            <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }}>
              <span className="text-xl font-bold text-foreground">
                Vision<span className="text-primary">VAR</span>
              </span>
            </motion.div>
          </Link>
        </div>

        {/* Center: Navigation Links - Always Centered */}
        <div className="hidden items-center justify-center gap-8 md:flex">
          {["Features", "How It Works", "For Who"].map((item) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
              whileHover={{ y: -2 }}
            >
              {item}
            </motion.a>
          ))}
        </div>

        {/* Right: Auth Buttons */}
        <div className="flex items-center justify-end gap-3">
          {isAuthenticated ? (
            <AnimatedButton variant="primary" size="default" href="/dashboard">
              Dashboard
            </AnimatedButton>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4">
                Sign In
              </Link>
              <AnimatedButton variant="primary" size="default" href="/register">
                Get Started
              </AnimatedButton>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
};