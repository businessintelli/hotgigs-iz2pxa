import React, { useEffect, useState } from 'react'; // ^18.0.0
import { useParams, useNavigate } from 'react-router-dom'; // ^6.0.0
import { format } from 'date-fns'; // ^2.30.0
import { useJobs } from '../../lib/hooks/useJobs';
import { Job, JobStatus } from '../../types/jobs';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Dialog } from '../ui/dialog';
import { useToast } from '../../lib/hooks/useToast';
import { ErrorBoundary } from '../ui/error-boundary';

interface JobDetailsProps {
  isRecruiter?: boolean;
}

const JobDetails: React.FC<JobDetailsProps> = ({ isRecruiter = false }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<string, number>>({});

  const {
    useJobSearch,
    updateJob,
    deleteJob,
    matchCandidates,
    useMatchScorePolling,
    initializeRealTimeUpdates
  } = useJobs();

  // Query for job details
  const { data: jobData, isLoading, error } = useJobSearch({
    query: '',
    page: 1,
    limit: 1,
    filters: { id: jobId }
  });

  // Real-time updates subscription
  useEffect(() => {
    const cleanup = initializeRealTimeUpdates();
    return () => cleanup();
  }, [initializeRealTimeUpdates]);

  // Match score polling
  const { data: matchData } = useMatchScorePolling(jobId!);

  // Handle edit navigation
  const handleEdit = () => {
    navigate(`/jobs/${jobId}/edit`, { state: { jobData } });
  };

  // Handle job deletion
  const handleDelete = async () => {
    try {
      await deleteJob(jobId!);
      toast.success({
        title: 'Job Deleted',
        description: 'The job posting has been successfully deleted'
      });
      navigate('/jobs');
    } catch (error) {
      toast.error({
        title: 'Deletion Failed',
        description: 'Failed to delete the job posting'
      });
    }
  };

  // Handle candidate matching
  const handleMatch = async () => {
    try {
      const result = await matchCandidates(jobId!);
      setMatchScores(result.matchScore);
    } catch (error) {
      toast.error({
        title: 'Matching Failed',
        description: 'Failed to perform candidate matching'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBoundary
        error={error as Error}
        resetErrorBoundary={() => window.location.reload()}
      />
    );
  }

  const job = jobData?.data[0];
  if (!job) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{job.title}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant={job.status === JobStatus.PUBLISHED ? 'success' : 'secondary'}>
              {job.status}
            </Badge>
            <Badge variant="outline">{job.department}</Badge>
            <Badge variant="outline">{job.location}</Badge>
          </div>
        </div>
        {isRecruiter && (
          <div className="flex gap-2">
            <Button onClick={handleEdit} variant="outline">
              Edit Job
            </Button>
            <Button onClick={() => setIsDeleteDialogOpen(true)} variant="destructive">
              Delete Job
            </Button>
          </div>
        )}
      </div>

      {/* Job Details */}
      <Card className="p-6 space-y-4">
        <div className="prose max-w-none">
          <h2 className="text-xl font-semibold">Description</h2>
          <div dangerouslySetInnerHTML={{ __html: job.description }} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Requirements</h2>
          <ul className="list-disc pl-6 space-y-2">
            {job.requirements.required_skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold">Experience Level</h3>
            <p>{job.requirements.experience_level}</p>
          </div>
          <div>
            <h3 className="font-semibold">Salary Range</h3>
            <p>
              ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
            </p>
          </div>
        </div>

        {job.benefits.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Benefits</h3>
            <div className="flex flex-wrap gap-2">
              {job.benefits.map((benefit, index) => (
                <Badge key={index} variant="secondary">
                  {benefit}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* AI Matching Section */}
      {isRecruiter && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">AI-Powered Matching</h2>
          <div className="space-y-4">
            <Button onClick={handleMatch} variant="default">
              Find Matching Candidates
            </Button>
            {matchData && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Match Results</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(matchScores).map(([candidateId, score]) => (
                    <div key={candidateId} className="flex justify-between items-center p-2 border rounded">
                      <span>Candidate {candidateId}</span>
                      <Badge variant="success">{Math.round(score)}% Match</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Job Posting"
        description="Are you sure you want to delete this job posting? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default JobDetails;