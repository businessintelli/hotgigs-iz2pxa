import React from "react"; // ^18.0.0
import { z } from "zod"; // ^3.22.0
import { debounce } from "lodash/debounce"; // ^4.0.8
import { Editor } from "@tiptap/react"; // ^2.0.0

import { useForm } from "../../lib/hooks/useForm";
import Input from "../ui/input";
import Select from "../ui/select";
import { JobFormData, JobType, ExperienceLevel } from "../../types/jobs";

// Job form validation schema
const jobFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(1, "Description is required"),
  requirements: z.object({
    experience_level: z.nativeEnum(ExperienceLevel, {
      errorMap: () => ({ message: "Please select an experience level" })
    }),
    years_experience: z.number().min(0, "Years of experience must be positive"),
    required_skills: z.array(z.string()).min(1, "At least one required skill is needed"),
    preferred_skills: z.array(z.string()),
    qualifications: z.array(z.string()),
    responsibilities: z.array(z.string()),
    certifications: z.array(z.string()),
    education_requirements: z.array(z.string()),
    languages: z.array(z.string()),
    background_check_required: z.boolean(),
    tools_and_technologies: z.array(z.string())
  }),
  type: z.nativeEnum(JobType, {
    errorMap: () => ({ message: "Please select a job type" })
  }),
  salary_min: z.number().min(0, "Minimum salary must be positive"),
  salary_max: z.number().min(0, "Maximum salary must be positive")
    .refine(val => val > z.number().parse(z.any().parse(this).salary_min), {
      message: "Maximum salary must be greater than minimum salary"
    }),
  location: z.string().min(1, "Location is required"),
  remote_allowed: z.boolean(),
  department: z.string().min(1, "Department is required"),
  benefits: z.array(z.string()),
  is_draft: z.boolean()
});

interface JobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: JobFormData) => Promise<void>;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

const EXPERIENCE_LEVELS = Object.values(ExperienceLevel).map(level => ({
  value: level,
  label: level.replace("_", " ").toLowerCase()
}));

const JOB_TYPES = Object.values(JobType).map(type => ({
  value: type,
  label: type.replace("_", " ").toLowerCase()
}));

const JobForm: React.FC<JobFormProps> = ({
  initialData = {},
  onSubmit,
  isLoading = false,
  mode = "create"
}) => {
  const {
    formState,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldTouched
  } = useForm<JobFormData>(
    jobFormSchema,
    {
      title: "",
      description: "",
      requirements: {
        experience_level: ExperienceLevel.ENTRY,
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
      type: JobType.FULL_TIME,
      salary_min: 0,
      salary_max: 0,
      location: "",
      remote_allowed: false,
      department: "",
      benefits: [],
      is_draft: true,
      ...initialData
    },
    onSubmit,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300
    }
  );

  const editor = React.useRef<Editor | null>(null);

  const handleEditorChange = React.useCallback(
    debounce(({ editor }: { editor: Editor }) => {
      setFieldValue("description", editor.getText());
    }, 300),
    [setFieldValue]
  );

  const handleSkillsChange = React.useCallback(
    (skills: string[]) => {
      setFieldValue("requirements.required_skills", skills);
    },
    [setFieldValue]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          id="title"
          name="title"
          label="Job Title"
          placeholder="Enter job title"
          value={formState.values.title}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.title}
          disabled={isLoading}
          required
          aria-label="Job title"
          maxLength={200}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            id="type"
            name="type"
            label="Job Type"
            value={formState.values.type}
            options={JOB_TYPES}
            onChange={(value) => setFieldValue("type", value as JobType)}
            onBlur={handleBlur}
            error={formState.errors.type}
            disabled={isLoading}
            required
          />

          <Select
            id="experience_level"
            name="requirements.experience_level"
            label="Experience Level"
            value={formState.values.requirements.experience_level}
            options={EXPERIENCE_LEVELS}
            onChange={(value) => setFieldValue("requirements.experience_level", value as ExperienceLevel)}
            onBlur={handleBlur}
            error={formState.errors.requirements?.experience_level}
            disabled={isLoading}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="salary_min"
            name="salary_min"
            type="number"
            label="Minimum Salary"
            placeholder="Enter minimum salary"
            value={formState.values.salary_min}
            onChange={handleChange}
            onBlur={handleBlur}
            error={formState.errors.salary_min}
            disabled={isLoading}
            required
            min={0}
          />

          <Input
            id="salary_max"
            name="salary_max"
            type="number"
            label="Maximum Salary"
            placeholder="Enter maximum salary"
            value={formState.values.salary_max}
            onChange={handleChange}
            onBlur={handleBlur}
            error={formState.errors.salary_max}
            disabled={isLoading}
            required
            min={0}
          />
        </div>

        <Input
          id="location"
          name="location"
          label="Location"
          placeholder="Enter job location"
          value={formState.values.location}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.location}
          disabled={isLoading}
          required
        />

        <div className="flex items-center space-x-2">
          <input
            id="remote_allowed"
            name="remote_allowed"
            type="checkbox"
            checked={formState.values.remote_allowed}
            onChange={handleChange}
            disabled={isLoading}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="remote_allowed" className="text-sm font-medium">
            Remote Work Allowed
          </label>
        </div>

        <Input
          id="department"
          name="department"
          label="Department"
          placeholder="Enter department"
          value={formState.values.department}
          onChange={handleChange}
          onBlur={handleBlur}
          error={formState.errors.department}
          disabled={isLoading}
          required
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium">Job Description</label>
          <Editor
            ref={editor}
            content={formState.values.description}
            onChange={handleEditorChange}
            disabled={isLoading}
          />
          {formState.errors.description && (
            <p className="text-sm text-destructive">{formState.errors.description}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => setFieldValue("is_draft", true)}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Save as Draft
        </button>
        <button
          type="submit"
          disabled={isLoading || !formState.isValid}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : mode === "create" ? "Create Job" : "Update Job"}
        </button>
      </div>
    </form>
  );
};

export default JobForm;