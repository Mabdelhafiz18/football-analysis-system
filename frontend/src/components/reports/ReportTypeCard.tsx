import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportTypeCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
  color?: string;
}

export function ReportTypeCard({
  title,
  description,
  icon: Icon,
  selected,
  onClick,
  color = "primary"
}: ReportTypeCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-2xl p-5 transition-all duration-300 glass-card",
        selected 
          ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20 shadow-lg shadow-primary/5" 
          : "hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "rounded-xl p-3",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
        )}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            "font-bold text-lg mb-1 transition-colors",
            selected ? "text-primary" : "text-foreground"
          )}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      
      {selected && (
        <motion.div
          layoutId="selected-report"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}

