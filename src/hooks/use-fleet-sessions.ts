"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { rentKeys } from "@/lib/rent-query-keys";
import {
  createRentalOnRentApi,
  fetchRentalsFromRentApi,
  getRentApiErrorMessage,
  updateRentalOnRentApi,
  type CreateRentalPayload,
  type UpdateRentalPayload,
} from "@/lib/rent-api";

export function useFleetSessions() {
  const qc = useQueryClient();

  const { data: sessions = [], isPending, error, refetch, isFetching } = useQuery({
    queryKey: rentKeys.rentals(),
    queryFn: () => fetchRentalsFromRentApi(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRentalPayload) => createRentalOnRentApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.rentals() });
      void qc.invalidateQueries({ queryKey: rentKeys.rentalRequests() });
      void qc.invalidateQueries({ queryKey: [...rentKeys.all, "vehicleCalendarOccupancy"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRentalPayload }) => updateRentalOnRentApi(id, payload),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: rentKeys.rentals() });
      void qc.invalidateQueries({ queryKey: rentKeys.rental(id) });
      void qc.invalidateQueries({ queryKey: rentKeys.rentalRequests() });
      void qc.invalidateQueries({ queryKey: [...rentKeys.all, "vehicleCalendarOccupancy"] });
    },
  });

  const allSessions = useMemo(() => sessions, [sessions]);

  return {
    allSessions,
    createRental: createMutation.mutateAsync.bind(createMutation),
    updateRental: (id: string, payload: UpdateRentalPayload) => updateMutation.mutateAsync({ id, payload }),
    ready: !isPending,
    isRefreshing: isFetching && !isPending,
    error: error ? getRentApiErrorMessage(error) : null,
    refetch: () => refetch(),
  };
}
