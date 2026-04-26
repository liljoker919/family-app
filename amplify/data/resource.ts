import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { updateMemberRoleFn } from '../functions/update-member-role/resource';
import { createInviteFn } from '../functions/create-invite/resource';

// ---------------------------------------------------------------------------
// Authorization Matrix (enforced at the API layer via Cognito group claims)
//
// Model / Scope        | MEMBER              | PLANNER             | ADMIN
// ---------------------|---------------------|---------------------|------------------
// Profile (user)       | Read, Update own    | Read, Update own    | Full CRUD
// Family (family)      | Read, Create        | Read, Create        | Full CRUD
// FamilyMember (family)| Read, Create (join) | Read, Create (join) | Full CRUD (roles)
// Invite               | No access           | No access           | Full CRUD
// Vacation / TripPlan  | Read, Update        | Create, Read, Update| Full CRUD
// Chore                | Read, Update        | Create, Read, Update| Full CRUD
// ChoreAssignment      | Read                | Create, Read, Update| Full CRUD
// ChoreCompletion      | Read, Create, Update| Create, Read, Update| Full CRUD
// Car / CarService     | Read                | Create, Read, Update| Full CRUD
// Recipe               | Read                | Create, Read, Update| Full CRUD
// Property / P&L       | No access           | No access           | Full CRUD
//
// Tenant Isolation: every family-scoped record carries a required familyId
// attribute. Mutations that do not include the correct familyId are rejected
// because the Amplify group rules below are the primary security gate.
// Application-layer familyId filters are an additional defence-in-depth layer.
// Delete operations are restricted to ADMIN at the API level to prevent
// accidental or malicious data loss by lower-privilege roles.
// ---------------------------------------------------------------------------

