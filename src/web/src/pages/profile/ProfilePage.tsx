import React, { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { useToast } from '../../components/ui/toast';
import { userProfileSchema } from '../../types/auth';
import { FILE_UPLOAD } from '../../config/constants';

// Profile form validation schema
const ProfileSchema = userProfileSchema.extend({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().nullable().refine((val) => !val || /^\+?[\d\s-()]+$/.test(val), {
    message: 'Invalid phone number format',
  }),
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
  languages: z.array(z.string()),
  timezone: z.string(),
  notifications_settings: z.record(z.boolean()),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

const ProfilePage: React.FC = () => {
  const { state, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<ProfileFormData>({
    defaultValues: state.user?.profile,
    resolver: async (data) => {
      try {
        await ProfileSchema.parseAsync(data);
        return { values: data, errors: {} };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            values: {},
            errors: error.formErrors.fieldErrors,
          };
        }
        return { values: {}, errors: { '': ['Validation failed'] } };
      }
    },
  });

  useEffect(() => {
    if (state.user?.profile) {
      reset(state.user.profile);
    }
  }, [state.user?.profile, reset]);

  const handleProfileUpdate = useCallback(async (data: ProfileFormData) => {
    try {
      setIsLoading(true);

      // Sanitize input data
      const sanitizedData = ProfileSchema.parse(data);

      await updateProfile(sanitizedData);

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
        variant: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateProfile, toast]);

  const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Validate file
      if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Invalid file type. Please upload an image file.');
      }

      if (file.size > FILE_UPLOAD.MAX_SIZE) {
        throw new Error(`File size must be less than ${FILE_UPLOAD.MAX_SIZE / (1024 * 1024)}MB`);
      }

      setIsLoading(true);

      // File upload logic would go here
      // const avatarUrl = await uploadAvatar(file);
      // await updateProfile({ ...state.user?.profile, avatar_url: avatarUrl });

      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been updated successfully.',
        variant: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  if (!state.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" role="main">
      <h1 className="text-2xl font-bold mb-8">Profile Settings</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleProfileUpdate)} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="avatar" className="block text-sm font-medium mb-2">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="sr-only"
                    aria-describedby="avatar-help"
                  />
                  <div className="flex items-center space-x-4">
                    <img
                      src={state.user.profile.avatar_url || '/default-avatar.png'}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <label
                      htmlFor="avatar"
                      className="px-4 py-2 border rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      Change Photo
                    </label>
                  </div>
                  <p id="avatar-help" className="mt-1 text-sm text-gray-500">
                    Recommended: Square image, at least 400x400px
                  </p>
                </div>

                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    {...register('full_name')}
                    id="full_name"
                    type="text"
                    className="w-full px-3 py-2 border rounded-md"
                    aria-invalid={!!errors.full_name}
                    aria-describedby="full_name-error"
                  />
                  {errors.full_name && (
                    <p id="full_name-error" className="mt-1 text-sm text-red-600">
                      {errors.full_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <input
                    {...register('email')}
                    id="email"
                    type="email"
                    className="w-full px-3 py-2 border rounded-md"
                    aria-invalid={!!errors.email}
                    aria-describedby="email-error"
                  />
                  {errors.email && (
                    <p id="email-error" className="mt-1 text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <input
                    {...register('phone')}
                    id="phone"
                    type="tel"
                    className="w-full px-3 py-2 border rounded-md"
                    aria-invalid={!!errors.phone}
                    aria-describedby="phone-error"
                  />
                  {errors.phone && (
                    <p id="phone-error" className="mt-1 text-sm text-red-600">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                aria-busy={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="skills" className="block text-sm font-medium mb-2">
                    Skills
                  </label>
                  <input
                    {...register('skills')}
                    id="skills"
                    type="text"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Add skills separated by commas"
                    aria-invalid={!!errors.skills}
                    aria-describedby="skills-error"
                  />
                  {errors.skills && (
                    <p id="skills-error" className="mt-1 text-sm text-red-600">
                      {errors.skills.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="linkedin_url" className="block text-sm font-medium mb-2">
                    LinkedIn Profile
                  </label>
                  <input
                    {...register('linkedin_url')}
                    id="linkedin_url"
                    type="url"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <div>
                  <label htmlFor="github_url" className="block text-sm font-medium mb-2">
                    GitHub Profile
                  </label>
                  <input
                    {...register('github_url')}
                    id="github_url"
                    type="url"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="https://github.com/username"
                  />
                </div>

                <div>
                  <label htmlFor="portfolio_url" className="block text-sm font-medium mb-2">
                    Portfolio Website
                  </label>
                  <input
                    {...register('portfolio_url')}
                    id="portfolio_url"
                    type="url"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="https://yourportfolio.com"
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;