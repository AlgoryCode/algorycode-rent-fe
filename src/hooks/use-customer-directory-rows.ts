"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RentalSession } from "@/lib/mock-fleet";
import { loadManualCustomerRows, mergeSessionAndManualCustomers } from "@/lib/manual-customers";
import {
  aggregateCustomersFromSessions,
  mergeCustomerDirectoryStates,
  mergeRentCustomerApiRowsIntoAggregates,
  type CustomerAggregateRow,
} from "@/lib/rental-metadata";
import type { CustomerRecordStatePayload } from "@/lib/rent-api";
import { fetchCustomersFromRentApi } from "@/lib/rent-api";
import { rentKeys } from "@/lib/rent-query-keys";

export function useCustomerDirectoryRows(
  allSessions: RentalSession[],
  recordStates?: CustomerRecordStatePayload[],
): CustomerAggregateRow[] {
  const { data: apiCustomers = [] } = useQuery({
    queryKey: rentKeys.customers(),
    queryFn: fetchCustomersFromRentApi,
  });

  return useMemo(() => {
    const sessionRows = aggregateCustomersFromSessions(allSessions);
    const manualRows = loadManualCustomerRows();
    const merged = mergeSessionAndManualCustomers(sessionRows, manualRows);
    const withApi = mergeRentCustomerApiRowsIntoAggregates(merged, apiCustomers);
    return mergeCustomerDirectoryStates(withApi, recordStates);
  }, [allSessions, recordStates, apiCustomers]);
}
