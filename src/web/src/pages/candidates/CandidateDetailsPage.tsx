import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // ^6.0.0
import { toast } from 'sonner'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import CandidateDetails from '../../components/candidates/CandidateDetails';
import PageHeader from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { useCandidates } from '../../lib/hooks/useCandidates';
import { Candidate, CandidateStatus } from '../../types/candidates';
import { formatDate } from '../../lib/utils';

// Error Fallback Component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-md">
    <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
    <p className="text-red-600">{error.message}</p>
    <Button 
      variant="outline" 
      className="mt-4"
      onClick={() => window.location.reload()}
    >
      Try again
    </Button>
  </div>
);

const CandidateDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  const {
    updateCandidate,
    deleteCandidate,
    error: candidateError,
    isLoading
  } = useCandidates({
    queryConfig: {
      enabled: Boolean(id),
      staleTime: 30000, // 30 seconds
      cacheTime: 300000 // 5 minutes
    }
  });

  // Handle candidate profile editing
  const handleEdit = async (updatedData: Partial<Candidate>) => {
    if (!id || !candidate) return;

    try {
      // Apply optimistic update
      setCandidate(prev => prev ? { ...prev, ...updatedData } : null);

      // Update candidate with retry mechanism
      const updated = await updateCandidate({ id, data: updatedData });
      
      setCandidate(updated);
      toast.success('Candidate profile updated successfully');
    } catch (error) {
      // Revert optimistic update
      setCandidate(candidate);
      toast.error('Failed to update candidate profile');
      console.error('Update error:', error);
    }
  };

  // Handle candidate profile deletion
  const handleDelete = async () => {
    if (!id) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this candidate? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await deleteCandidate(id);
      toast.success('Candidate deleted successfully');
      navigate('/candidates');
    } catch (error) {
      toast.error('Failed to delete candidate');
      console.error('Delete error:', error);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  // Render error state
  if (candidateError) {
    return <ErrorFallback error={candidateError as Error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="container mx-auto px-4 py-6">
        <PageHeader
          title={candidate?.full_name || 'Candidate Details'}
          description={candidate ? `Last updated: ${formatDate(candidate.updated_at)}` : ''}
          status={candidate?.status}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/candidates')}
                className="w-full sm:w-auto"
              >
                Back to List
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="w-full sm:w-auto"
              >
                Delete Candidate
              </Button>
              <Button
                variant="default"
                onClick={() => handleEdit({ status: CandidateStatus.ACTIVE })}
                className="w-full sm:w-auto"
              >
                Set Active
              </Button>
            </>
          }
        />

        <div className="mt-6">
          <CandidateDetails
            initialData={candidate}
            onUpdate={handleEdit}
            onError={(error) => {
              toast.error(error.message);
              console.error('Candidate details error:', error);
            }}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CandidateDetailsPage;