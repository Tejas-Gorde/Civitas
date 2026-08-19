"use client";

import GeneralBallot from "./GeneralBallot";
import PresidentialBallot from "./PresidentialBallot";
import CouncilBallot from "./CouncilBallot";
import ReferendumBallot from "./ReferendumBallot";
import CustomBallot from "./CustomBallot";

interface Candidate {
  id: string;
  name: string;
  party: string;
  manifesto?: string;
  photo_url?: string | null;
  symbol_url?: string | null;
}

interface ElectionVotingViewProps {
  election: {
    id: string;
    name: string;
    description?: string;
    voting_type?: string;
    position_title?: string | null;
    max_selections?: number;
    allow_abstain?: boolean;
  };
  candidates: Candidate[];
  selectedCandidateId: string;
  selectedCandidateIds: string[];
  onSelectCandidate: (id: string) => void;
  onSelectCandidateIds: (ids: string[]) => void;
  onProceedToReview: () => void;
  onBackToIntro?: () => void;
}

export default function ElectionVotingView({
  election,
  candidates,
  selectedCandidateId,
  selectedCandidateIds,
  onSelectCandidate,
  onSelectCandidateIds,
  onProceedToReview,
  onBackToIntro,
}: ElectionVotingViewProps) {
  const normalizedType = (election.voting_type || "general").toLowerCase();

  // 1. Presidential Election View
  if (normalizedType === "presidential") {
    return (
      <PresidentialBallot
        candidates={candidates}
        selectedCandidateId={selectedCandidateId}
        positionTitle={election.position_title}
        onSelectCandidate={onSelectCandidate}
        onProceedToReview={onProceedToReview}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // 2. Council / Committee Multi-Seat Election View
  if (normalizedType === "council" || normalizedType === "multiple_choice") {
    return (
      <CouncilBallot
        candidates={candidates}
        selectedCandidateIds={selectedCandidateIds}
        maxSelections={election.max_selections || 1}
        onSelectCandidateIds={onSelectCandidateIds}
        onProceedToReview={onProceedToReview}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // 3. Referendum / Yes-No Proposal Ballot View
  if (normalizedType === "referendum" || normalizedType === "yes_no") {
    return (
      <ReferendumBallot
        proposalTitle={election.name}
        proposalDescription={election.description}
        candidates={candidates}
        selectedOptionId={selectedCandidateId}
        allowAbstain={election.allow_abstain}
        onSelectOption={onSelectCandidate}
        onProceedToReview={onProceedToReview}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // 4. Custom / Poll / Rating Ballot View
  if (normalizedType === "custom" || normalizedType === "poll" || normalizedType === "rating") {
    return (
      <CustomBallot
        title={election.name}
        description={election.description}
        candidates={candidates}
        maxSelections={election.max_selections || 1}
        selectedCandidateId={selectedCandidateId}
        selectedCandidateIds={selectedCandidateIds}
        onSelectSingle={onSelectCandidate}
        onSelectMultiple={onSelectCandidateIds}
        onProceedToReview={onProceedToReview}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // 5. Default General Election View
  return (
    <GeneralBallot
      candidates={candidates}
      selectedCandidateId={selectedCandidateId}
      onSelectCandidate={onSelectCandidate}
      onProceedToReview={onProceedToReview}
      onBackToIntro={onBackToIntro}
    />
  );
}
