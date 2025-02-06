import * as React from "react"; // ^18.0.0
import { z } from "zod"; // ^3.22.0
import DOMPurify from "isomorphic-dompurify"; // ^1.1.0
import { analytics } from "@segment/analytics-next"; // ^1.51.0
import Input from "../ui/input";
import useForm from "../../lib/hooks/useForm";
import { createCandidate, updateCandidate } from "../../lib/api/candidates";
import { FILE_UPLOAD } from "../../config/constants";
import { 
  Candidate,
  CandidateFormData,
  CandidateStatus,
  candidateSchema,
  WorkExperience,
  Education,
  CandidatePreferences 
} from "../../types/candidates";
import { debounce, formatFileSize } from "../../lib/utils";

// Enhanced validation schema with custom rules
const enhancedCandidateSchema = candidateSchema.extend({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format"),
  phone: z.string().regex(/^\+?[\d\s-()]{10,}$/, "Invalid phone number format"),
  resume_url: z.string().url().optional(),
});

interface CandidateFormProps {
  initialData?: Partial<CandidateFormData>;
  onSubmit: (data: CandidateFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  autoSave?: boolean;
  validationRules?: Record<string, (value: any) => string | undefined>;
}

export const CandidateForm: React.FC<CandidateFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  autoSave = false,
  validationRules
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);

  // Initialize form with default values
  const defaultValues: CandidateFormData = {
    full_name: "",
    email: "",
    phone: "",
    location: "",
    status: CandidateStatus.ACTIVE,
    experience_level: "",
    skills: [],
    experience: [],
    education: [],
    resume_url: "",
    preferences: {
      preferred_job_types: [],
      preferred_locations: [],
      remote_only: false,
      salary_expectation_min: 0,
      salary_expectation_max: 0,
      open_to_relocation: false,
      preferred_industries: [],
      industry_experience: [],
      notice_period_days: 30,
      travel_willingness: "",
      work_authorization: "",
      preferred_company_sizes: [],
      preferred_work_schedule: "",
      willing_to_travel: false
    },
    certifications: [],
    languages: [],
    social_profiles: {},
    summary: "",
    last_active: new Date(),
    profile_complete: false,
    ...initialData
  };

  const {
    formState,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm
  } = useForm<CandidateFormData>(
    enhancedCandidateSchema,
    defaultValues,
    async (values) => {
      try {
        // Sanitize input data
        const sanitizedData = {
          ...values,
          summary: DOMPurify.sanitize(values.summary),
          experience: values.experience.map(exp => ({
            ...exp,
            description: DOMPurify.sanitize(exp.description)
          }))
        };

        // Handle file upload if present
        if (resumeFile) {
          const uploadedUrl = await handleFileUpload(resumeFile);
          sanitizedData.resume_url = uploadedUrl;
        }

        // Track form submission
        analytics.track("candidate_form_submitted", {
          isUpdate: !!initialData,
          fieldsCompleted: Object.keys(formState.touched).length
        });

        await onSubmit(sanitizedData);
      } catch (error) {
        console.error("Form submission error:", error);
        analytics.track("candidate_form_error", {
          error: error.message
        });
        throw error;
      }
    },
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300
    }
  );

  // Handle file upload with progress tracking
  const handleFileUpload = async (file: File): Promise<string> => {
    if (file.size > FILE_UPLOAD.MAX_SIZE) {
      throw new Error(`File size exceeds ${formatFileSize(FILE_UPLOAD.MAX_SIZE)} limit`);
    }

    if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a PDF, DOC, DOCX, or RTF file.");
    }

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/json",
        },
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          setUploadProgress(Math.round(progress));
        }
      });

      if (!response.ok) {
        throw new Error("Resume upload failed");
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error("File upload error:", error);
      analytics.track("resume_upload_error", {
        error: error.message
      });
      throw error;
    }
  };

  // Handle file input change
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setFieldValue("resume_url", "pending");
    }
  };

  // Auto-save functionality
  React.useEffect(() => {
    if (autoSave && formState.isDirty) {
      const saveForm = debounce(async () => {
        try {
          await handleSubmit();
        } catch (error) {
          console.error("Auto-save error:", error);
        }
      }, 2000);

      saveForm();
    }
  }, [formState.values, autoSave]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
      noValidate
    >
      {/* Basic Information */}
      <div className="space-y-4">
        <Input
          id="full_name"
          name="full_name"
          type="text"
          label="Full Name"
          value={formState.values.full_name}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.full_name}
          disabled={isLoading}
          required
          aria-required="true"
          aria-invalid={!!formState.errors.full_name}
          aria-describedby="full_name-error"
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          value={formState.values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.email}
          disabled={isLoading}
          required
          aria-required="true"
          aria-invalid={!!formState.errors.email}
          aria-describedby="email-error"
        />

        <Input
          id="phone"
          name="phone"
          type="tel"
          label="Phone Number"
          value={formState.values.phone}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.phone}
          disabled={isLoading}
          aria-invalid={!!formState.errors.phone}
          aria-describedby="phone-error"
        />

        {/* Resume Upload */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_UPLOAD.ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload Resume"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Upload Resume
          </button>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${uploadProgress}%` }}
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}
        </div>

        {/* Form submission buttons */}
        <div className="flex justify-end space-x-4 mt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !formState.isValid}
          >
            {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CandidateForm;