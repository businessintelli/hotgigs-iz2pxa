"use client"

import * as React from "react" // ^18.0.0
import { useDropzone } from "react-dropzone" // ^14.0.0
import { Button } from "../ui/button"
import Input from "../ui/input"
import { cn, formatFileSize } from "../../lib/utils"
import { FILE_UPLOAD } from "../../config/constants"

// Interface for component props
interface FileUploadProps {
  acceptedFileTypes?: string[]
  maxSize?: number
  multiple?: boolean
  onFileSelect: (files: File[]) => void
  onError: (errors: string[]) => void
  className?: string
  disabled?: boolean
  uploadProgress?: number
  showPreview?: boolean
}

// File validation function
const validateFile = (
  file: File,
  acceptedTypes: string[],
  maxSize: number
): { isValid: boolean; error?: string } => {
  // Check file type
  if (!acceptedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Accepted types: ${acceptedTypes.join(", ")}`
    }
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds ${formatFileSize(maxSize)} limit`
    }
  }

  // Check filename length
  if (file.name.length > FILE_UPLOAD.MAX_FILENAME_LENGTH) {
    return {
      isValid: false,
      error: `Filename exceeds ${FILE_UPLOAD.MAX_FILENAME_LENGTH} characters`
    }
  }

  return { isValid: true }
}

// Main FileUpload component
export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      acceptedFileTypes = FILE_UPLOAD.ALLOWED_TYPES,
      maxSize = FILE_UPLOAD.MAX_SIZE,
      multiple = false,
      onFileSelect,
      onError,
      className,
      disabled = false,
      uploadProgress,
      showPreview = false
    },
    ref
  ) => {
    const [preview, setPreview] = React.useState<string[]>([])
    const [isDragActive, setIsDragActive] = React.useState(false)

    // Handle file drop
    const handleDrop = React.useCallback(
      (acceptedFiles: File[]) => {
        const validFiles: File[] = []
        const errors: string[] = []

        acceptedFiles.forEach((file) => {
          const validation = validateFile(file, acceptedFileTypes, maxSize)
          if (validation.isValid) {
            validFiles.push(file)
          } else if (validation.error) {
            errors.push(`${file.name}: ${validation.error}`)
          }
        })

        if (errors.length > 0) {
          onError(errors)
        }

        if (validFiles.length > 0) {
          // Generate previews if enabled
          if (showPreview) {
            const newPreviews = validFiles.map((file) =>
              URL.createObjectURL(file)
            )
            setPreview((prev) => [...prev, ...newPreviews])
          }

          onFileSelect(validFiles)
        }
      },
      [acceptedFileTypes, maxSize, onFileSelect, onError, showPreview]
    )

    // Cleanup previews on unmount
    React.useEffect(() => {
      return () => {
        preview.forEach((url) => URL.revokeObjectURL(url))
      }
    }, [preview])

    // Configure dropzone
    const {
      getRootProps,
      getInputProps,
      isDragAccept,
      isDragReject,
      open
    } = useDropzone({
      onDrop: handleDrop,
      accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
      maxSize,
      multiple,
      disabled,
      noClick: true,
      onDragEnter: () => setIsDragActive(true),
      onDragLeave: () => setIsDragActive(false)
    })

    // Progress bar component
    const ProgressBar = () => (
      <div
        className="h-2 w-full bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={uploadProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>
    )

    return (
      <div
        ref={ref}
        {...getRootProps()}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragActive && "border-primary bg-primary/5",
          isDragReject && "border-destructive bg-destructive/5",
          isDragAccept && "border-success bg-success/5",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <Input
          {...getInputProps()}
          type="file"
          accept={acceptedFileTypes.join(",")}
          aria-label="File upload input"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            className="h-12 w-12 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Drag and drop your {multiple ? "files" : "file"} here, or
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={open}
              disabled={disabled}
              aria-label="Choose files"
            >
              Choose {multiple ? "Files" : "File"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Accepted types: {acceptedFileTypes.join(", ")}
              <br />
              Maximum size: {formatFileSize(maxSize)}
            </p>
          </div>
        </div>

        {uploadProgress !== undefined && <ProgressBar />}

        {showPreview && preview.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {preview.map((url, index) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg border bg-background"
              >
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="h-full w-full object-cover rounded-lg"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

FileUpload.displayName = "FileUpload"

export default FileUpload