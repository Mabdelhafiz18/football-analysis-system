import { motion } from "framer-motion";
import { Brain, Image, Hash, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExplainabilityData, IncidentType } from "@/types/decisions";

interface ExplainabilityCardProps {
  data: ExplainabilityData;
  incidentType: IncidentType;
}

export function ExplainabilityCard({ data, incidentType }: ExplainabilityCardProps) {
  const isOffside = incidentType === "offside";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn(
        "rounded-xl overflow-hidden border",
        isOffside
          ? "bg-primary/5 border-primary/20"
          : "bg-destructive/5 border-destructive/20"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center gap-2",
        isOffside ? "bg-primary/10" : "bg-destructive/10"
      )}>
        <Brain className={cn(
          "h-5 w-5",
          isOffside ? "text-primary" : "text-destructive"
        )} />
        <h4 className="font-semibold text-foreground">AI Explainability</h4>
        <span className={cn(
          "ml-auto text-xs font-mono px-2 py-0.5 rounded",
          isOffside ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
        )}>
          {Math.round(data.confidence * 100)}% conf
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Visual Evidence */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Image className="h-4 w-4" />
            <span>Visual Evidence</span>
          </div>
          <div className="aspect-video bg-muted/30 rounded-lg overflow-hidden relative">
            {/* Placeholder for actual frame image */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={cn(
                  "w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center",
                  isOffside ? "bg-primary/20" : "bg-destructive/20"
                )}>
                  <Image className={cn(
                    "h-8 w-8",
                    isOffside ? "text-primary" : "text-destructive"
                  )} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Frame capture at incident time
                </p>
              </div>
            </div>
            
            {/* Simulated overlay preview */}
            {isOffside && (
              <div className="absolute left-1/3 top-0 bottom-0 w-0.5 bg-primary/50" />
            )}
          </div>
        </div>

        {/* Numeric Reason */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span>Key Finding</span>
          </div>
          <div className={cn(
            "px-4 py-3 rounded-lg font-mono text-sm font-medium",
            isOffside
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          )}>
            {data.numericReason}
          </div>
        </div>

        {/* Plain Language Explanation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Explanation</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {data.explanation}
          </p>
        </div>

        {/* Contributing Factors */}
        {data.factors && data.factors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>Contributing Factors</span>
            </div>
            <div className="space-y-2">
              {data.factors.map((factor, index) => (
                <motion.div
                  key={factor.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <ImpactIcon impact={factor.impact} />
                    <span className="text-sm text-foreground">{factor.name}</span>
                  </div>
                  <span className={cn(
                    "text-sm font-mono",
                    factor.impact === "positive" ? "text-green-500" :
                    factor.impact === "negative" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {factor.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/70 italic">
          AI analysis is provided for reference. Final decisions rest with match officials.
        </p>
      </div>
    </motion.div>
  );
}

function ImpactIcon({ impact }: { impact: "positive" | "negative" | "neutral" }) {
  const iconProps = "h-4 w-4";
  
  switch (impact) {
    case "positive":
      return <TrendingUp className={cn(iconProps, "text-green-500")} />;
    case "negative":
      return <TrendingDown className={cn(iconProps, "text-destructive")} />;
    default:
      return <Minus className={cn(iconProps, "text-muted-foreground")} />;
  }
}

