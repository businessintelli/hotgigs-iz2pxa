import * as React from "react"; // ^18.0.0
import { z } from "zod"; // ^3.22.0
import DOMPurify from "dompurify"; // ^3.0.0
import Input from "../ui/input";
import useForm from "../../lib/hooks/useForm";
import { cn } from "../../lib/utils";

// Hotlist visibility options
enum HotlistVisibility {
  PRIVATE = "private",
  TEAM = "team",
  PUBLIC = "public"
}

// Enhanced Zod schema for hotlist validation with security measures
const hotlistSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Name can only contain letters, numbers, spaces, hyphens, and underscores")
    .transform((val) => DOMPurify.sanitize(val.trim())),
  
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .transform((val) => val ? DOMPurify.sanitize(val.trim()) : val),
  
  visibility: z.nativeEnum(HotlistVisibility, {
    errorMap: () => ({ message: "Invalid visibility option" })
  }),
  
  tags: z
    .array(
      z.string()
        .max(30, "Tag cannot exceed 30 characters")
        .regex(/^[a-zA-Z0-9\-_]+$/, "Tags can only contain letters, numbers, hyphens, and underscores")
    )
    .max(10, "Cannot have more than 10 tags")
    .optional()
    .transform((val) => val?.map((tag) => DOMPurify.sanitize(tag.trim().toLowerCase())))
});

// Type for form data based on schema
type HotlistFormData = z.infer<typeof hotlistSchema>;

// Interface for component props
interface HotlistFormProps {
  initialData?: Partial<HotlistFormData>;
  onSubmit: (data: HotlistFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  csrfToken: string;
}

export const HotlistForm: React.FC<HotlistFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  csrfToken
}) => {
  // Initialize form with default values
  const defaultValues: HotlistFormData = {
    name: "",
    description: "",
    visibility: HotlistVisibility.PRIVATE,
    tags: [],
    ...initialData
  };

  // Initialize form with validation and submission handling
  const {
    formState: { values, errors, touched, isValid, isDirty },
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue
  } = useForm<HotlistFormData>(
    hotlistSchema,
    defaultValues,
    async (data) => {
      await onSubmit(data);
    },
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300
    }
  );

  // Handle tag input
  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      if (newTag && values.tags && values.tags.length < 10) {
        setFieldValue("tags", [...(values.tags || []), newTag]);
        e.currentTarget.value = "";
      }
    }
  };

  // Remove tag handler
  const handleRemoveTag = (tagToRemove: string) => {
    setFieldValue(
      "tags",
      values.tags?.filter((tag) => tag !== tagToRemove)
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      aria-label="Hotlist form"
      noValidate
    >
      {/* CSRF Protection */}
      <input type="hidden" name="_csrf" value={csrfToken} />

      {/* Name Field */}
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          value={values.name}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.name ? errors.name : undefined}
          disabled={isSubmitting}
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={cn(
            errors.name && touched.name && "border-red-500 focus:ring-red-500"
          )}
        />
        {errors.name && touched.name && (
          <p id="name-error" className="text-sm text-red-500">
            {errors.name}
          </p>
        )}
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={values.description}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          className={cn(
            "w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            errors.description && touched.description && "border-red-500 focus:ring-red-500"
          )}
        />
        {errors.description && touched.description && (
          <p id="description-error" className="text-sm text-red-500">
            {errors.description}
          </p>
        )}
      </div>

      {/* Visibility Field */}
      <div className="space-y-2">
        <label
          htmlFor="visibility"
          className="block text-sm font-medium text-gray-700"
        >
          Visibility <span className="text-red-500">*</span>
        </label>
        <select
          id="visibility"
          name="visibility"
          value={values.visibility}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          aria-required="true"
          aria-invalid={!!errors.visibility}
          aria-describedby={errors.visibility ? "visibility-error" : undefined}
          className={cn(
            "w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            errors.visibility && touched.visibility && "border-red-500 focus:ring-red-500"
          )}
        >
          <option value={HotlistVisibility.PRIVATE}>Private</option>
          <option value={HotlistVisibility.TEAM}>Team</option>
          <option value={HotlistVisibility.PUBLIC}>Public</option>
        </select>
        {errors.visibility && touched.visibility && (
          <p id="visibility-error" className="text-sm text-red-500">
            {errors.visibility}
          </p>
        )}
      </div>

      {/* Tags Field */}
      <div className="space-y-2">
        <label
          htmlFor="tags"
          className="block text-sm font-medium text-gray-700"
        >
          Tags
        </label>
        <Input
          id="tags"
          type="text"
          placeholder="Press Enter to add tags"
          onKeyDown={handleTagInput}
          disabled={isSubmitting || (values.tags?.length || 0) >= 10}
          aria-describedby="tags-help"
        />
        <p id="tags-help" className="text-sm text-gray-500">
          Add up to 10 tags to categorize your hotlist
        </p>
        <div className="flex flex-wrap gap-2">
          {values.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-2 text-blue-600 hover:text-blue-800"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isValid || !isDirty}
          className={cn(
            "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white",
            "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            (isSubmitting || !isValid || !isDirty) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isSubmitting ? "Saving..." : "Save Hotlist"}
        </button>
      </div>
    </form>
  );
};

export default HotlistForm;