import * as React from "react"; // ^18.0.0
import { useNavigate } from "react-router-dom"; // ^6.0.0
import { toast } from "@shadcn/ui"; // ^1.0.0
import { ErrorBoundary } from "react-error-boundary"; // ^4.0.0

import CandidateForm from "../../components/candidates/CandidateForm";
import PageHeader from "../../components/layout/PageHeader";
import { useCandidates } from "../../lib/hooks/useCandidates";
import { CandidateFormData } from "../../types/candidates";
import { ERROR_MESSAGES } from "../../config/constants";

/**
 * CreateCandidatePage - A secure and accessible page component for creating new candidates
 * Implements comprehensive form validation, secure file handling, and error management
 */
const CreateCandidatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createCandidate, isCreating, createError } = useCandidates();

  // Handle form submission with error handling and user feedback
  const handleSubmit = async (formData: CandidateFormData) => {
    try {
      // Attempt to create the candidate
      await createCandidate(formData);

      // Show success notification
      toast({
        title: "Success",
        description: "Candidate profile created successfully",
        variant: "success",
        duration: 5000,
      });

      // Navigate to candidates list
      navigate("/candidates");
    } catch (error) {
      // Log error for monitoring
      console.error("Failed to create candidate:", error);

      // Show error notification
      toast({
        title: "Error",
        description: createError?.message || ERROR_MESSAGES.GENERIC_ERROR,
        variant: "destructive",
        duration: 7000,
      });

      // Re-throw for error boundary
      throw error;
    }
  };

  // Handle cancellation and navigation
  const handleCancel = () => {
    // Show confirmation if form is dirty
    if (window.confirm("Are you sure you want to cancel? Any unsaved changes will be lost.")) {
      navigate("/candidates");
    }
  };

  // Error fallback component
  const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
    error,
    resetErrorBoundary,
  }) => (
    <div
      role="alert"
      className="p-6 mx-auto max-w-2xl mt-8 rounded-lg border border-destructive bg-destructive/10"
    >
      <h2 className="text-lg font-semibold mb-2">Error Creating Candidate</h2>
      <p className="text-sm mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          // Reset any state that might have caused the error
          navigate(0);
        }}
      >
        <PageHeader
          title="Create New Candidate"
          description="Add a new candidate to the talent pool"
          actions={
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={isCreating}
            >
              Cancel
            </button>
          }
        />

        <div className="mt-8 max-w-2xl mx-auto">
          <CandidateForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isCreating}
            autoSave={false}
            validationRules={{
              required: ["full_name", "email", "phone"],
              email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
              phone: (value) => /^\+?[\d\s-()]{10,}$/.test(value),
            }}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
};

export default CreateCandidatePage;