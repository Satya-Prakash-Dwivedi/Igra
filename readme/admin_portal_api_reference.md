# Igra Admin Portal API Reference

This document outlines the REST API endpoints available for the Igra Admin Portal. 
Base URL for all admin routes: `/api/v1/admin`

All requests must include an Authorization header with a valid Bearer token for an Admin or Staff user.
`Authorization: Bearer <JWT_TOKEN>`

---

## 1. Dashboard Statistics
Fetch aggregate statistics for the admin dashboard.

**Endpoint:** `GET /dashboard`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "pendingReview": 12,
    "inProgress": 45,
    "completed": 80
  }
}
```

---

## 2. List All Orders
Retrieve a paginated list of all orders in the system.

**Endpoint:** `GET /orders`

**Query Parameters:**
- `status` (optional): Filter by OrderStatus (e.g. `UNDER_REVIEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "60d5ecb8b392...",
        "orderNumber": "ORD-12345",
        "userId": {
          "_id": "...",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "assignedTo": null,
        "title": "My Video Project",
        "status": "UNDER_REVIEW",
        "totalCreditsQuoted": 150,
        "totalCreditsCaptured": 150,
        "createdAt": "2026-03-24T10:00:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "pages": 8
  }
}
```

---

## 3. Review Order (Accept / Reject)
Review a submitted order (currently in `UNDER_REVIEW` status).

**Endpoint:** `PATCH /orders/:id/review`

**Request Body:**
```json
{
  "action": "ACCEPT" // Can be "ACCEPT", "REJECT", or "REQUEST_INFO"
}
```
*Note: Rejecting an order will transition it to `CANCELLED` and automatically refund the user's credits.*

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ec...",
    "status": "IN_PROGRESS",
    "...": "..."
  }
}
```

---

## 4. Assign Order
Assign an order to a specific staff member.

**Endpoint:** `PATCH /orders/:id/assign`

**Request Body:**
```json
{
  "staffId": "60b91a2..." // The user ID of the staff/admin member
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ec...",
    "assignedTo": "60b91a2...",
    "...": "..."
  }
}
```

---

## 5. Transition Item Status
Update the status of a specific item within an order (e.g., from `READY` to `IN_PROGRESS`).

**Endpoint:** `PATCH /orders/:oid/items/:iid/status`

**Path Variables:**
- `oid`: Order ID
- `iid`: Order Item ID

**Request Body:**
```json
{
  "status": "IN_PROGRESS" // Needs to be a valid OrderItemStatus
}
```
*Valid Statuses: `PENDING_INPUT`, `BLOCKED`, `READY`, `IN_PROGRESS`, `DELIVERED`, `APPROVED`, `FAILED`, `CANCELLED`*

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "status": "IN_PROGRESS",
    "...": "..."
  }
}
```

---

## 6. Deliver Item
Mark an item as successfully completed and delivered. This notifies the user that their item is ready for review/approval.

**Endpoint:** `POST /orders/:oid/items/:iid/deliver`

**Path Variables:**
- `oid`: Order ID
- `iid`: Order Item ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "status": "DELIVERED",
    "...": "..."
  }
}
```

---

## 7. Refund Failed Item
Refund the user for a specific item that failed to be completed. **Important:** The item MUST be transitioned to the `FAILED` status prior to issuing a refund.

**Endpoint:** `POST /orders/:oid/items/:iid/refund`

**Path Variables:**
- `oid`: Order ID
- `iid`: Order Item ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "status": "FAILED",
    "creditsQuoted": 100,
    "...": "..."
  }
}
```
*Note: A CreditLedgerEntry of `REFUND` reason will automatically be generated in the user's wallet.*
