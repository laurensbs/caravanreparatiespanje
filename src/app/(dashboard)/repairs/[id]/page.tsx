import { getRepairJobById, getCustomerRepairs } from "@/actions/repairs";
import { getCommunicationLogs } from "@/actions/communications";
import { getParts, getPartRequests, getPartCategories } from "@/actions/parts";
import { getAppSettings } from "@/actions/settings";
import { getTags, getRepairTags } from "@/actions/tags";
import { getUsers } from "@/actions/users";
import { getAllCustomers } from "@/actions/customers";
import { getRepairTasks, getRepairWorkers, getActiveUsers, getRepairFindings, getRepairBlockers } from "@/actions/garage";
import { getRepairSyncState, getGarageActivity, markGarageUpdatesRead } from "@/actions/garage-sync";
import { getEstimateLineItems, getDismissedWorkshopItems } from "@/actions/estimates";
import { getRepairPhotos } from "@/actions/photos";
import { getJobTimeEntries, getJobActiveTimers } from "@/actions/time-entries";
import { notFound } from "next/navigation";
import { RepairDetail } from "@/components/repairs/repair-detail";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await getRepairJobById(id);
  const label = job?.publicCode ?? job?.title ?? "Repair";
  return { title: label };
}

export default async function RepairDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [job, communicationLogs, partsList, settings, allTags, repairTags, usersList, allCustomers, tasks, partRequests, repairWorkers, activeUsers, findings, blockers, estimateLines, partCategories, photos, timeEntries, activeTimers, dismissedWorkshopItems, syncState, garageActivity] = await Promise.all([
    getRepairJobById(id),
    getCommunicationLogs(id),
    getParts(),
    getAppSettings(),
    getTags(),
    getRepairTags(id),
    getUsers().catch(() => []),
    getAllCustomers(),
    getRepairTasks(id),
    getPartRequests(id),
    getRepairWorkers(id),
    getActiveUsers(),
    getRepairFindings(id),
    getRepairBlockers(id),
    getEstimateLineItems(id),
    getPartCategories(),
    getRepairPhotos(id),
    getJobTimeEntries(id),
    getJobActiveTimers(id),
    getDismissedWorkshopItems(id),
    getRepairSyncState(id),
    getGarageActivity(id, 10),
  ]);
  if (!job) notFound();

  // Mark garage updates as read when admin opens the page
  if (syncState && syncState.garageUnreadUpdatesCount > 0) {
    await markGarageUpdatesRead(id);
  }

  const customerRepairs = job.customerId
    ? await getCustomerRepairs(job.customerId, job.id)
    : [];

  return (
    <RepairDetail
      job={job}
      communicationLogs={communicationLogs}
      partsList={partsList}
      backTo={sp.backTo}
      allTags={allTags}
      repairTags={repairTags}
      customerRepairs={customerRepairs}
      users={usersList}
      allCustomers={allCustomers}
      partRequests={partRequests}
      repairWorkers={repairWorkers}
      activeUsers={activeUsers}
      tasks={tasks}
      findings={findings}
      blockers={blockers}
      estimateLines={estimateLines}
      dismissedWorkshopItems={dismissedWorkshopItems}
      partCategories={partCategories}
      photos={photos}
      timeEntries={timeEntries}
      activeTimers={activeTimers}
      syncState={syncState}
      garageActivity={garageActivity}
      settings={{
        hourlyRate: parseFloat(settings.hourly_rate ?? "42.50"),
        defaultMarkup: parseFloat(settings.default_markup_percent ?? "25"),
        defaultTax: parseFloat(settings.default_tax_percent ?? "21"),
      }}
    />
  );
}
