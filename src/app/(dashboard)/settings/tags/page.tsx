import { getTags } from "@/actions/tags";
import { TagsClient } from "./tags-client";

export default async function TagsSettingsPage() {
  const tags = await getTags();

  return <TagsClient tags={tags} />;
}
