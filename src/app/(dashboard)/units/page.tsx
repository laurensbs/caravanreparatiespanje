import { getUnits } from "@/actions/units";
import { getTags } from "@/actions/tags";
import { getAllCustomers } from "@/actions/customers";
import { UnitsClient } from "@/components/units/units-client";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function UnitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [{ units, total, page, limit }, allTags, customersList] = await Promise.all([
    getUnits({
      q: params.q,
      tagId: params.tagId,
      page: params.page ? parseInt(params.page) : 1,
    }),
    getTags(),
    getAllCustomers(),
  ]);

  return (
    <UnitsClient
      units={units}
      total={total}
      page={page}
      limit={limit}
      currentQ={params.q}
      currentTagId={params.tagId}
      allTags={allTags}
      customers={customersList}
    />
  );
}
