import { getCustomerById } from "@/actions/customers";
import { getCustomerHoldedInvoices, getCustomerHoldedQuotes } from "@/actions/holded";
import { getTags, getCustomerTags } from "@/actions/tags";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [customer, holdedInvoices, holdedQuotes, allTags, customerTagsList] = await Promise.all([
    getCustomerById(id),
    getCustomerHoldedInvoices(id),
    getCustomerHoldedQuotes(id),
    getTags(),
    getCustomerTags(id),
  ]);
  if (!customer) notFound();

  return <CustomerDetail customer={customer} holdedInvoices={holdedInvoices} holdedQuotes={holdedQuotes} allTags={allTags} customerTags={customerTagsList} />;
}
