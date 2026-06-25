import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UploadJob {
    matchId: number;
    progress: number;
    status: "uploading" | "processing" | "completed" | "failed";
    message?: string;
    homeTeam: string;
    awayTeam: string;
}

interface UploadContextType {
    currentUpload: UploadJob | null;
    startBackgroundUpload: (matchId: number, homeTeam: string, awayTeam: string) => void;
    clearUpload: () => void;
    updateProgress: (progress: number, status: UploadJob["status"], message?: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUpload, setCurrentUpload] = useState<UploadJob | null>(null);
    const queryClient = useQueryClient();

    // Poll for status when we have an active upload
    useEffect(() => {
        if (!currentUpload || currentUpload.status === "completed" || currentUpload.status === "failed") {
            return;
        }

        const pollStatus = async () => {
            try {
                const response = await fetch(`http://localhost:8000/matches/${currentUpload.matchId}/status`);
                if (!response.ok) return;

                const data = await response.json();

                setCurrentUpload(prev => prev ? {
                    ...prev,
                    progress: data.progress,
                    status: data.status,
                    message: data.message
                } : null);

                // When completed, invalidate matches query to refresh list
                if (data.status === "completed") {
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                }
            } catch (error) {
                console.error("Failed to poll upload status:", error);
            }
        };

        const interval = setInterval(pollStatus, 3000);
        return () => clearInterval(interval);
    }, [currentUpload?.matchId, currentUpload?.status, queryClient]);

    const startBackgroundUpload = (matchId: number, homeTeam: string, awayTeam: string) => {
        setCurrentUpload({
            matchId,
            progress: 0,
            status: "processing",
            homeTeam,
            awayTeam,
            message: "Processing started..."
        });
    };

    const clearUpload = () => {
        setCurrentUpload(null);
    };

    const updateProgress = (progress: number, status: UploadJob["status"], message?: string) => {
        setCurrentUpload(prev => prev ? { ...prev, progress, status, message } : null);
    };

    return (
        <UploadContext.Provider value={{ currentUpload, startBackgroundUpload, clearUpload, updateProgress }}>
            {children}
        </UploadContext.Provider>
    );
};

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error("useUpload must be used within an UploadProvider");
    }
    return context;
};
