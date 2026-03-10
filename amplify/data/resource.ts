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
      activities: a.hasMany('Activity', 'vacationId'),
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

  PropertyTransaction: a
    .model({
      propertyId: a.id().required(),
      property: a.belongsTo('Property', 'propertyId'),
      type: a.enum(['income', 'expense']),
      amount: a.float().required(),
      description: a.string(),
      date: a.date().required(),
      category: a.string(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
    ]),

  Car: a
    .model({
      make: a.string().required(),
      model: a.string().required(),
      year: a.integer().required(),
      vin: a.string().required(),
      currentMileage: a.integer(),
      color: a.string(),
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
      mileage: a.integer(),
      date: a.date().required(),
      cost: a.float(),
      serviceProvider: a.string(),
    })
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.authenticated().to(['read', 'create', 'update']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
