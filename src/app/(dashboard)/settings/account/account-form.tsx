"use client";

import { useState } from "react";
import { updateOwnProfile, changeOwnPassword } from "@/actions/account";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle } from "lucide-react";

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
    } catch (err: any) {
      setProfileError(err?.message ?? "Failed to update profile");
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
    } catch (err: any) {
      setPasswordError(err?.message ?? "Failed to change password");
    }
    setSavingPassword(false);
  }

  return (
    <div className="space-y-4 max-w-2xl animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            {profileError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{profileError}</div>
            )}
            <div>
              <Label htmlFor="acc-name">Display Name</Label>
              <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 max-w-sm" />
            </div>
            <div>
              <Label>Username</Label>
              <Input value={userEmail} disabled className="mt-1 max-w-sm bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Username cannot be changed</p>
            </div>
            <Button type="submit" disabled={savingProfile} size="sm">
              {savingProfile ? <Spinner className="mr-2" /> : null}
              {profileSaved ? <><CheckCircle className="mr-2 h-4 w-4 text-emerald-500" /> Saved</> : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {passwordError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{passwordError}</div>
            )}
            <div>
              <Label htmlFor="acc-current">Current Password</Label>
              <Input
                id="acc-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 max-w-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="acc-new">New Password</Label>
              <Input
                id="acc-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 max-w-sm"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="acc-confirm">Confirm New Password</Label>
              <Input
                id="acc-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 max-w-sm"
                required
              />
            </div>
            <Button type="submit" disabled={savingPassword} size="sm">
              {savingPassword ? <Spinner className="mr-2" /> : null}
              {passwordSaved ? <><CheckCircle className="mr-2 h-4 w-4 text-emerald-500" /> Password Changed</> : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