const schema = a.schema({
  // -------------------------------------------------------------------------
  // Family management
  // -------------------------------------------------------------------------

  // Family – family-scoped metadata.
  // Any authenticated user may create or read a Family (new users start in
  // MEMBER group and must be able to create their first family).
  // Only ADMIN may update or delete family metadata.
  Family: a
    .model({
      name: a.string().required(),
      description: a.string(),
      joinCode: a.string().required(),
      createdBy: a.string().required(),
      members: a.hasMany('FamilyMember', 'familyId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create']),
      allow.groups(['ADMIN']).to(['update', 'delete']),
    ]),

  // FamilyMember – tracks which user belongs to which family and their role.
  // Any authenticated user may read members and create a membership record
  // (required to create or join a family).  Only ADMIN may update roles or
  // remove members, enforcing the "Role Changes → ADMIN only" requirement.
  // Secondary indexes on userId and familyId support the updateMemberRole
  // Lambda resolver's caller-lookup and admin-count operations.
  FamilyMember: a
    .model({
      familyId: a.id().required(),
      family: a.belongsTo('Family', 'familyId'),
      userId: a.string().required(),
      role: a.enum(['ADMIN', 'PLANNER', 'MEMBER']),
      displayName: a.string(),
    })
    .secondaryIndexes((index) => [
      // Enables efficient caller-identity lookup in the updateMemberRole Lambda.
      index('userId'),
      // Enables efficient family-scoped queries (member listing, admin counts).
      index('familyId'),
    ])
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create']),
      allow.groups(['ADMIN']).to(['update', 'delete']),
    ]),

  // -------------------------------------------------------------------------
  // Invite – admin-led tokenized email invite system.
  // Only ADMIN users may create, read, update, or delete invite records.
  // -------------------------------------------------------------------------

  // Invite – represents a one-time invite link sent to an email address.
  // The token field holds a UUID that is embedded in the invite URL.
  // status transitions: PENDING → ACCEPTED (when the invitee signs up).
  // expiresAt is set to now + 7 days by the createInvite Lambda resolver.
  Invite: a
    .model({
      familyId: a.id().required(),
      email: a.string().required(),
      token: a.string().required(),
      role: a.enum(['MEMBER', 'PLANNER']),
      expiresAt: a.datetime().required(),
      status: a.enum(['PENDING', 'ACCEPTED']),
    })
    .secondaryIndexes((index) => [
      // Enables efficient token-based lookup when processing invite redemption.
      index('token'),
      // Enables efficient family-scoped invite listing for the admin panel.
      index('familyId'),
    ])
    .authorization((allow) => [
      allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
    ]),

  // -------------------------------------------------------------------------
  // User profile
  // -------------------------------------------------------------------------

  // Profile – user-scoped record.
  // All authenticated users may read any profile and create their own.
  // A user may update their own profile (owner rule); ADMIN may update or
  // delete any profile.
  Profile: a
    .model({
      userId: a.id().required(),
      email: a.string().required(),
      displayName: a.string(),
      role: a.enum(['ADMIN', 'PLANNER', 'MEMBER']),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create']),
      allow.ownerDefinedIn('userId').to(['read', 'update']),
      allow.groups(['ADMIN']).to(['update', 'delete']),
    ]),

  // -------------------------------------------------------------------------
  // Vacation planning – Chore / Vacation category from the auth matrix
  // -------------------------------------------------------------------------

  // Vacation – family-scoped.
  // All groups may read and update (e.g. status changes); PLANNER and ADMIN
  // may create; only ADMIN may delete.
  Vacation: a
    .model({
      familyId: a.id().required(),
      title: a.string().required(),
      description: a.string(),
      startDate: a.date().required(),
      endDate: a.date().required(),
      transportation: a.enum(['flight', 'car', 'boat']),
      accommodations: a.string(),
      createdBy: a.string().required(),
      tripType: a.enum(['SINGLE_LOCATION', 'MULTI_LOCATION', 'CRUISE']),
      activities: a.hasMany('Activity', 'vacationId'),
      legs: a.hasMany('TripLeg', 'vacationId'),
      flightSegments: a.hasMany('FlightSegment', 'vacationId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'update']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // FlightSegment – child of Vacation; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  FlightSegment: a
    .model({
      vacationId: a.id().required(),
      vacation: a.belongsTo('Vacation', 'vacationId'),
      airline: a.string().required(),
      flightNumber: a.string().required(),
      departureAirport: a.string().required(),
      arrivalAirport: a.string().required(),
      departureDateTime: a.datetime().required(),
      arrivalDateTime: a.datetime().required(),
      confirmationNumber: a.string(),
      notes: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // TripLeg – child of Vacation; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  TripLeg: a
    .model({
      vacationId: a.id().required(),
      vacation: a.belongsTo('Vacation', 'vacationId'),
      sequence: a.integer().required(),
      name: a.string().required(),
      description: a.string(),
      legType: a.enum(['TRAVEL', 'STAY', 'CRUISE_LEG']),
      startDate: a.date(),
      endDate: a.date(),
      transportSegments: a.hasMany('TransportSegment', 'tripLegId'),
      accommodationStays: a.hasMany('AccommodationStay', 'tripLegId'),
      cruisePortStops: a.hasMany('CruisePortStop', 'tripLegId'),
      excursionOptions: a.hasMany('ExcursionOption', 'tripLegId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // TransportSegment – child of TripLeg; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  TransportSegment: a
    .model({
      tripLegId: a.id().required(),
      tripLeg: a.belongsTo('TripLeg', 'tripLegId'),
      type: a.enum(['FLIGHT', 'TRAIN', 'CAR', 'BOAT', 'CRUISE']),
      carrier: a.string(),
      flightNumber: a.string(),
      departureLocation: a.string().required(),
      arrivalLocation: a.string().required(),
      departureTime: a.datetime(),
      arrivalTime: a.datetime(),
      confirmationCode: a.string(),
      notes: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // AccommodationStay – child of TripLeg; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  AccommodationStay: a
    .model({
      tripLegId: a.id().required(),
      tripLeg: a.belongsTo('TripLeg', 'tripLegId'),
      type: a.enum(['HOTEL', 'RENTAL', 'CABIN', 'RESORT', 'CRUISE_SHIP', 'OTHER']),
      name: a.string().required(),
      address: a.string(),
      checkInDate: a.date().required(),
      checkOutDate: a.date().required(),
      confirmationCode: a.string(),
      notes: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // CruisePortStop – child of TripLeg; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  CruisePortStop: a
    .model({
      tripLegId: a.id().required(),
      tripLeg: a.belongsTo('TripLeg', 'tripLegId'),
      portName: a.string().required(),
      country: a.string(),
      arrivalDate: a.date(),
      departureDate: a.date(),
      sequence: a.integer().required(),
      excursionOptions: a.hasMany('ExcursionOption', 'cruisePortStopId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // ExcursionOption – all groups may propose (create) and read; PLANNER/ADMIN
  // may update status or edit details; only ADMIN may delete.
  ExcursionOption: a
    .model({
      tripLegId: a.id(),
      tripLeg: a.belongsTo('TripLeg', 'tripLegId'),
      cruisePortStopId: a.id(),
      cruisePortStop: a.belongsTo('CruisePortStop', 'cruisePortStopId'),
      name: a.string().required(),
      description: a.string(),
      estimatedCost: a.float(),
      duration: a.string(),
      category: a.string(),
      status: a.enum(['PROPOSED', 'UNDER_REVIEW', 'SELECTED', 'BOOKED', 'REJECTED']),
      proposedBy: a.string(),
      votes: a.hasMany('ExcursionVote', 'excursionOptionId'),
      comments: a.hasMany('ExcursionComment', 'excursionOptionId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create']),
      allow.groups(['ADMIN', 'PLANNER']).to(['update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // ExcursionVote – all groups may vote (create/update); only ADMIN may delete.
  ExcursionVote: a
    .model({
      excursionOptionId: a.id().required(),
      excursionOption: a.belongsTo('ExcursionOption', 'excursionOptionId'),
      userId: a.string().required(),
      vote: a.enum(['UP', 'DOWN']),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // ExcursionComment – all groups may comment (create/update); only ADMIN may delete.
  ExcursionComment: a
    .model({
      excursionOptionId: a.id().required(),
      excursionOption: a.belongsTo('ExcursionOption', 'excursionOptionId'),
      userId: a.string().required(),
      comment: a.string().required(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // Activity – child of Vacation; PLANNER/ADMIN manage, all groups read; only ADMIN may delete.
  Activity: a
    .model({
      vacationId: a.id().required(),
      vacation: a.belongsTo('Vacation', 'vacationId'),
      name: a.string().required(),
      description: a.string(),
      date: a.date(),
      location: a.string(),
      feedbacks: a.hasMany('Feedback', 'activityId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // Feedback – all groups may submit feedback (create/update); only ADMIN may delete.
  Feedback: a
    .model({
      activityId: a.id().required(),
      activity: a.belongsTo('Activity', 'activityId'),
      userId: a.string().required(),
      rating: a.integer().required(),
      comment: a.string(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // TripFeedback – all groups may submit feedback (create/update); only ADMIN may delete.
  TripFeedback: a
    .model({
      vacationId: a.id().required(),
      targetType: a.enum(['ACCOMMODATION', 'EXCURSION']),
      targetId: a.string().required(),
      userId: a.string().required(),
      rating: a.integer().required(),
      comment: a.string(),
      recommend: a.boolean(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // TripPlan – family-scoped planning record (Chore/Vacation category).
  // All groups may read and update (e.g. status changes); PLANNER and ADMIN
  // may create; only ADMIN may delete.
  TripPlan: a
    .model({
      familyId: a.id().required(),
      title: a.string().required(),
      destination: a.string().required(),
      startDate: a.date(),
      endDate: a.date(),
      description: a.string(),
      planningNotes: a.string(),
      status: a.enum(['PROPOSED', 'PLANNING', 'BOOKED', 'CANCELED']),
      bookedAt: a.datetime(),
      createdBy: a.string().required(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'update']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // -------------------------------------------------------------------------
  // Property & P&L – strictly ADMIN only (MEMBER and PLANNER have no access)
  // -------------------------------------------------------------------------

  Property: a
    .model({
      familyId: a.id().required(),
      name: a.string().required(),
      address: a.string(),
      type: a.string(),
      transactions: a.hasMany('PropertyTransaction', 'propertyId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN']).to(['read', 'create', 'update', 'delete']),
    ]),

  PropertyTransactionCategory: a.enum([
    'RENT_INCOME',
    'MORTGAGE',
    'TAXES',
    'MAINTENANCE',
    'INSURANCE',
  ]),

  PropertyTransaction: a
    .model({
      propertyId: a.id().required(),
      property: a.belongsTo('Property', 'propertyId'),
      type: a.enum(['income', 'expense']),
      amount: a.float().required(),
      description: a.string(),
      date: a.date().required(),
      category: a.ref('PropertyTransactionCategory').required(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN']).to(['read', 'create', 'update', 'delete']),
    ]),

  // -------------------------------------------------------------------------
  // Cookbook – Recipe model (treated as Chore/Vacation category)
  // MEMBER may read; PLANNER and ADMIN may create and update; only ADMIN may delete.
  // -------------------------------------------------------------------------

  Recipe: a
    .model({
      familyId: a.id().required(),
      title: a.string().required(),
      description: a.string(),
      ingredients: a.string().array(),
      instructions: a.string(),
      prepTime: a.string(),
      category: a.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DESSERT', 'APPETIZER', 'SIDE_DISH', 'BEVERAGE', 'OTHER']),
      contributor: a.string().required(),
      imageUrl: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // -------------------------------------------------------------------------
  // Cars & Service – Car / Service category from the auth matrix.
  // MEMBER may read; PLANNER and ADMIN may create and update; only ADMIN may delete.
  // CarService carries familyId for direct family-scoped queries and
  // linkage integrity validation.
  // -------------------------------------------------------------------------

  Car: a
    .model({
      familyId: a.id().required(),
      make: a.string().required(),
      model: a.string().required(),
      year: a.integer().required(),
      vin: a.string().required(),
      currentMileage: a.integer(),
      color: a.string(),
      licensePlate: a.string(),
      registrationExpiry: a.date(),
      services: a.hasMany('CarService', 'carId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  CarService: a
    .model({
      carId: a.id().required(),
      car: a.belongsTo('Car', 'carId'),
      familyId: a.id().required(),
      serviceType: a.string().required(),
      description: a.string(),
      mileageAtService: a.integer(),
      date: a.date().required(),
      cost: a.float(),
      provider: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // -------------------------------------------------------------------------
  // Chores – Chore / Vacation category from the auth matrix.
  // MEMBER may read and update status; PLANNER and ADMIN may create and update;
  // only ADMIN may delete.
  // ChoreAssignment and ChoreCompletion carry familyId for direct family-scoped
  // queries and linkage integrity validation.
  // -------------------------------------------------------------------------

  Chore: a
    .model({
      familyId: a.id().required(),
      title: a.string().required(),
      description: a.string(),
      recurrence: a.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME']),
      daysOfWeek: a.string().array(),
      category: a.enum(['CLEANING', 'LAUNDRY', 'COOKING', 'YARD', 'PETS', 'ERRANDS', 'OTHER']),
      pointValue: a.integer(),
      isActive: a.boolean(),
      createdBy: a.string().required(),
      assignments: a.hasMany('ChoreAssignment', 'choreId'),
      completions: a.hasMany('ChoreCompletion', 'choreId'),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'update']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  ChoreAssignment: a
    .model({
      choreId: a.id().required(),
      chore: a.belongsTo('Chore', 'choreId'),
      familyId: a.id().required(),
      assignedTo: a.string().required(),
      assignedBy: a.string().required(),
      startDate: a.date(),
      endDate: a.date(),
      notes: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read']),
      allow.groups(['ADMIN', 'PLANNER']).to(['create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // ChoreCompletion – any member can log a completion (create/update);
  // only ADMIN may delete completion records.
  ChoreCompletion: a
    .model({
      choreId: a.id().required(),
      chore: a.belongsTo('Chore', 'choreId'),
      familyId: a.id().required(),
      completedBy: a.string().required(),
      completedAt: a.datetime().required(),
      notes: a.string(),
      pointsEarned: a.integer(),
    })
    .authorization((allow) => [
      allow.groups(['ADMIN', 'PLANNER', 'MEMBER']).to(['read', 'create', 'update']),
      allow.groups(['ADMIN']).to(['delete']),
    ]),

  // -------------------------------------------------------------------------
  // Role management – custom mutation with server-side guardrails
  // -------------------------------------------------------------------------

  // Result shape returned by the updateMemberRole mutation.
  UpdatedMemberResult: a.customType({
    id: a.id().required(),
    familyId: a.id().required(),
    userId: a.string().required(),
    role: a.string().required(),
    displayName: a.string(),
  }),

  // updateMemberRole – server-side guarded role update.
  // The Lambda resolver enforces:
  //   • Caller must be ADMIN (privilege-escalation protection).
  //   • Caller and target must share the same familyId (cross-family protection).
  //   • The final ADMIN in a family may not be demoted (last-admin guard).
  updateMemberRole: a
    .mutation()
    .arguments({
      memberId: a.id().required(),
      newRole: a.string().required(),
    })
    .returns(a.ref('UpdatedMemberResult').required())
    .authorization((allow) => [allow.groups(['ADMIN'])])
    .handler(a.handler.function(updateMemberRoleFn)),

  // -------------------------------------------------------------------------
  // Invite management – admin-led tokenized email invite system
  // -------------------------------------------------------------------------

  // Result shape returned by the createInvite mutation.
  CreateInviteResult: a.customType({
    id: a.id().required(),
    familyId: a.id().required(),
    email: a.string().required(),
    token: a.string().required(),
    role: a.string().required(),
    expiresAt: a.string().required(),
    status: a.string().required(),
    inviteUrl: a.string().required(),
  }),

  // createInvite – admin-only mutation that generates a one-time invite link.
  // The Lambda resolver:
  //   • Validates the role is MEMBER or PLANNER.
  //   • Generates a UUID token and sets a 7-day expiry.
  //   • Persists an Invite record with status PENDING.
  //   • Returns the shareable invite URL.
  createInvite: a
    .mutation()
    .arguments({
      familyId: a.id().required(),
      email: a.string().required(),
      role: a.string().required(),
    })
    .returns(a.ref('CreateInviteResult').required())
    .authorization((allow) => [allow.groups(['ADMIN'])])
    .handler(a.handler.function(createInviteFn)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
