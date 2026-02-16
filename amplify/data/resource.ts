import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Vacation: a
    .model({
      title: a.string().required(),
      description: a.string(),
      startDate: a.date().required(),
      endDate: a.date().required(),
      transportation: a.enum(['flight', 'car', 'boat']),
      accommodations: a.string(),
      createdBy: a.string().required(),
    })
    .authorization((allow) => [
      allow.authenticated(),
    ]),

  Activity: a
    .model({
      vacationId: a.id().required(),
      vacation: a.belongsTo('Vacation', 'vacationId'),
      name: a.string().required(),
      description: a.string(),
      date: a.date(),
      location: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
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
      allow.authenticated(),
    ]),

  Property: a
    .model({
      name: a.string().required(),
      address: a.string(),
      type: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
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
      allow.authenticated(),
    ]),

  Car: a
    .model({
      make: a.string().required(),
      model: a.string().required(),
      year: a.integer().required(),
      vin: a.string().required(),
      currentMileage: a.integer(),
      color: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated(),
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
      allow.authenticated(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
