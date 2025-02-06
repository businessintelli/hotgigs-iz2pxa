import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod"; // ^3.0.0
import { toast } from "sonner"; // ^1.0.0
import { debounce } from "lodash"; // ^4.17.21
import { useAuth } from "../../lib/hooks/useAuth";
import Switch from "../../components/ui/switch";
import Select from "../../components/ui/select";
import { LOCAL_STORAGE_KEYS } from "../../config/constants";

// Settings validation schema
const settingsSchema = z.object({
  theme: z.object({
    darkMode: z.boolean(),
    fontSize: z.enum(["small", "medium", "large"]),
    reducedMotion: z.boolean()
  }),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    jobAlerts: z.boolean(),
    applicationUpdates: z.boolean()
  }),
  privacy: z.object({
    profileVisibility: z.enum(["public", "private", "recruiters"]),
    showActivity: z.boolean(),
    allowMessaging: z.boolean()
  }),
  security: z.object({
    twoFactorEnabled: z.boolean(),
    sessionTimeout: z.number().min(5).max(60)
  }),
  preferences: z.object({
    language: z.string(),
    timezone: z.string(),
    dateFormat: z.string()
  })
});

type Settings = z.infer<typeof settingsSchema>;

const SettingsPage: React.FC = () => {
  const { state: authState } = useAuth();
  const [settings, setSettings] = useState<Settings>(() => {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_PREFERENCES);
    return savedSettings ? JSON.parse(savedSettings) : {
      theme: {
        darkMode: false,
        fontSize: "medium",
        reducedMotion: false
      },
      notifications: {
        email: true,
        push: true,
        jobAlerts: true,
        applicationUpdates: true
      },
      privacy: {
        profileVisibility: "public",
        showActivity: true,
        allowMessaging: true
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeout: 30
      },
      preferences: {
        language: "en",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: "MMM dd, yyyy"
      }
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced settings update
  const updateSettings = useMemo(
    () =>
      debounce(async (newSettings: Settings) => {
        try {
          setIsLoading(true);
          setError(null);

          // Validate settings
          settingsSchema.parse(newSettings);

          // Save to localStorage
          localStorage.setItem(
            LOCAL_STORAGE_KEYS.USER_PREFERENCES,
            JSON.stringify(newSettings)
          );

          // Update backend if user is authenticated
          if (authState.user) {
            // Backend update would go here
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulated API call
          }

          toast.success("Settings updated successfully");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update settings";
          setError(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      }, 500),
    [authState.user]
  );

  // Handle setting changes
  const handleSettingChange = useCallback(
    (section: keyof Settings, key: string, value: any) => {
      const newSettings = {
        ...settings,
        [section]: {
          ...settings[section],
          [key]: value
        }
      };
      setSettings(newSettings);
      updateSettings(newSettings);
    },
    [settings, updateSettings]
  );

  // Language options
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" }
  ];

  // Visibility options
  const visibilityOptions = [
    { value: "public", label: "Public" },
    { value: "private", label: "Private" },
    { value: "recruiters", label: "Recruiters Only" }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" role="main">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6" role="alert">
          {error}
        </div>
      )}

      {/* Theme Settings */}
      <section className="mb-8" aria-labelledby="theme-settings">
        <h2 id="theme-settings" className="text-xl font-semibold mb-4">Theme & Display</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Switch
              id="darkMode"
              label="Dark Mode"
              checked={settings.theme.darkMode}
              onCheckedChange={(checked) => handleSettingChange("theme", "darkMode", checked)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Switch
              id="reducedMotion"
              label="Reduced Motion"
              checked={settings.theme.reducedMotion}
              onCheckedChange={(checked) => handleSettingChange("theme", "reducedMotion", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </section>

      {/* Notification Settings */}
      <section className="mb-8" aria-labelledby="notification-settings">
        <h2 id="notification-settings" className="text-xl font-semibold mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Switch
              id="emailNotifications"
              label="Email Notifications"
              checked={settings.notifications.email}
              onCheckedChange={(checked) => handleSettingChange("notifications", "email", checked)}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Switch
              id="pushNotifications"
              label="Push Notifications"
              checked={settings.notifications.push}
              onCheckedChange={(checked) => handleSettingChange("notifications", "push", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </section>

      {/* Privacy Settings */}
      <section className="mb-8" aria-labelledby="privacy-settings">
        <h2 id="privacy-settings" className="text-xl font-semibold mb-4">Privacy</h2>
        <div className="space-y-4">
          <Select
            id="profileVisibility"
            label="Profile Visibility"
            value={settings.privacy.profileVisibility}
            options={visibilityOptions}
            onChange={(value) => handleSettingChange("privacy", "profileVisibility", value)}
            disabled={isLoading}
          />
          <div className="flex items-center justify-between">
            <Switch
              id="allowMessaging"
              label="Allow Messaging"
              checked={settings.privacy.allowMessaging}
              onCheckedChange={(checked) => handleSettingChange("privacy", "allowMessaging", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </section>

      {/* Preferences Settings */}
      <section className="mb-8" aria-labelledby="preferences-settings">
        <h2 id="preferences-settings" className="text-xl font-semibold mb-4">Preferences</h2>
        <div className="space-y-4">
          <Select
            id="language"
            label="Language"
            value={settings.preferences.language}
            options={languageOptions}
            onChange={(value) => handleSettingChange("preferences", "language", value)}
            disabled={isLoading}
          />
        </div>
      </section>

      {/* Security Settings */}
      <section className="mb-8" aria-labelledby="security-settings">
        <h2 id="security-settings" className="text-xl font-semibold mb-4">Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Switch
              id="twoFactorAuth"
              label="Two-Factor Authentication"
              checked={settings.security.twoFactorEnabled}
              onCheckedChange={(checked) => handleSettingChange("security", "twoFactorEnabled", checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;