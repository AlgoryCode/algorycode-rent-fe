export type CustomerRecordStatePayload = {
  recordKey: string;
  active: boolean;
};

export type CustomerRecordDeletionPayload = {
  deletedRentals: number;
  deletedRentalRequests: number;
};
