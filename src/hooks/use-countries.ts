"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchCountriesFromRentApi,
  getRentApiErrorMessage,
  type CountryRow,
} from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

export function useCountries() {
  const { data: countries = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: rentKeys.countries(),
    queryFn: fetchCountriesFromRentApi,
  });

  const countryByCode = useMemo(() => {
    const m = new Map<string, CountryRow>();
    for (const c of countries) {
      m.set(c.code.toUpperCase(), c);
    }
    return m;
  }, [countries]);

  return {
    countries,
    countryByCode,
    loading: isPending,
    isRefreshing: isFetching && !isPending,
    error: error ? getRentApiErrorMessage(error) : null,
    refetch: () => refetch(),
  };
}
