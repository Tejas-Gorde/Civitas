"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, readable } from "../../../lib/api";
import { toast } from "sonner";
import {
  Shield,
  Key,
  Users,
  Vote,
  Settings,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

export default function CreateElectionWizardPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [createdSuccessData, setCreatedSuccessData] = useState<any | null>(null);

  // STEP 1: Local Admin Credentials
  const [tempAdminId, setTempAdminId] = useState("");
  const [tempAdminPassword, setTempAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // STEP 2: Election Information
  const [name, setName] = useState("");
  const [electionCustomId, setElectionCustomId] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [showVoterNames, setShowVoterNames] = useState(false);

  // STEP 3: Candidates Roster
  const [candidateList, setCandidateList] = useState<Array<{ name: string; party: string; manifesto: string }>>([]);
  const [candName, setCandName] = useState("");
  const [candParty, setCandParty] = useState("");
  const [candManifesto, setCandManifesto] = useState("");

  // STEP 4: Voters / Members
  const [voterList, setVoterList] = useState<Array<{ voter_id: string; full_name: string; voter_password?: string }>>([]);
  const [voterRegId, setVoterRegId] = useState("");
  const [voterFullName, setVoterFullName] = useState("");
  const [voterPassword, setVoterPassword] = useState("");
  const [voterConfirmPassword, setVoterConfirmPassword] = useState("");
  const [showVoterPass, setShowVoterPass] = useState(false);

  // Auto-generate persistent Election ID at Step 2 if empty
  useEffect(() => {
    if (!electionCustomId) {
      const generated = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ELEC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      setElectionCustomId(generated);
    }
  }, [electionCustomId]);

  // STEP 5: Verification & Flow Configuration
  const [votingFlowMode, setVotingFlowMode] = useState("full");
  const [enableStep2, setEnableStep2] = useState(true);
  const [enableStep3, setEnableStep3] = useState(true);
  const [enableStep4, setEnableStep4] = useState(true);
  const [enableStep5, setEnableStep5] = useState(true);

  // Handlers for Adding Candidates & Voters
  const handleAddCandidate = () => {
    if (!candName.trim() || !candParty.trim()) {
      toast.error("Please provide Candidate Name and Party.");
      return;
    }
    setCandidateList((prev) => [
      ...prev,
      { name: candName.trim(), party: candParty.trim(), manifesto: candManifesto.trim() || "No manifesto provided." },
    ]);
    setCandName("");
    setCandParty("");
    setCandManifesto("");
    toast.success("Candidate added to setup list.");
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidateList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddVoter = () => {
    if (!voterRegId.trim() || !voterFullName.trim()) {
      toast.error("Please provide Voter Registration ID and Full Name.");
      return;
    }
    if (!voterPassword.trim()) {
      toast.error("Voter password is required.");
      return;
    }
    if (voterPassword.trim().length < 4) {
      toast.error("Voter password must be at least 4 characters long.");
      return;
    }
    if (voterPassword !== voterConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setVoterList((prev) => [
      ...prev,
      { voter_id: voterRegId.trim(), full_name: voterFullName.trim(), voter_password: voterPassword.trim() },
    ]);
    setVoterRegId("");
    setVoterFullName("");
    setVoterPassword("");
    setVoterConfirmPassword("");
    toast.success("Voter added to setup list.");
  };

  const handleRemoveVoter = (index: number) => {
    setVoterList((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!tempAdminId.trim()) {
      toast.error("Local Admin ID is required.");
      return false;
    }
    if (!tempAdminPassword.trim()) {
      toast.error("Local Admin Password is required.");
      return false;
    }
    if (tempAdminPassword.trim().length < 4) {
      toast.error("Password should be at least 4 characters long.");
      return false;
    }
    if (tempAdminPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    if (!name.trim()) {
      toast.error("Election Name is required.");
      return false;
    }
    if (!electionCustomId.trim()) {
      toast.error("Election ID is required.");
      return false;
    }
    if (!startsAt || !endsAt) {
      toast.error("Please specify both Start and End times.");
      return false;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast.error("End time must be after start time.");
      return false;
    }
    return true;
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        temp_admin_id: tempAdminId.trim(),
        temp_admin_password: tempAdminPassword.trim(),
        name: name.trim(),
        election_id: electionCustomId.trim(),
        description: description.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        show_voter_names_in_results: showVoterNames,
        voting_flow_mode: votingFlowMode,
        enable_step_2: enableStep2,
        enable_step_3: enableStep3,
        enable_step_4: enableStep4,
        enable_step_5: enableStep5,
        candidates: candidateList,
        voters: voterList,
      };

      const res = await api.post("/admin/elections/onboarding", payload);
      const createdElection = res.data;

      setCreatedSuccessData({
        internal_id: createdElection.id,
        election_id: createdElection.election_id || electionCustomId.trim(),
        election_name: createdElection.name,
        temp_admin_id: tempAdminId.trim(),
        temp_admin_password: tempAdminPassword.trim(),
      });

      toast.success("Election and Local Admin created successfully!");
    } catch (err: any) {
      toast.error(readable(err));
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS SCREEN AFTER CREATION
  if (createdSuccessData) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-6">
        <div className="card p-8 sm:p-10 text-center space-y-5 bg-gradient-to-b from-white to-teal-50 border-teal-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">
              SETUP COMPLETED
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Election Created Successfully!
            </h1>
            <p className="text-xs text-slate-600">
              Your election and dedicated Local Admin credentials have been configured.
            </p>
          </div>

          {/* Details Summary Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 text-left space-y-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Election Name:</span>
              <p className="font-bold text-slate-900 text-base">{createdSuccessData.election_name}</p>
            </div>

            <div>
              <span className="text-slate-500 font-medium block">Public Election ID (For Voters):</span>
              <code className="block p-2 bg-slate-50 rounded border border-slate-200 font-mono font-bold text-teal-800 text-sm break-all mt-0.5">
                {createdSuccessData.election_id}
              </code>
              <p className="text-[10px] text-slate-500 mt-0.5">Voters must enter this Election ID in the Voter Portal to cast their ballot.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-500 font-medium block">Local Admin ID:</span>
                <code className="block p-2 bg-slate-50 rounded border border-slate-200 font-mono font-bold text-slate-800 text-xs mt-0.5">
                  {createdSuccessData.temp_admin_id}
                </code>
              </div>

              <div>
                <span className="text-slate-500 font-medium block">Local Admin Password:</span>
                <code className="block p-2 bg-slate-50 rounded border border-slate-200 font-mono font-bold text-slate-800 text-xs mt-0.5">
                  {createdSuccessData.temp_admin_password}
                </code>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
              Note: Store Local Admin credentials safely for managing this election.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/local-admin")}
              className="button button-teal text-xs py-3 px-6 font-bold"
            >
              Go to Local Admin Login
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Top Banner */}
      <div className="card p-5 sm:p-8 bg-slate-950 text-white rounded-xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
            <Plus className="h-3.5 w-3.5" />
            <span>CREATE NEW ELECTION WIZARD</span>
          </div>
          <h1 className="mt-2 text-xl sm:text-3xl font-black tracking-tight text-white">
            Create Election & Local Admin Credentials
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Guided 6-step election setup starting with dedicated Local Admin provisioning.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/admin/manage")}
          className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0 self-start sm:self-auto min-h-[40px]"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5 inline" />
          Cancel Setup
        </button>
      </div>

      {/* Progress Steps Bar (Desktop sm+) */}
      <div className="hidden sm:flex rounded-xl bg-slate-100 p-1.5 border border-slate-200/80 overflow-x-auto text-[11px] font-bold text-slate-600 shadow-xs">
        {[
          "1. Admin Credentials",
          "2. Election Info",
          "3. Candidates",
          "4. Voters",
          "5. Verification",
          "6. Review",
        ].map((lbl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (idx + 1 < currentStep) setCurrentStep(idx + 1);
            }}
            disabled={idx + 1 > currentStep}
            className={`flex-1 py-2 px-2 text-center rounded-lg whitespace-nowrap transition-all ${
              currentStep === idx + 1
                ? "bg-indigo-600 text-white shadow-xs font-extrabold"
                : currentStep > idx + 1
                ? "bg-indigo-50 text-indigo-700 cursor-pointer hover:bg-indigo-100"
                : "text-slate-400 cursor-not-allowed opacity-60"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Progress Steps Bar (Mobile <sm) */}
      <div className="sm:hidden card p-4 space-y-2 bg-white border border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-black">
              {currentStep}
            </span>
            <span className="font-bold text-slate-900">
              {
                ["Admin Credentials", "Election Info", "Candidates", "Voters", "Verification", "Review"][currentStep - 1]
              }
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Step {currentStep} of 6
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* STEP 1: CREATE YOUR LOCAL ADMIN CREDENTIALS */}
      {currentStep === 1 && (
        <div className="card p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="border-b border-slate-100 pb-3 sm:pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 1 OF 6
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">CREATE YOUR LOCAL ADMIN CREDENTIALS</h2>
            <p className="text-xs text-slate-600 mt-1">
              These credentials will be used to manage this election after it is created.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Local Admin ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={tempAdminId}
                onChange={(e) => setTempAdminId(e.target.value)}
                placeholder="e.g. electionA_admin"
                className="input font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Local Admin Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={tempAdminPassword}
                  onChange={(e) => setTempAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className="button button-teal text-xs py-2.5 px-6"
            >
              Continue to Election Setup
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ELECTION INFORMATION */}
      {currentStep === 2 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 2 OF 6
            </span>
            <h2 className="text-xl font-bold text-slate-900">ELECTION INFORMATION</h2>
            <p className="text-xs text-slate-600 mt-1">
              Provide general details, custom Election ID, and schedule for the election.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Election Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Student Council Election 2026"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Election ID (Public Identifier for Voters) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={electionCustomId}
                onChange={(e) => setElectionCustomId(e.target.value)}
                placeholder="e.g. SCE-2026-001"
                className="input font-mono font-bold text-teal-800"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Unique identifier that voters will use to find and access this election.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide context or guidelines for voters..."
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Start Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  End Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* SHOW VOTER NAME IN RESULTS TOGGLE */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  SHOW VOTER NAME IN RESULTS
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  If disabled, public results will NOT display individual voter names.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoterNames(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    !showVoterNames ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setShowVoterNames(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    showVoterNames ? "bg-teal-600 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="button button-secondary text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
              Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateStep2()) setCurrentStep(3);
              }}
              className="button button-teal text-xs py-2.5 px-6"
            >
              Continue to Candidates
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CANDIDATES SETUP */}
      {currentStep === 3 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 3 OF 6
            </span>
            <h2 className="text-xl font-bold text-slate-900">CONFIGURE CANDIDATES</h2>
            <p className="text-xs text-slate-600 mt-1">
              Add candidates for voters to select on their ballot.
            </p>
          </div>

          {/* Candidate Form */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={candName}
                onChange={(e) => setCandName(e.target.value)}
                placeholder="Candidate Full Name"
                className="input text-xs"
              />
              <input
                type="text"
                value={candParty}
                onChange={(e) => setCandParty(e.target.value)}
                placeholder="Party / Alliance Name"
                className="input text-xs"
              />
            </div>
            <textarea
              rows={2}
              value={candManifesto}
              onChange={(e) => setCandManifesto(e.target.value)}
              placeholder="Candidate manifesto..."
              className="input text-xs"
            />
            <button
              type="button"
              onClick={handleAddCandidate}
              className="button button-teal text-xs py-2 px-4"
            >
              <Plus className="h-3.5 w-3.5 mr-1 inline" />
              Add Candidate to List
            </button>
          </div>

          {/* Added Candidate List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Added Candidates ({candidateList.length})
            </h4>

            {candidateList.length === 0 && (
              <p className="text-xs text-slate-500 italic p-3 bg-white border border-slate-200 rounded-lg">
                No candidates added yet. You can also add candidates later from the Election Admin panel.
              </p>
            )}

            {candidateList.map((c, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <h5 className="font-bold text-slate-900">{c.name}</h5>
                  <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {c.party}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCandidate(idx)}
                  className="text-rose-600 hover:text-rose-800 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="button button-secondary text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="button button-teal text-xs py-2.5 px-6"
            >
              Continue to Voters/Members
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: VOTERS / MEMBERS SETUP */}
      {currentStep === 4 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 4 OF 6
            </span>
            <h2 className="text-xl font-bold text-slate-900">CONFIGURE MEMBERS / VOTERS</h2>
            <p className="text-xs text-slate-600 mt-1">
              Add eligible voters for this election.
            </p>
          </div>

          {/* Voter Form */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Voter ID *</label>
                <input
                  type="text"
                  value={voterRegId}
                  onChange={(e) => setVoterRegId(e.target.value)}
                  placeholder="e.g. VOTER-1001"
                  className="input text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={voterFullName}
                  onChange={(e) => setVoterFullName(e.target.value)}
                  placeholder="e.g. Tejas Sharma"
                  className="input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Voter Password *</label>
                <input
                  type="password"
                  value={voterPassword}
                  onChange={(e) => setVoterPassword(e.target.value)}
                  placeholder="Assign password (min 4 chars)"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  value={voterConfirmPassword}
                  onChange={(e) => setVoterConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="input text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddVoter}
              className="button button-teal text-xs py-2 px-4 font-bold"
            >
              <Plus className="h-3.5 w-3.5 mr-1 inline" />
              Add Voter to Setup List
            </button>
          </div>

          {/* Added Voter List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Added Voters ({voterList.length})
            </h4>

            {voterList.length === 0 && (
              <p className="text-xs text-slate-500 italic p-3 bg-white border border-slate-200 rounded-lg">
                No voters added yet. You can also register voters later from the Election Admin panel.
              </p>
            )}

            {voterList.map((v, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <h5 className="font-bold text-slate-900">{v.full_name}</h5>
                  <span className="font-mono text-[10px] text-slate-600">{v.voter_id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVoter(idx)}
                  className="text-rose-600 hover:text-rose-800 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="button button-secondary text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="button button-teal text-xs py-2.5 px-6"
            >
              Continue to Verification Settings
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: VERIFICATION / VOTING CONFIGURATION */}
      {currentStep === 5 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 5 OF 6
            </span>
            <h2 className="text-xl font-bold text-slate-900">VERIFICATION & VOTING SETTINGS</h2>
            <p className="text-xs text-slate-600 mt-1">
              Configure verification steps enabled during voter entry.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Voting Flow Mode
              </label>
              <select
                value={votingFlowMode}
                onChange={(e) => setVotingFlowMode(e.target.value)}
                className="input text-xs"
              >
                <option value="full">Full Verification (Multimodal Identity + Biometrics)</option>
                <option value="standard">Standard Verification (Voter ID + Password + Ballot)</option>
                <option value="express">Express Verification (Instant Voter Verification)</option>
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Verification Steps Toggles
              </h4>

              {[
                { label: "Step 2: Device & Touch ID Check", val: enableStep2, set: setEnableStep2 },
                { label: "Step 3: Live Photo Verification", val: enableStep3, set: setEnableStep3 },
                { label: "Step 4: Interactive Liveness Challenge", val: enableStep4, set: setEnableStep4 },
                { label: "Step 5: Ballot Confirmation & Encryption", val: enableStep5, set: setEnableStep5 },
              ].map((s, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{s.label}</span>
                  <input
                    type="checkbox"
                    checked={s.val}
                    onChange={(e) => s.set(e.target.checked)}
                    className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="button button-secondary text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(6)}
              className="button button-teal text-xs py-2.5 px-6"
            >
              Review Election Setup
              <ArrowRight className="h-4 w-4 ml-1.5 inline" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW & CREATE ELECTION */}
      {currentStep === 6 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest">
              STEP 6 OF 6
            </span>
            <h2 className="text-xl font-bold text-slate-900">REVIEW & CREATE ELECTION</h2>
            <p className="text-xs text-slate-600 mt-1">
              Verify your setup details before finalizing election creation.
            </p>
          </div>

          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div>
              <span className="text-slate-500 font-bold uppercase block text-[10px]">LOCAL ADMIN ID</span>
              <p className="font-mono font-bold text-slate-800 text-sm">{tempAdminId}</p>
            </div>

            <div>
              <span className="text-slate-500 font-bold uppercase block text-[10px]">ELECTION ID (PUBLIC IDENTIFIER)</span>
              <p className="font-mono font-bold text-teal-800 text-sm">{electionCustomId}</p>
            </div>

            <div>
              <span className="text-slate-500 font-bold uppercase block text-[10px]">ELECTION NAME</span>
              <p className="font-bold text-slate-900 text-sm">{name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 font-bold uppercase block text-[10px]">Starts At</span>
                <p className="font-medium text-slate-800">{startsAt ? new Date(startsAt).toLocaleString() : "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase block text-[10px]">Ends At</span>
                <p className="font-medium text-slate-800">{endsAt ? new Date(endsAt).toLocaleString() : "N/A"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 font-bold uppercase block text-[10px]">Candidates Count</span>
                <p className="font-bold text-slate-800">{candidateList.length}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase block text-[10px]">Voters Registered</span>
                <p className="font-bold text-slate-800">{voterList.length}</p>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold uppercase block text-[10px]">Show Voter Names in Results</span>
              <p className="font-bold text-slate-900">{showVoterNames ? "Yes (Enabled)" : "No (Disabled)"}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="button button-secondary text-xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
              Back
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading}
              className="button button-teal text-xs py-3 px-8 font-bold"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                  Creating Election & Generating Credentials...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5 inline" />
                  Create Election & Generate Local Admin Credentials
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
