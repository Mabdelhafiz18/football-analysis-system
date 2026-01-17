import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Video, 
  BarChart3, 
  TrendingUp, 
  Download, 
  FileCheck,
  Loader2,
  History
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useMatches, useMatchSummary, useTactical } from "@/hooks/useMatches";
import { useDecisions } from "@/hooks/useDecisions";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ReportTypeCard } from "@/components/reports/ReportTypeCard";
import { MatchSelector } from "@/components/reports/MatchSelector";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  generateMatchReport, 
  generateVARReport, 
  generateTacticalReport, 
  generateAnalyticsReport 
} from "@/utils/pdfGenerator";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

type ReportType = "match" | "var" | "tactical" | "analytics";

export default function Reports() {
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics();
  const [searchParams] = useSearchParams();
  const { hasPermission, role } = usePermissions();
  const initialMatchId = searchParams.get("matchId") || "";
  const [selectedReport, setSelectedReport] = useState<ReportType>("match");
  const [selectedMatchId, setSelectedMatchId] = useState<string>(initialMatchId);
  const [isGenerating, setIsGenerating] = useState(false);

  // Add useEffect to set match when coming from query param
  useEffect(() => {
    if (initialMatchId && matches) {
      const matchExists = matches.some(m => m.id.toString() === initialMatchId);
      if (matchExists) {
        setSelectedMatchId(initialMatchId);
      }
    }
  }, [initialMatchId, matches]);

  // Data hooks for selected match
  const { data: summary } = useMatchSummary(parseInt(selectedMatchId));
  const { data: tactical } = useTactical(parseInt(selectedMatchId));
  const { incidents, summary: decisionsSummary } = useDecisions(selectedMatchId);

  const handleGenerate = async () => {
    if (!selectedMatchId && selectedReport !== "analytics") {
      toast.error("Please select a match first");
      return;
    }

    const match = matches?.find(m => m.id.toString() === selectedMatchId);
    
    setIsGenerating(true);
    toast.info(`Generating ${selectedReport.toUpperCase()} report...`);

    try {
      if (selectedReport === "match" && match && summary) {
        await generateMatchReport(match, summary);
      } else if (selectedReport === "var" && match && incidents && decisionsSummary) {
        await generateVARReport(match, incidents, decisionsSummary);
      } else if (selectedReport === "tactical" && match && tactical) {
        await generateTacticalReport(match, tactical);
      } else if (selectedReport === "analytics" && analytics) {
        await generateAnalyticsReport(analytics);
      } else {
        throw new Error("Missing data for report generation");
      }
      
      toast.success(`${selectedReport.toUpperCase()} report generated successfully!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTypes = [
    {
      id: "match" as const,
      title: "Match Analysis",
      description: "Complete overview of scores, possession, and core statistics.",
      icon: FileText,
      permission: "view_matches" as const,
    },
    {
      id: "var" as const,
      title: "VAR Decisions",
      description: "Detailed breakdown of all offside and foul reviews with AI confidence.",
      icon: Video,
      permission: "view_decisions" as const,
    },
    {
      id: "tactical" as const,
      title: "Tactical Review",
      description: "Formation analysis, key player positions and passing networks.",
      icon: BarChart3,
      permission: "view_tactical" as const,
    },
    {
      id: "analytics" as const,
      title: "System Analytics",
      description: "Aggregate performance metrics across all processed matches.",
      icon: TrendingUp,
      permission: "view_analytics" as const,
    },
  ].filter(type => {
    // Specifically restrict coaches from downloading System Analytics report
    if (type.id === "analytics" && role === "coach") return false;
    return hasPermission(type.permission);
  });

  return (
    <AppLayout title="Reports">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold text-foreground mb-2">Reports Center</h1>
            <p className="text-muted-foreground">Generate professional PDF analysis reports for your matches.</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Button variant="outline" className="gap-2 border-border/50 bg-muted/20">
              <History className="h-4 w-4" />
              Recent Exports
            </Button>
          </motion.div>
        </div>

        {/* Report Type Selection */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Select Report Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map((type) => (
              <ReportTypeCard
                key={type.id}
                title={type.title}
                description={type.description}
                icon={type.icon}
                selected={selectedReport === type.id}
                onClick={() => setSelectedReport(type.id)}
              />
            ))}
          </div>
        </div>

        {/* Configuration Section */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedReport}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-2xl p-6 md:p-8 space-y-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h2 className="text-lg font-bold text-foreground">Configure Report Options</h2>
            </div>

            {selectedReport !== "analytics" ? (
              <div className="max-w-md">
                <MatchSelector
                  matches={matches || []}
                  selectedMatchId={selectedMatchId}
                  onSelect={setSelectedMatchId}
                  disabled={matchesLoading}
                />
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-muted/20 border border-border/50 border-dashed text-center">
                <FileCheck className="h-10 w-10 text-primary mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {analyticsLoading 
                    ? "Loading analytics data..." 
                    : `System analytics report will include data from all ${analytics?.totalMatches || 0} matches currently in the system.`
                  }
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  PDF Format
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Professional Layout
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (selectedReport !== "analytics" && !selectedMatchId) || (selectedReport === "analytics" && analyticsLoading)}
                size="lg"
                className={cn(
                  "gap-2 px-8 min-w-[200px] lime-glow",
                  isGenerating && "opacity-80"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
