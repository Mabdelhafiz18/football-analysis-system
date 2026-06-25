import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AnimatedButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "lg";
  className?: string;
  onClick?: () => void;
  href?: string; // For internal navigation using React Router
}

export const AnimatedButton = ({ 
  children, 
  variant = "primary", 
  size = "default",
  className,
  onClick,
  href
}: AnimatedButtonProps) => {
  const baseStyles = "relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 overflow-hidden";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 lime-glow animate-pulse-glow",
    secondary: "glass border border-primary/30 text-foreground hover:border-primary/60 hover:bg-primary/10",
    ghost: "text-foreground hover:text-primary hover:bg-primary/10",
  };

  const sizes = {
    default: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  const content = (
    <>
      <span className="relative z-10">{children}</span>
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.6 }}
        />
      )}
    </>
  );

  // If href is provided, render as Link
  if (href) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link 
          to={href}
          className={cn(baseStyles, variants[variant], sizes[size], className)}
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      onClick={onClick}
    >
      {content}
    </motion.button>
  );
};
