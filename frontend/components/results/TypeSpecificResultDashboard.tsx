"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { api, readable } from "../../lib/api";
import RegularElectionDashboard from "./RegularElectionDashboard";
import PollDashboard from "./PollDashboard";
import MultipleChoiceDashboard from "./MultipleChoiceDashboard";
import DecisionDashboard from "./DecisionDashboard";
import RatingDashboard from "./RatingDashboard";
import QuickVoterResultsSection from "./QuickVoterResultsSection";

import PresidentialResultDashboard from "./PresidentialResultDashboard";

interface TypeSpecificResultDashboardProps {
  results: any;
  electionId?: string;
}

export default function TypeSpecificResultDashboard({
  results,
  electionId,
}: TypeSpecificResultDashboardProps) {
  const [exporting, setExporting] = useState(false);

  if (!results) {
    return (
      <div className="card p-8 text-center text-slate-500 text-sm">
        No results data available.
      </div>
    );
  }

  const targetElectionId = electionId || results?.election?.id || results?.election?.election_id;
  const votingType = (results?.voting_type || results?.election?.voting_type || "general").toLowerCase();
  const isQuickEntry =
    results?.voter_registration_mode === "quick_entry" ||
    results?.election?.voter_registration_mode === "quick_entry" ||
    Boolean(results?.voter_records && results.voter_records.length > 0);

  const handleExportExcel = async () => {
    if (!targetElectionId) {
      toast.error("Election ID missing for Excel export.");
      return;
    }
    setExporting(true);
    try {
      const res = await api.get(`/admin/elections/${targetElectionId}/export/excel`, {
        responseType: "blob",
      });

      let filename = `Civitas_${results?.election?.name ? results.election.name.replace(/[^a-zA-Z0-9_-]/g, "_") : "Election"}_Results.xlsx`;
      const disposition = res.headers["content-disposition"] || res.headers["Content-Disposition"];
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel report downloaded successfully.");
    } catch (err: any) {
      toast.error(readable(err) || "Failed to generate Excel report.");
    } finally {
      setExporting(false);
    }
  };

  const renderDashboard = () => {
    switch (votingType) {
      case "presidential":
        return (
          <PresidentialResultDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
      case "council":
      case "multiple_choice":
        return (
          <MultipleChoiceDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
      case "referendum":
      case "yes_no":
        return (
          <DecisionDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
      case "poll":
        return (
          <PollDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
      case "rating":
        return (
          <RatingDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
      case "general":
      case "regular":
      default:
        return (
          <RegularElectionDashboard
            results={results}
            onExportExcel={handleExportExcel}
            exporting={exporting}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {renderDashboard()}
      {isQuickEntry && <QuickVoterResultsSection results={results} />}
    </div>
  );
}
