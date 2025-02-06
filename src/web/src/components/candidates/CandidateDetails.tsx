import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom'; // ^6.0.0
import { toast } from 'sonner'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import {
  Candidate,
  CandidateStatus,
  WorkExperience,
  Education
} from '../../types/candidates';
import { useCandidates } from '../../lib/hooks/useCandidates';

// Component Props
interface CandidateDetailsProps {
  initialData?: Candidate;
  onUpdate?: (candidate: Candidate) => void;
  onError?: (error: Error) => void;
}

// Custom hook for managing candidate details state
function useCandidateDetails(candidateId: string) {
  const {
    updateCandidate,
    deleteCandidate,
    subscribeToUpdates
  } = useCandidates();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscription = subscribeToUpdates(candidateId, {
      onData: (updatedCandidate) => {
        setCandidate(updatedCandidate);
      },
      onError: (err) => {
        setError(err);
        toast.error('Failed to receive real-time updates');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [candidateId, subscribeToUpdates]);

  const handleUpdate = async (updates: Partial<Candidate>) => {
    try {
      setIsLoading(true);
      const updated = await updateCandidate(candidateId, updates);
      setCandidate(updated);
      toast.success('Candidate details updated successfully');
    } catch (err) {
      setError(err as Error);
      toast.error('Failed to update candidate details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      await deleteCandidate(candidateId);
      toast.success('Candidate deleted successfully');
    } catch (err) {
      setError(err as Error);
      toast.error('Failed to delete candidate');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    candidate,
    isLoading,
    error,
    handleUpdate,
    handleDelete
  };
}

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-md">
    <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
    <p className="text-red-600">{error.message}</p>
  </div>
);

// Main Component
export const CandidateDetails: React.FC<CandidateDetailsProps> = ({
  initialData,
  onUpdate,
  onError
}) => {
  const { id } = useParams<{ id: string }>();
  const {
    candidate,
    isLoading,
    error,
    handleUpdate,
    handleDelete
  } = useCandidateDetails(id!);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  if (isLoading) {
    return (
      <div role="status" className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!candidate && !initialData) {
    return (
      <div role="alert" className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-700">No candidate data available</p>
      </div>
    );
  }

  const data = candidate || initialData!;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="space-y-6" role="region" aria-label="Candidate Details">
        {/* Personal Information Section */}
        <section aria-labelledby="personal-info-heading">
          <h2 id="personal-info-heading" className="text-2xl font-bold mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <p className="mt-1 text-lg">{data.full_name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-lg">{data.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                data.status === CandidateStatus.ACTIVE ? 'bg-green-100 text-green-800' :
                data.status === CandidateStatus.PASSIVE ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {data.status}
              </span>
            </div>
          </div>
        </section>

        {/* Work Experience Section */}
        <section aria-labelledby="experience-heading">
          <h2 id="experience-heading" className="text-2xl font-bold mb-4">
            Work Experience
          </h2>
          <div className="space-y-4">
            {data.experience.map((exp: WorkExperience, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold">{exp.title}</h3>
                <p className="text-gray-600">{exp.company}</p>
                <p className="text-sm text-gray-500">
                  {new Date(exp.start_date).toLocaleDateString()} - 
                  {exp.end_date ? new Date(exp.end_date).toLocaleDateString() : 'Present'}
                </p>
                <p className="mt-2">{exp.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {exp.skills_used.map((skill, skillIndex) => (
                    <span key={skillIndex} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Education Section */}
        <section aria-labelledby="education-heading">
          <h2 id="education-heading" className="text-2xl font-bold mb-4">
            Education
          </h2>
          <div className="space-y-4">
            {data.education.map((edu: Education, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold">{edu.degree}</h3>
                <p className="text-gray-600">{edu.institution}</p>
                <p className="text-sm text-gray-500">
                  {new Date(edu.start_date).toLocaleDateString()} - 
                  {new Date(edu.end_date).toLocaleDateString()}
                </p>
                <p className="mt-2">{edu.field_of_study}</p>
                {edu.gpa && (
                  <p className="text-sm text-gray-600">GPA: {edu.gpa}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Skills Section */}
        <section aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="text-2xl font-bold mb-4">
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((skill, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => handleDelete()}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Delete candidate"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              // Example update
              handleUpdate({ status: CandidateStatus.ACTIVE });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Update candidate status"
          >
            Update Status
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CandidateDetails;