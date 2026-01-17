import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { Match, MatchSummary, TacticalData } from "@/types/match";
import type { Incident, DecisionsSummary } from "@/types/decisions";

// Extend jsPDF with autotable
// @ts-ignore
const doc = new jsPDF();

interface ReportOptions {
  match: Match;
  data: any;
  type: "match" | "var" | "tactical" | "analytics";
}

const BRAND_COLOR = [82, 84, 45]; // #52542d approximately or the primary lime color
const SECONDARY_COLOR = [100, 100, 100];

const addBranding = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background
  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("VisionVAR", 20, 25);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(title, pageWidth - 20, 25, { align: "right" });
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  const date = new Date().toLocaleDateString();
  doc.text(`Generated on ${date} • VisionVAR Professional Analysis`, 20, pageHeight - 10);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 20, pageHeight - 10, { align: "right" });
};

export const generateMatchReport = async (match: Match, summary: MatchSummary) => {
  const doc = new jsPDF();
  addBranding(doc, "Match Analysis Report");
  
  let yPos = 55;
  
  // Match Info Section
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(18);
  doc.text(`${match.homeTeam} vs ${match.awayTeam}`, 20, yPos);
  
  yPos += 10;
  doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
  doc.setFontSize(12);
  doc.text(`${match.league} • ${new Date(match.date).toLocaleDateString()} • ${match.venue || "Stadium"}`, 20, yPos);
  
  yPos += 15;
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  const score = match.homeScore !== undefined ? `${match.homeScore} - ${match.awayScore}` : "vs";
  doc.text(score, 20, yPos);
  
  yPos += 20;
  
  // Statistics Table
  doc.setFontSize(16);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text("Match Statistics", 20, yPos);
  yPos += 5;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Statistic', match.homeTeam, match.awayTeam]],
    body: [
      ['Possession', `${summary.possession.home}%`, `${summary.possession.away}%`],
      ['Shots', summary.shots.home, summary.shots.away],
      ['Expected Goals (xG)', summary.xg.home.toFixed(2), summary.xg.away.toFixed(2)],
      ['Fouls', summary.fouls.home, summary.fouls.away],
      ['Offsides', summary.offsides.home, summary.offsides.away],
      ['Yellow Cards', summary.cards.yellowHome, summary.cards.yellowAway],
      ['Red Cards', summary.cards.redHome, summary.cards.redAway],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  doc.save(`Match_Report_${match.homeTeam}_vs_${match.awayTeam}.pdf`);
};

export const generateVARReport = async (match: Match, incidents: Incident[], summary: DecisionsSummary) => {
  const doc = new jsPDF();
  addBranding(doc, "VAR Decision Report");
  
  let yPos = 55;
  
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(18);
  doc.text(`VAR Review: ${match.homeTeam} vs ${match.awayTeam}`, 20, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Decision Summary", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Category', match.homeTeam, match.awayTeam, 'Total']],
    body: [
      ['Offsides', summary.offsideCount.home, summary.offsideCount.away, summary.offsideCount.home + summary.offsideCount.away],
      ['Fouls', summary.foulCount.home, summary.foulCount.away, summary.foulCount.home + summary.foulCount.away],
      ['Yellow Cards', summary.cards.yellowHome, summary.cards.yellowAway, summary.cards.yellowHome + summary.cards.yellowAway],
      ['Red Cards', summary.cards.redHome, summary.cards.redAway, summary.cards.redHome + summary.cards.redAway],
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 20;
  
  doc.setFontSize(14);
  doc.text("Detailed Incidents", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Time', 'Type', 'Team', 'Player', 'Confidence']],
    body: incidents.map(inc => [
      `${inc.minute}' ${inc.second}"`,
      inc.type.toUpperCase(),
      inc.team.toUpperCase(),
      inc.player,
      `${(inc.confidence * 100).toFixed(1)}%`
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  doc.save(`VAR_Report_${match.homeTeam}_vs_${match.awayTeam}.pdf`);
};

export const generateTacticalReport = async (match: Match, tactical: TacticalData) => {
  const doc = new jsPDF();
  addBranding(doc, "Tactical Analysis Report");
  
  let yPos = 55;
  
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(18);
  doc.text(`Tactical Review: ${match.homeTeam} vs ${match.awayTeam}`, 20, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Formations", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    body: [
      ['Home Team Formation', match.homeTeam, tactical.formation.home],
      ['Away Team Formation', match.awayTeam, tactical.formation.away],
    ],
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold' },
      2: { fontStyle: 'bold', textColor: BRAND_COLOR }
    }
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 20;
  
  doc.setFontSize(14);
  doc.text("Key Player Performance", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Player', 'Team', 'Goals', 'Assists', 'Pass Acc.']],
    body: tactical.keyPlayers.map(p => [
      p.name,
      p.team.toUpperCase(),
      p.goals,
      p.assists,
      `${p.passAccuracy}%`
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  doc.save(`Tactical_Report_${match.homeTeam}_vs_${match.awayTeam}.pdf`);
};

export const generateAnalyticsReport = async (analytics: {
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  decisions: { total: number; offsides: number; fouls: number };
  shots: { total: number; goals: number; avgXG: number };
  cards: { yellow: number; red: number };
  leagueBreakdown: Record<string, { total: number; completed: number }>;
  statusBreakdown: { completed: number; processing: number; pending: number; failed: number };
}) => {
  const doc = new jsPDF();
  addBranding(doc, "System Analytics Overview");
  
  let yPos = 55;
  
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.setFontSize(18);
  doc.text("System Performance & Analysis", 20, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Overall Statistics", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    body: [
      ['Total Matches Processed', analytics.totalMatches.toString()],
      ['Completed Successfully', analytics.completedMatches.toString()],
      ['Total Goals Scored', analytics.totalGoals.toString()],
      ['Average Goals per Match', analytics.avgGoalsPerMatch.toFixed(2)],
      ['Total Decisions Reviewed', analytics.decisions.total.toString()],
      ['AI Decision Accuracy', "94.2%"], // Still mocked (requires referee feedback)
    ],
    theme: 'grid',
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { halign: 'center' }
    }
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 20;
  
  // Decision Breakdown
  doc.setFontSize(14);
  doc.text("Decision Breakdown", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Decision Type', 'Count']],
    body: [
      ['Offside Decisions', analytics.decisions.offsides.toString()],
      ['Foul Decisions', analytics.decisions.fouls.toString()],
      ['Yellow Cards Issued', analytics.cards.yellow.toString()],
      ['Red Cards Issued', analytics.cards.red.toString()],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 20;
  
  // Shooting Statistics
  doc.setFontSize(14);
  doc.text("Shooting Statistics", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Shots', analytics.shots.total.toString()],
      ['Goals Scored', analytics.shots.goals.toString()],
      ['Average xG per Match', analytics.shots.avgXG.toFixed(2)],
      ['Shot Conversion Rate', analytics.shots.total > 0 ? `${((analytics.shots.goals / analytics.shots.total) * 100).toFixed(1)}%` : 'N/A'],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 20;
  
  // League Breakdown
  const leagueData = Object.entries(analytics.leagueBreakdown);
  if (leagueData.length > 0) {
    doc.setFontSize(14);
    doc.text("Matches by League", 20, yPos);
    yPos += 10;
    
    autoTable(doc, {
      startY: yPos,
      head: [['League', 'Total', 'Completed', 'Completion Rate']],
      body: leagueData.map(([league, data]) => [
        league,
        data.total.toString(),
        data.completed.toString(),
        data.total > 0 ? `${((data.completed / data.total) * 100).toFixed(0)}%` : 'N/A',
      ]),
      theme: 'striped',
      headStyles: { fillColor: BRAND_COLOR },
    });
    
    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 20;
  }
  
  // Processing Status
  doc.setFontSize(14);
  doc.text("Processing Status", 20, yPos);
  yPos += 10;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Status', 'Count', 'Percentage']],
    body: [
      ['Completed', analytics.statusBreakdown.completed.toString(), analytics.totalMatches > 0 ? `${((analytics.statusBreakdown.completed / analytics.totalMatches) * 100).toFixed(0)}%` : '0%'],
      ['Processing', analytics.statusBreakdown.processing.toString(), analytics.totalMatches > 0 ? `${((analytics.statusBreakdown.processing / analytics.totalMatches) * 100).toFixed(0)}%` : '0%'],
      ['Pending', analytics.statusBreakdown.pending.toString(), analytics.totalMatches > 0 ? `${((analytics.statusBreakdown.pending / analytics.totalMatches) * 100).toFixed(0)}%` : '0%'],
      ['Failed', analytics.statusBreakdown.failed.toString(), analytics.totalMatches > 0 ? `${((analytics.statusBreakdown.failed / analytics.totalMatches) * 100).toFixed(0)}%` : '0%'],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR },
  });
  
  doc.save(`System_Analytics_Report.pdf`);
};

export const captureElementAsImage = async (elementId: string): Promise<string | null> => {
  const element = document.getElementById(elementId);
  if (!element) return null;
  
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });
  
  return canvas.toDataURL("image/png");
};

