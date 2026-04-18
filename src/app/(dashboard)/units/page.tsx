import { getUnits } from "@/actions/units";
import { getAllCustomers } from "@/actions/customers";
import { UnitsClient } from "@/components/units/units-client";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function UnitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [{ units, total, page, limit }, customersList] = await Promise.all([
    getUnits({
      q: params.q,
      page: params.page ? parseInt(params.page) : 1,
    }),
    getAllCustomers(),
  ]);

  return (
    <UnitsClient
      units={units}
      total={total}
      page={page}
      limit={limit}
      currentQ={params.q}
      allTags={[]}
      customers={customersList}
    />
  );
}
