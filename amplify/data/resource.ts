import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Profile: a
    .model({
      userId: a.id().required(),
      email: a.string().required(),
      displayName: a.string(),
      role: a.enum(['ADMIN', 'PLANNER', 'MEMBER']),
    })
    .authorization((allow) => [
      allow.ownerDefinedIn('userId').to(['read', 'update']),
      allow.group('ADMIN'),
      allow.authenticated().to(['read']),
    ]),

  Vacation: a
    .model({
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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

  ExcursionVote: a
    .model({
      excursionOptionId: a.id().required(),
      excursionOption: a.belongsTo('ExcursionOption', 'excursionOptionId'),
      userId: a.string().required(),
      vote: a.enum(['UP', 'DOWN']),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

  ExcursionComment: a
    .model({
      excursionOptionId: a.id().required(),
      excursionOption: a.belongsTo('ExcursionOption', 'excursionOptionId'),
      userId: a.string().required(),
      comment: a.string().required(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

  TripPlan: a
    .model({
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
      allow.group('ADMIN'),
      allow.group('PLANNER').to(['read', 'create', 'update']),
      allow.authenticated().to(['read']),
    ]),

  Property: a
    .model({
      name: a.string().required(),
      address: a.string(),
      type: a.string(),
      transactions: a.hasMany('PropertyTransaction', 'propertyId'),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
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
      allow.group('ADMIN'),
    ]),

  Recipe: a
    .model({
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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  Car: a
    .model({
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
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

  CarService: a
    .model({
      carId: a.id().required(),
      car: a.belongsTo('Car', 'carId'),
      serviceType: a.string().required(),
      description: a.string(),
      mileageAtService: a.integer(),
      date: a.date().required(),
      cost: a.float(),
      provider: a.string(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),

  Chore: a
    .model({
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
      allow.group('ADMIN'),
      allow.group('PLANNER').to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  ChoreAssignment: a
    .model({
      choreId: a.id().required(),
      chore: a.belongsTo('Chore', 'choreId'),
      assignedTo: a.string().required(),
      assignedBy: a.string().required(),
      startDate: a.date(),
      endDate: a.date(),
      notes: a.string(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.group('PLANNER').to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  ChoreCompletion: a
    .model({
      choreId: a.id().required(),
      chore: a.belongsTo('Chore', 'choreId'),
      completedBy: a.string().required(),
      completedAt: a.datetime().required(),
      notes: a.string(),
      pointsEarned: a.integer(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.group('PLANNER').to(['read', 'create', 'update', 'delete']),
      allow.ownerDefinedIn('completedBy').to(['create', 'read']),
      allow.authenticated().to(['read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
