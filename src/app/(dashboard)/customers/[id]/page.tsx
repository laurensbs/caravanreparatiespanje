import { getCustomerById } from "@/actions/customers";
import { getCustomerHoldedInvoices, getCustomerHoldedQuotes } from "@/actions/holded";
import { getTags, getCustomerTags } from "@/actions/tags";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/auth-utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [session, customer, holdedInvoices, holdedQuotes, allTags, customerTagsList] = await Promise.all([
    auth(),
    getCustomerById(id),
    getCustomerHoldedInvoices(id),
    getCustomerHoldedQuotes(id),
    getTags(),
    getCustomerTags(id),
  ]);
  if (!customer) notFound();

  const canSyncHoldedRepairLinks =
    !!session?.user?.role && hasMinRole(session.user.role, "manager");

  return (
    <CustomerDetail
      customer={customer}
      holdedInvoices={holdedInvoices}
      holdedQuotes={holdedQuotes}
      allTags={allTags}
      customerTags={customerTagsList}
      canSyncHoldedRepairLinks={canSyncHoldedRepairLinks}
    />
  );
}
