import * as React from "react"; // ^18.0.0
import { useParams, useNavigate } from "react-router-dom"; // ^6.0.0
import { useToast } from "@/components/ui/use-toast"; // ^0.1.0
import { z } from "zod"; // ^3.22.0
import CandidateForm from "../../components/candidates/CandidateForm";
import { getCandidate, updateCandidate } from "../../lib/api/candidates";
import { Candidate, CandidateFormData, candidateSchema } from "../../types/candidates";
import { ERROR_MESSAGES } from "../../config/constants";
import { analytics } from "@segment/analytics-next"; // ^1.51.0

interface EditCandidatePageState {
  loading: boolean;
  candidate: Candidate | null;
  error: string | null;
  isDirty: boolean;
}

const EditCandidatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = React.useState<EditCandidatePageState>({
    loading: true,
    candidate: null,
    error: null,
    isDirty: false
  });

  // Load candidate data on mount
  React.useEffect(() => {
    if (!id) {
      setState(prev => ({ ...prev, error: "Invalid candidate ID" }));
      return;
    }

    const loadCandidateData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const candidateData = await getCandidate(id);
        
        setState(prev => ({
          ...prev,
          candidate: candidateData,
          loading: false
        }));

        // Track page view
        analytics.track("candidate_edit_page_viewed", {
          candidateId: id,
          candidateName: candidateData.full_name
        });
      } catch (error) {
        console.error("Failed to load candidate:", error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: ERROR_MESSAGES.GENERIC_ERROR
        }));

        toast({
          title: "Error",
          description: "Failed to load candidate data. Please try again.",
          variant: "destructive"
        });
      }
    };

    loadCandidateData();
  }, [id, toast]);

  // Handle form submission
  const handleSubmit = async (formData: CandidateFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Validate form data
      const validatedData = candidateSchema.parse(formData);

      // Update candidate
      await updateCandidate(id!, validatedData);

      // Track successful update
      analytics.track("candidate_updated", {
        candidateId: id,
        updatedFields: Object.keys(formData)
      });

      toast({
        title: "Success",
        description: "Candidate profile updated successfully",
        variant: "default"
      });

      // Reset dirty state and navigate
      setState(prev => ({ ...prev, isDirty: false }));
      navigate(`/candidates/${id}`);
    } catch (error) {
      console.error("Failed to update candidate:", error);
      
      let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;
      if (error instanceof z.ZodError) {
        errorMessage = "Please check the form for validation errors.";
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });

      // Track error
      analytics.track("candidate_update_error", {
        candidateId: id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (state.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmed) return;
    }

    navigate(`/candidates/${id}`);
  };

  // Update dirty state when form changes
  const handleFormChange = () => {
    if (!state.isDirty) {
      setState(prev => ({ ...prev, isDirty: true }));
    }
  };

  // Prevent accidental navigation when form is dirty
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.isDirty]);

  if (state.error && !state.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-destructive text-lg">{state.error}</p>
        <button
          onClick={() => navigate("/candidates")}
          className="mt-4 btn btn-secondary"
        >
          Return to Candidates
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Edit Candidate: {state.candidate?.full_name}
        </h1>
        <button
          onClick={handleCancel}
          className="btn btn-secondary"
          disabled={state.loading}
        >
          Cancel
        </button>
      </div>

      {state.loading && !state.candidate ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <CandidateForm
          initialData={state.candidate || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={state.loading}
          autoSave={false}
          onChange={handleFormChange}
        />
      )}
    </div>
  );
};

export default EditCandidatePage;