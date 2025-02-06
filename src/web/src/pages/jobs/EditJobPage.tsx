import React from "react"; // ^18.0.0
import { useParams, useNavigate } from "react-router-dom"; // ^6.0.0
import JobForm, { JobFormData } from "../../components/jobs/JobForm";
import { useToast } from "../../lib/hooks/useToast";
import { jobsApi } from "../../lib/api/jobs";

// Constants for page configuration
const PAGE_TITLE = "Edit Job Posting - HotGigs";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * EditJobPage component for managing job posting updates
 * Implements comprehensive form validation and error handling
 */
const EditJobPage: React.FC = () => {
  // URL parameter handling with type safety
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  // Component state management
  const [isLoading, setIsLoading] = React.useState(false);
  const [jobData, setJobData] = React.useState<JobFormData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Fetch job data with retry logic
  const fetchJobData = React.useCallback(async () => {
    if (!jobId) {
      toast.error({
        title: "Invalid Job ID",
        description: "Unable to load job details. Please try again."
      });
      navigate("/jobs");
      return;
    }

    setIsLoading(true);
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        const { data, error } = await jobsApi.getJob(jobId);
        
        if (error) throw error;
        if (!data) throw new Error("Job not found");

        setJobData({
          title: data.title,
          description: data.description,
          requirements: data.requirements,
          type: data.type,
          salary_min: data.salary_min,
          salary_max: data.salary_max,
          location: data.location,
          remote_allowed: data.remote_allowed,
          department: data.department,
          benefits: data.benefits,
          is_draft: data.status === "DRAFT"
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === MAX_RETRIES) {
          toast.error({
            title: "Error Loading Job",
            description: "Failed to load job details. Please try again later."
          });
          navigate("/jobs");
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      }
    }

    setIsLoading(false);
  }, [jobId, navigate, toast]);

  // Handle form submission with validation
  const handleSubmit = React.useCallback(async (formData: JobFormData) => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const { error } = await jobsApi.updateJob(jobId, {
        ...formData,
        status_transition: {
          from: formData.is_draft ? "DRAFT" : "PUBLISHED",
          to: formData.is_draft ? "DRAFT" : "PUBLISHED"
        },
        audit: {
          updated_by: "current_user", // Replace with actual user ID
          reason: "Job posting update",
          timestamp: new Date()
        }
      });

      if (error) throw error;

      toast.success({
        title: "Job Updated",
        description: "Job posting has been successfully updated.",
        duration: 5000
      });

      setHasUnsavedChanges(false);
      navigate("/jobs");
    } catch (error) {
      toast.error({
        title: "Update Failed",
        description: "Failed to update job posting. Please try again.",
        duration: 7000
      });
    } finally {
      setIsLoading(false);
    }
  }, [jobId, navigate, toast]);

  // Initialize page data
  React.useEffect(() => {
    document.title = PAGE_TITLE;
    fetchJobData();

    // Handle unsaved changes warning
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [fetchJobData, hasUnsavedChanges]);

  // Handle form change tracking
  const handleFormChange = React.useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  if (!jobData && isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-label="Loading job details"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit Job Posting
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Update the job details and requirements below
        </p>
      </div>

      {jobData && (
        <JobForm
          initialData={jobData}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          mode="edit"
          onChange={handleFormChange}
        />
      )}
    </div>
  );
};

export default EditJobPage;