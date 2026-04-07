import { getLocations } from "@/actions/locations";
import { LocationsClient } from "./locations-client";

export default async function LocationsSettingsPage() {
  const locations = await getLocations();

  return <LocationsClient locations={locations} />;
}
