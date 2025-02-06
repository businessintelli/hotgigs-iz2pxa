import { useState, useCallback } from "react"; // ^18.0.0
import { z } from "zod"; // ^3.22.0
import { debounce } from "../utils";

// Form state interface for managing values, errors, and metadata
interface FormState<T extends Record<string, any>> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

// Configuration options for form validation behavior
interface ValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

// Default validation options
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  validateOnChange: true,
  validateOnBlur: true,
  debounceMs: 300,
};

/**
 * Custom hook for form handling with Zod schema validation
 * @param schema - Zod schema for form validation
 * @param initialValues - Initial form values
 * @param onSubmit - Form submission handler
 * @param options - Validation configuration options
 */
export function useForm<T extends Record<string, any>>(
  schema: z.Schema<T>,
  initialValues: T,
  onSubmit: (values: T) => Promise<void> | void,
  options: ValidationOptions = DEFAULT_VALIDATION_OPTIONS
) {
  // Merge options with defaults
  const validationOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

  // Initialize form state
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
    isDirty: false,
  });

  /**
   * Validates a single field
   */
  const validateField = useCallback(
    (name: keyof T, value: any): string => {
      try {
        // Create a partial schema for the field
        const fieldSchema = z.object({ [name]: schema.shape[name] });
        fieldSchema.parse({ [name]: value });
        return "";
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.errors.find((e) => e.path[0] === name);
          return fieldError?.message || "";
        }
        return "";
      }
    },
    [schema]
  );

  /**
   * Validates the entire form
   */
  const validateForm = useCallback(
    (values: T): Record<string, string> => {
      try {
        schema.parse(values);
        return {};
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors.reduce(
            (acc, curr) => ({
              ...acc,
              [curr.path[0]]: curr.message,
            }),
            {}
          );
        }
        return {};
      }
    },
    [schema]
  );

  /**
   * Debounced field validation
   */
  const debouncedValidateField = useCallback(
    debounce((name: keyof T, value: any) => {
      const error = validateField(name, value);
      setFormState((prev) => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error,
        },
        isValid: Object.values({ ...prev.errors, [name]: error }).every(
          (e) => !e
        ),
      }));
    }, validationOptions.debounceMs || 0),
    [validateField, validationOptions.debounceMs]
  );

  /**
   * Handles field change events
   */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = event.target;
      const fieldValue = type === "checkbox" ? (event.target as HTMLInputElement).checked : value;

      setFormState((prev) => ({
        ...prev,
        values: {
          ...prev.values,
          [name]: fieldValue,
        },
        isDirty: true,
      }));

      if (validationOptions.validateOnChange) {
        debouncedValidateField(name, fieldValue);
      }
    },
    [debouncedValidateField, validationOptions.validateOnChange]
  );

  /**
   * Handles field blur events
   */
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name } = event.target;

      setFormState((prev) => ({
        ...prev,
        touched: {
          ...prev.touched,
          [name]: true,
        },
      }));

      if (validationOptions.validateOnBlur) {
        const error = validateField(name, formState.values[name]);
        setFormState((prev) => ({
          ...prev,
          errors: {
            ...prev.errors,
            [name]: error,
          },
          isValid: Object.values({ ...prev.errors, [name]: error }).every(
            (e) => !e
          ),
        }));
      }
    },
    [formState.values, validateField, validationOptions.validateOnBlur]
  );

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      if (event) {
        event.preventDefault();
      }

      const errors = validateForm(formState.values);
      const hasErrors = Object.keys(errors).length > 0;

      setFormState((prev) => ({
        ...prev,
        errors,
        isValid: !hasErrors,
        touched: Object.keys(prev.values).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {}
        ),
      }));

      if (!hasErrors) {
        setFormState((prev) => ({ ...prev, isSubmitting: true }));
        try {
          await onSubmit(formState.values);
        } finally {
          setFormState((prev) => ({ ...prev, isSubmitting: false }));
        }
      }
    },
    [formState.values, onSubmit, validateForm]
  );

  /**
   * Resets the form to initial values
   */
  const resetForm = useCallback(() => {
    setFormState({
      values: initialValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false,
    });
  }, [initialValues]);

  /**
   * Sets a field value programmatically
   */
  const setFieldValue = useCallback(
    (name: keyof T, value: any) => {
      setFormState((prev) => ({
        ...prev,
        values: {
          ...prev.values,
          [name]: value,
        },
        isDirty: true,
      }));

      if (validationOptions.validateOnChange) {
        debouncedValidateField(name, value);
      }
    },
    [debouncedValidateField, validationOptions.validateOnChange]
  );

  /**
   * Sets a field's touched state programmatically
   */
  const setFieldTouched = useCallback((name: keyof T, touched: boolean = true) => {
    setFormState((prev) => ({
      ...prev,
      touched: {
        ...prev.touched,
        [name]: touched,
      },
    }));
  }, []);

  return {
    formState,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm,
  };
}

export default useForm;