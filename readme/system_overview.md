# Igra Project: Complete System Overview

This document serves as a comprehensive overview of 100% of the features and systems built into the Igra platform up to this point, detailing both the **Frontend** (`Igra_fe`) and **Backend** (`Igra`) architectures.

---

## 1. Authentication & Users
- **JWT Based Auth:** Users can register, log in, and auto-refresh sessions using short-lived access tokens and httpOnly refresh cookies.
- **User Roles:** Normal users (`user`), staff (`staff`), and admins (`admin`). Middleware restricts access appropriately.
- **Profile Data:** Users hold an internal `_id`, a `legacyMongoId` (from migration), basic profile info (`name`, `email`), and preferences. Role checking happens actively on route guards.

---

## 2. Credit Core & Ledger System (The Wallet)
A robust internal economy was developed, moving away from direct billing-per-action to a prepaid Credit model.
- **CreditWallet Model:** Every user gets a `CreditWallet` document representing their precise balance.
- **CreditLedgerEntry:** A double-entry accounting ledger tracks *every* transaction. Reasons include `ORDER_CAPTURE`, `PACK_PURCHASE`, `REFUND`, `MANUAL_ADJUSTMENT`, and `PROMO`.
- **Idempotency:** Strict idempotency checks exist when debits occur to prevent double-charging (e.g., refreshing a submit order page).
- **Backend API:** `/api/v1/credits` provides endpoints to view balance and ledger history in realtime.

---

## 3. Order Management Pipeline
The most complex subsystem, managing multi-step service fulfillment.
- **Order Flow:** DRAFT -> UNDER_REVIEW -> IN_PROGRESS -> AWAITING_APPROVAL -> COMPLETED (or FAILED/CANCELLED).  
- **Order Model:** Groups multiple `OrderItem`s together, holds total credited quotes, capture amounts, and assigns processing admins/staff.
- **OrderItem Model:** Represents individual service packages (e.g., `VIDEO_EDIT`, `THUMBNAIL`, `SCRIPT`, etc.). Tracks sub-status (`PENDING_INPUT`, `READY`, `IN_PROGRESS`, `DELIVERED`, `APPROVED`). Supports allowed and used revisions.
- **Dynamic Pricing Configuration:** Service catalog (`serviceCatalog.ts`) dynamically estimates and exact-quotes credits based on variables (e.g., length of video edit, whether raw footage requires b-roll).
- **Order Event Auditing ('Timeline'):** `OrderEvent` and `ItemEvent` Models record exactly when state changes happen (e.g., "ASSETS_ADDED", "DELIVERED"), tracking the "Who" and "When", complete with nested JSON metadata shown in a rich timeline UI on the frontend.

---

## 4. Asset Handling & Multipart Uploads
- **Direct-to-S3 Multipart Uploads:** Upload logic streams large video/image files directly to buckets using AWS S3 `@aws-sdk/s3-request-presigner` endpoints.
- **Local Stubbing:** For local development without AWS creds, it safely "stubs" S3 presigned URLs, returning mock paths.
- **Asset / AssetVersion / AssetLink:**
  - `Asset` objects define the file itself (original name, mime, bytes).
  - `AssetLink` joins the asset to an `OrderItem` in a specific role (`INPUT` from the user or `OUTPUT` delivered from the admin).
- **Guaranteed Order Sequence:** Added an explicit `orderIndex` to `AssetLink` schemas. Whenever the user multipicks files, the system stores and delivers them back in that *exact* original sequential order. Later appends maintain chronological indexes.

---

## 5. Billing & PayPal Integration
- **Sandbox Processing:** Standard `@paypal/checkout-server-sdk` integrates server-to-server with PayPal for Credit Pack purchases.
- **Billing Controller:** Exposes `/api/v1/billing` to create a purchase, yielding a `approveLink` URL used by the frontend to redirect out.
- **Capture Hook:** Frontend intercepts `paypalFlow=true` returns, and hits the backend to capture the funds, immediately injecting `creditsPurchased` securely via the CreditLedger.
- **Invoices Repository:** Models like `Payment` log all transaction data. The user has an "Invoices" dashboard listing their past receipts.
- **Webhooks:** `verifyPaypalWebhook.ts` safely logs webhook dispatches and intercepts status changes.

---

## 6. Frontend UI (React + Vite)
- **Design Aesthetic:** Deep "Glassmorphism" Dark Mode with vibrant neon accents (vibrant primary colors, modern typography, lucide-react icons, and subtle hover animations).
- **Dashboards:** 
  - Main Dashboard stats reflect *real* MongoDB aggregations of the user's active/completed operations.
  - Interactive status chips render order flow state seamlessly.
- **Order Creation Flow:** Multi-step wizard wizarding through generic Service catalog choices, finalizing parameters, providing immediate precise credit cost estimations, followed by file drops.
- **Orders Detail Interface:**
  - Tabbed design for Items, Assets, Chat, and Timeline History.
  - Timeline parses and displays internal backend event data dynamically.
  - A responsive persistent "Upload New Asset" component appended dynamically to ongoing order items.
- **Credits & Billing UI:** Dedicated pages render "Credit Packages" highlighting 'Popular' choices, and parsing ledger histories into readable tables comparing deltas and resultant balances.

---

## 7. Realtime Websockets (Chat)
- **Socket.io Core:** An event-driven Express WebSocket engine lives parallel to standard `httpServer`.
- **Order Chat Rooms:** Users and admins can join isolated "Rooms" via their `orderId` (`socket.join('order:' + id)`), facilitating live messaging for specific orders without refreshing the page. Messages update instantly.

---

## 8. Admin Interfacing Tools
A segmented path `/api/v1/admin` fully implements all requirements to drive a separate standalone Admin Portal UI.
- Fetches aggregate system-wide stats.
- Delivers orders, refunds ledgers directly, issues specific revisions.
- Complete API schema has been explicitly defined in `admin_portal_api_reference.md` to hand to the Admin-portal developer.
