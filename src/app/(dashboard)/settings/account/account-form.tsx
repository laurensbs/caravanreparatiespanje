"use client";

import { useState } from "react";
import { updateOwnProfile, changeOwnPassword } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, Lock, User } from "lucide-react";
import {
  SettingsPanel,
  SettingsSectionHeader,
} from "@/components/settings/settings-primitives";

interface AccountFormProps {
  userName: string;
  userEmail: string;
}

export function AccountForm({ userName, userEmail }: AccountFormProps) {
  const [name, setName] = useState(userName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await updateOwnProfile({ name });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    }
    setSavingProfile(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    setPasswordSaved(false);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    }
    setSavingPassword(false);
  }

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={User}
          title="Profile"
          description="Your display name appears in the top bar, audit log and feedback."
        />
        <form onSubmit={handleProfileSave} className="space-y-4">
          {profileError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
              {profileError}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Display name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={userEmail} disabled className="h-10 rounded-xl bg-gray-50 dark:bg-white/[0.03]" />
            <p className="text-[11.5px] text-gray-500">Username cannot be changed</p>
          </div>
          <Button
            type="submit"
            disabled={savingProfile}
            className="h-10 rounded-full px-5 text-[13px] font-medium shadow-sm"
          >
            {savingProfile ? <Spinner className="mr-2" /> : null}
            {profileSaved ? (
              <>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </SettingsPanel>

      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={Lock}
          title="Change password"
          description="Pick something you don't reuse anywhere else."
        />
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
              {passwordError}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="acc-current">Current password</Label>
            <Input
              id="acc-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 rounded-xl"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-new">New password</Label>
              <Input
                id="acc-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 rounded-xl"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-confirm">Confirm</Label>
              <Input
                id="acc-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 rounded-xl"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={savingPassword}
            className="h-10 rounded-full px-5 text-[13px] font-medium shadow-sm"
          >
            {savingPassword ? <Spinner className="mr-2" /> : null}
            {passwordSaved ? (
              <>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
                Password changed
              </>
            ) : (
              "Change password"
            )}
          </Button>
        </form>
      </SettingsPanel>
    </div>
  );
}
