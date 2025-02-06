import * as React from "react" // ^18.0.0
import { useForm, Controller } from "react-hook-form" // ^7.0.0
import { z } from "zod" // ^3.22.0
import { RadioGroup, RadioGroupItem } from "../ui/radio"
import Textarea from "../ui/textarea"
import { FeedbackRating, type InterviewFeedback, type SkillAssessment } from "../../types/interviews"
import { cn, debounce } from "../../lib/utils"

// Props interface for the InterviewFeedback component
interface InterviewFeedbackProps {
  interview_id: string
  interviewer_id: string
  onSubmit: (feedback: InterviewFeedback) => Promise<void>
  initialFeedback?: Partial<InterviewFeedback>
  isLoading?: boolean
  isDisabled?: boolean
}

// Zod schema for form validation
const feedbackFormSchema = z.object({
  overall_rating: z.nativeEnum(FeedbackRating),
  skill_ratings: z.array(z.object({
    skill_name: z.string().min(1, "Skill name is required"),
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
    comments: z.string().min(1, "Comments are required")
  })),
  strengths: z.string().min(10, "Please provide detailed strengths"),
  weaknesses: z.string().min(10, "Please provide detailed areas for improvement"),
  notes: z.string().min(10, "Additional notes are required"),
  hire_recommendation: z.boolean(),
  recommendation_reason: z.string().min(20, "Please provide detailed reasoning for your recommendation")
})

type FeedbackFormData = z.infer<typeof feedbackFormSchema>

const RATING_LABELS: Record<FeedbackRating, string> = {
  [FeedbackRating.STRONG_YES]: "Strong Yes - Exceptional candidate",
  [FeedbackRating.YES]: "Yes - Good fit",
  [FeedbackRating.MAYBE]: "Maybe - Some concerns",
  [FeedbackRating.NO]: "No - Not a good fit",
  [FeedbackRating.STRONG_NO]: "Strong No - Significant concerns"
}

export const InterviewFeedback: React.FC<InterviewFeedbackProps> = ({
  interview_id,
  interviewer_id,
  onSubmit,
  initialFeedback,
  isLoading = false,
  isDisabled = false
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    watch
  } = useForm<FeedbackFormData>({
    resolver: async (data) => {
      try {
        await feedbackFormSchema.parseAsync(data)
        return { values: data, errors: {} }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = error.errors.reduce((acc, curr) => {
            const path = curr.path.join(".")
            acc[path] = { message: curr.message, type: "validation" }
            return acc
          }, {} as Record<string, { message: string; type: string }>)
          return { values: {}, errors: formattedErrors }
        }
        return { values: {}, errors: { root: { message: "Validation failed", type: "validation" } } }
      }
    },
    defaultValues: {
      overall_rating: initialFeedback?.overall_rating || FeedbackRating.MAYBE,
      skill_ratings: initialFeedback?.skill_ratings || [],
      strengths: initialFeedback?.strengths || "",
      weaknesses: initialFeedback?.weaknesses || "",
      notes: initialFeedback?.notes || "",
      hire_recommendation: initialFeedback?.hire_recommendation || false,
      recommendation_reason: ""
    }
  })

  const debouncedAutoSave = React.useMemo(
    () => debounce(async (data: FeedbackFormData) => {
      try {
        const validatedData = await feedbackFormSchema.parseAsync(data)
        localStorage.setItem(
          `interview_feedback_draft_${interview_id}`,
          JSON.stringify(validatedData)
        )
      } catch (error) {
        console.error("Auto-save validation failed:", error)
      }
    }, 1000),
    [interview_id]
  )

  React.useEffect(() => {
    const subscription = watch((data) => {
      if (isDirty) {
        debouncedAutoSave(data as FeedbackFormData)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, isDirty, debouncedAutoSave])

  const onFormSubmit = async (data: FeedbackFormData) => {
    try {
      await onSubmit({
        interview_id,
        interviewer_id,
        overall_rating: data.overall_rating,
        skill_ratings: data.skill_ratings,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        notes: data.notes,
        hire_recommendation: data.hire_recommendation
      })
      reset(data)
      localStorage.removeItem(`interview_feedback_draft_${interview_id}`)
    } catch (error) {
      console.error("Feedback submission failed:", error)
      throw error
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-6"
      aria-label="Interview feedback form"
    >
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Overall Assessment</h3>
        <Controller
          name="overall_rating"
          control={control}
          render={({ field }) => (
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="space-y-2"
              disabled={isDisabled || isLoading}
            >
              {Object.entries(RATING_LABELS).map(([rating, label]) => (
                <div key={rating} className="flex items-center space-x-2">
                  <RadioGroupItem value={rating} id={`rating-${rating}`} />
                  <label
                    htmlFor={`rating-${rating}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        {errors.overall_rating && (
          <p className="text-sm text-destructive">{errors.overall_rating.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Detailed Assessment</h3>
        
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Key Strengths</span>
            <Controller
              name="strengths"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  className="mt-1"
                  placeholder="Describe the candidate's key strengths..."
                  error={!!errors.strengths}
                  disabled={isDisabled || isLoading}
                />
              )}
            />
            {errors.strengths && (
              <p className="mt-1 text-sm text-destructive">{errors.strengths.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Areas for Improvement</span>
            <Controller
              name="weaknesses"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  className="mt-1"
                  placeholder="Describe areas where the candidate could improve..."
                  error={!!errors.weaknesses}
                  disabled={isDisabled || isLoading}
                />
              )}
            />
            {errors.weaknesses && (
              <p className="mt-1 text-sm text-destructive">{errors.weaknesses.message}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium">Additional Notes</span>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  className="mt-1"
                  placeholder="Any additional observations or comments..."
                  error={!!errors.notes}
                  disabled={isDisabled || isLoading}
                />
              )}
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-destructive">{errors.notes.message}</p>
            )}
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Hiring Recommendation</h3>
        <Controller
          name="hire_recommendation"
          control={control}
          render={({ field }) => (
            <div className="space-y-2">
              <RadioGroup
                onValueChange={(value) => field.onChange(value === "true")}
                value={field.value.toString()}
                disabled={isDisabled || isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="recommend-yes" />
                  <label
                    htmlFor="recommend-yes"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Recommend to Hire
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="recommend-no" />
                  <label
                    htmlFor="recommend-no"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Do Not Recommend
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}
        />

        <Controller
          name="recommendation_reason"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              className="mt-2"
              placeholder="Please provide detailed reasoning for your recommendation..."
              error={!!errors.recommendation_reason}
              disabled={isDisabled || isLoading}
            />
          )}
        />
        {errors.recommendation_reason && (
          <p className="text-sm text-destructive">{errors.recommendation_reason.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => reset()}
          className={cn(
            "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            (isDisabled || isLoading) && "opacity-50 cursor-not-allowed"
          )}
          disabled={isDisabled || isLoading}
        >
          Reset
        </button>
        <button
          type="submit"
          className={cn(
            "px-4 py-2 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            (isDisabled || isLoading || isSubmitting) && "opacity-50 cursor-not-allowed"
          )}
          disabled={isDisabled || isLoading || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </form>
  )
}

export default InterviewFeedback