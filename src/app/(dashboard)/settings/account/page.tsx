import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountForm } from "./account-form";

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AccountForm
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
