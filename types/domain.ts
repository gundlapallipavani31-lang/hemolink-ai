import type { AppRole } from "./auth";

export type BloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "O+"
  | "O-"
  | "AB+"
  | "AB-";

export type RhFactor = "positive" | "negative";

export type OrganizationType = "hospital" | "bloodBank";

export type VerificationStatus = "pending" | "verified" | "rejected";

export type Organization = {
  id: string;
  type: OrganizationType;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  verificationStatus: VerificationStatus;
  identityKey?: string;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "staff" | "clinician" | "inventory_manager" | "viewer";
  status: "invited" | "active" | "revoked";
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type OrganizationRequestStatus = "pending" | "approved" | "rejected";

export type OrganizationRequest = {
  id: string;
  type: OrganizationType;
  requesterUserId: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city: string;
  state?: string;
  country?: string;
  status: OrganizationRequestStatus;
  organizationId?: string;
  rejectionReason?: string;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  decidedAt?: FirebaseTimestamp;
  decidedBy?: string;
};

export type DonorEligibilityStatus =
  | "unknown"
  | "eligible"
  | "ineligible"
  | "under_review";

export type DonorAvailabilityStatus = "available" | "unavailable" | "unknown";

export type DonorProfile = {
  userId: string;
  phone?: string;
  bloodGroup?: BloodGroup;
  rhFactor?: RhFactor;
  eligibilityStatus: DonorEligibilityStatus;
  lastDonationAt?: FirebaseTimestamp;
  nextEligibleAt?: FirebaseTimestamp;
  availabilityStatus: DonorAvailabilityStatus;
  city?: string;
  consentToEmergencyContact: boolean;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type Patient = {
  id: string;
  hospitalId: string;
  createdBy: string;
  externalReference?: string;
  displayName?: string;
  bloodGroup?: BloodGroup;
  rhFactor?: RhFactor;
  dateOfBirth?: FirebaseTimestamp;
  status: "active" | "closed";
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type BloodComponent =
  | "wholeBlood"
  | "redCells"
  | "plasma"
  | "platelets"
  | "cryoprecipitate";

export type InventoryStatus =
  | "available"
  | "reserved"
  | "dispatched"
  | "expired"
  | "quarantined"
  | "discarded";

export type BloodInventory = {
  id: string;
  bloodBankId: string;
  componentType: BloodComponent;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  unitsAvailable: number;
  unitsReserved: number;
  collectionDate: FirebaseTimestamp;
  expiryDate: FirebaseTimestamp;
  storageLocation?: string;
  status: InventoryStatus;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  ownerVerified?: boolean;
};

export type RequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_information"
  | "approved"
  | "preparing"
  | "dispatched"
  | "rejected"
  | "matching"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled"
  | "expired";

export type RequestUrgency = "routine" | "urgent" | "emergency";

export type FulfillmentAllocationStatus = "reserved" | "preparing" | "dispatched";

export type FulfillmentAllocation = {
  bloodBankId: string;
  inventoryId: string;
  unitsReserved: number;
  unitsDispatched: number;
  unitsReceived: number;
  status: FulfillmentAllocationStatus;
};

export type BloodRequest = {
  id: string;
  hospitalId: string;
  createdBy: string;
  patientId?: string;
  patientName?: string;
  caseId?: string;
  hospitalName?: string;
  bloodGroup: BloodGroup;
  rhFactor?: RhFactor;
  componentType: BloodComponent;
  unitsRequested: number;
  unitsFulfilled: number;
  urgency: RequestUrgency;
  priority: number;
  status: RequestStatus;
  fulfillmentAllocations?: FulfillmentAllocation[];
  assignedBloodBankIds?: string[];
  unitsDispatched?: number;
  ownerUserId?: string;
  assignedAt?: FirebaseTimestamp;
  acknowledgedAt?: FirebaseTimestamp;
  firstResponseAt?: FirebaseTimestamp;
  neededBy?: FirebaseTimestamp;
  notes?: string;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type BloodRequestEvent = {
  id: string;
  requestId: string;
  actorUserId: string;
  eventType:
    | "created"
    | "submitted"
    | "reviewed"
    | "acknowledged"
    | "assigned"
    | "review_message"
    | "information_requested"
    | "hospital_response"
    | "approved"
    | "rejected"
    | "reserved"
    | "preparing"
    | "dispatched"
    | "received"
    | "fulfilled"
    | "cancelled";
  metadata?: Record<string, unknown>;
  createdAt?: FirebaseTimestamp;
};

export type DonationStatus = "scheduled" | "completed" | "rejected" | "cancelled";

export type Donation = {
  id: string;
  donorId: string;
  bloodBankId?: string;
  componentType: BloodComponent;
  bloodGroup: BloodGroup;
  rhFactor?: RhFactor;
  unitsCollected?: number;
  donationDate: FirebaseTimestamp;
  status: DonationStatus;
  opportunityId?: string;
  organizationId?: string;
  verifiedBy?: string;
  recordedBy?: string;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type DonorOpportunityStatus =
  | "offered"
  | "accepted"
  | "declined"
  | "scheduled"
  | "completed"
  | "cancelled";

export type DonorOpportunity = {
  id: string;
  donorId: string;
  organizationId: string;
  organizationType: OrganizationType;
  sourceRequestId?: string;
  bloodGroup: BloodGroup;
  city?: string;
  appointmentDetails?: string;
  appointmentAt?: FirebaseTimestamp;
  status: DonorOpportunityStatus;
  donorResponseAt?: FirebaseTimestamp;
  scheduledAt?: FirebaseTimestamp;
  completedAt?: FirebaseTimestamp;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
  createdBy: string;
  completedBy?: string;
  donationId?: string;
};

export type MatchSourceType = "inventory" | "donor" | "partnerBloodBank";

export type Match = {
  id: string;
  requestId: string;
  sourceType: MatchSourceType;
  sourceId: string;
  compatibilityStatus: "candidate" | "approved" | "rejected";
  unitsMatched: number;
  priorityScore?: number;
  createdAt?: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
};

export type NotificationType =
  | "request"
  | "donation"
  | "inventory"
  | "approval"
  | "emergency"
  | "system";

export type Notification = {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  readAt?: FirebaseTimestamp;
  expiresAt?: FirebaseTimestamp;
  createdAt?: FirebaseTimestamp;
};

export type AuditLog = {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: FirebaseTimestamp;
};

export type AIPrediction = {
  id: string;
  type: string;
  bloodGroup?: BloodGroup;
  prediction: string;
  confidence: number;
  generatedAt: FirebaseTimestamp;
  expiresAt?: FirebaseTimestamp;
  metadata?: Record<string, unknown>;
};

type FirebaseTimestamp = {
  toDate(): Date;
};

export type UserRoleAssignment = {
  userId: string;
  role: AppRole;
  organizationId?: string;
};
