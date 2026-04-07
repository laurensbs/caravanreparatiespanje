import { getUsers } from "@/actions/users";
import { UsersClient } from "./users-client";

export default async function UsersSettingsPage() {
  const users = await getUsers();

  return <UsersClient users={users} />;
}
