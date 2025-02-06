import React from "react"; // ^18.0.0
import { useNavigate } from "react-router-dom"; // ^6.0.0
import { ErrorBoundary } from "react-error-boundary"; // ^4.0.0
import { useTelemetry } from "@hotgigs/telemetry"; // ^1.0.0

import JobForm from "../../components/jobs/JobForm";
import { createJob } from "../../lib/api/jobs";
import { useToast } from "../../lib/hooks/useToast";
import { JobFormData, JobStatus } from "../../types/jobs";
import { ErrorCode } from "../../types/common";
import { ERROR_MESSAGES } from "../../config/constants";

// Initial form data with default values
const initialJobData: JobFormData = {
  title: "",
  description: "",
  requirements: {
    experience_level: "ENTRY",
    years_experience: 0,
    required_skills: [],
    preferred_skills: [],
    qualifications: [],
    responsibilities: [],
    certifications: [],
    education_requirements: [],
    languages: [],
    background_check_required: false,
    tools_and_technologies: []
  },
  type: "FULL_TIME",
  skills: [],
  salary_min: 0,
  salary_max: 0,
  location: "",
  remote_allowed: false,
  department: "",
  benefits: [],
  is_draft: true,
  publish_date: null,
  form_state: {
    is_dirty: false,
    touched_fields: [],
    last_saved: null
  },
  validation: {
    required_fields: [
      "title",
      "description",
      "type",
      "location",
      "department"
    ],
    custom_validators: {},
    async_validators: {}
  },
  attachments: []
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => {
  const toast = useToast();

  React.useEffect(() => {
    toast.error({
      title: "Error",
      description: ERROR_MESSAGES.GENERIC_ERROR
    });
  }, [toast]);

  return (
    <div className="p-6 text-center" role="alert">
      <h2 className="text-lg font-semibold text-destructive mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
};

const CreateJobPage: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const telemetry = useTelemetry();

  const handleSubmit = React.useCallback(async (formData: JobFormData) => {
    setIsLoading(true);
    telemetry.trackEvent("job_creation_started", { is_draft: formData.is_draft });

    try {
      const { data, error } = await createJob(formData);

      if (error) {
        if (error.code === ErrorCode.VALIDATION_ERROR) {
          toast.error({
            title: "Validation Error",
            description: ERROR_MESSAGES.VALIDATION_ERROR,
            duration: 5000
          });
          telemetry.trackError("job_creation_validation_error", error);
        } else {
          toast.error({
            title: "Error",
            description: ERROR_MESSAGES.GENERIC_ERROR,
            duration: 5000
          });
          telemetry.trackError("job_creation_error", error);
        }
        return;
      }

      if (data) {
        const status = formData.is_draft ? JobStatus.DRAFT : JobStatus.PUBLISHED;
        const successMessage = formData.is_draft
          ? "Job saved as draft"
          : "Job posted successfully";

        toast.success({
          title: "Success",
          description: successMessage,
          duration: 3000
        });

        telemetry.trackEvent("job_creation_success", {
          job_id: data.id,
          status
        });

        // Navigate to the job details page
        navigate(`/jobs/${data.id}`, {
          state: { status }
        });
      }
    } catch (error) {
      toast.error({
        title: "Error",
        description: ERROR_MESSAGES.GENERIC_ERROR,
        duration: 5000
      });
      telemetry.trackError("job_creation_unexpected_error", error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast, telemetry]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => navigate("/jobs")}
      onError={(error) => {
        telemetry.trackError("job_creation_render_error", error);
      }}
    >
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Create New Job
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fill in the details below to create a new job posting
          </p>
        </header>

        <main>
          <JobForm
            initialData={initialJobData}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            mode="create"
          />
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default CreateJobPage;