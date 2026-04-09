import { getCustomerById } from "@/actions/customers";
import { getCustomerHoldedInvoices } from "@/actions/holded";
import { getTags, getCustomerTags } from "@/actions/tags";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [customer, holdedInvoices, allTags, customerTagsList] = await Promise.all([
    getCustomerById(id),
    getCustomerHoldedInvoices(id),
    getTags(),
    getCustomerTags(id),
  ]);
  if (!customer) notFound();

  return <CustomerDetail customer={customer} holdedInvoices={holdedInvoices} allTags={allTags} customerTags={customerTagsList} />;
}
