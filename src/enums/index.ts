export enum Availability {
  IN_STOCK = 'in-stock',
  UPCOMING = 'upcoming',
  PRE_ORDER = 'pre-order',
}

export enum ResponseStatus {
  Ok = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  InternalServerError = 500,
}
