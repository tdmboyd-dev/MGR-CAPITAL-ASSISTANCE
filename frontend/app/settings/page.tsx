"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  Settings,
  Mail,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Shield,
  Key
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SettingsPage() {
  const router = useRouter();
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    recoveryEmail: "",
  });
  const [requiresRecoveryEmail, setRequiresRecoveryEmail] = useState(false);

  // Fetch user profile
  useEffect(() => {
    if (!accessToken) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setProfile({
            name: data.user.name || "",
            phone: data.user.phone || "",
            recoveryEmail: data.user.recoveryEmail || "",
          });
          setRequiresRecoveryEmail(data.user.requiresRecoveryEmail || false);
        }
      } catch (err) {
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [accessToken]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await response.json();

      if (response.ok) {
        setRequiresRecoveryEmail(data.user.requiresRecoveryEmail || false);
        toast.success("Settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getDashboardPath = () => {
    if (!user?.role) return "/";
    const paths: Record<string, string> = {
      FOUNDER: "/founder/dashboard",
      ADMIN: "/admin/dashboard",
      EMPLOYEE: "/employee/dashboard",
      CLIENT: "/client/dashboard",
    };
    return paths[user.role] || "/";
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push(getDashboardPath())}
          className="mb-6 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 rounded-2xl overflow-hidden">
            <CardHeader className="pb-6 pt-8 px-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Settings className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                    Account Settings
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    Manage your profile and security settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-8 space-y-8">
              {/* Recovery Email Warning - Show if required */}
              {requiresRecoveryEmail && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <AlertTitle className="text-red-800 dark:text-red-300 font-semibold">
                    Recovery Email Required
                  </AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    Your account uses a @capitalmgr.com email. You MUST set a recovery email
                    to be able to reset your password if you get locked out.
                  </AlertDescription>
                </Alert>
              )}

              {/* Profile Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Profile Information
                </h3>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email (cannot be changed)
                    </Label>
                    <Input
                      value={user.email}
                      disabled
                      className="h-12 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Display Name
                    </Label>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Your name"
                      className="h-12 px-4 rounded-xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white/60 dark:bg-slate-800/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Phone Number
                    </Label>
                    <Input
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="h-12 px-4 rounded-xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white/60 dark:bg-slate-800/60"
                    />
                  </div>
                </div>
              </div>

              {/* Recovery Email Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Account Recovery
                </h3>

                {/* Important Warning */}
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold">
                    Important: Your Only Way Back In
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-400 space-y-2">
                    <p>
                      This recovery email is the <strong>ONLY way</strong> to reset your password
                      if you get locked out of your account.
                    </p>
                    <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                      <li>Use a personal email you always have access to (Gmail, Yahoo, etc.)</li>
                      <li>Do NOT use another @capitalmgr.com email</li>
                      <li>Keep this email up-to-date - you can change it anytime</li>
                      <li>Without this, you cannot recover your account if locked out</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Recovery Email Address
                  </Label>
                  <Input
                    type="email"
                    value={profile.recoveryEmail}
                    onChange={(e) => setProfile({ ...profile, recoveryEmail: e.target.value })}
                    placeholder="your.personal@gmail.com"
                    className="h-12 px-4 rounded-xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 bg-white/60 dark:bg-slate-800/60"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Password reset links will be sent to this email address.
                  </p>
                </div>

                {profile.recoveryEmail && !profile.recoveryEmail.endsWith("@capitalmgr.com") && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Recovery email is set
                  </div>
                )}

                {profile.recoveryEmail && profile.recoveryEmail.endsWith("@capitalmgr.com") && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    Cannot use @capitalmgr.com - use an external email
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
          {new Date().getFullYear()} MGR Capital Assistance - Your settings are encrypted and secure
        </p>
      </div>
    </div>
  );
}
