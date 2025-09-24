export enum OrderStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED', //soft delete
}

export enum ProductStatus {
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  IN_STOCK = 'IN_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  PREORDER = 'PREORDER',
  DISCONTINUED = 'DISCONTINUED',
}

export enum PaymentType {
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  SSL_COMMERCE = 'SSL_COMMERCE',
  CARD = 'CARD',
}
