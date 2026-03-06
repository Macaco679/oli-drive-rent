

## Problem

The `oli_payment_status` enum in the database only has: `pending`, `paid`, `failed`, `refunded`, `confirmed`. But Asaas sends `received` (and a typo `receveid`) for PIX payments. These values are not in the enum, so they either fail to insert or get ignored by the frontend code.

The screenshot shows `received` and `receveid` as values in the dropdown -- these are likely stored as raw text or the enum was manually extended. The frontend `PaymentStatus` type doesn't include `received`, so those payments are treated as "no payment" and the timeline stays locked.

## Plan

### 1. Add `received` to the database enum

Run a migration to add `received` to `oli_payment_status`:

```sql
ALTER TYPE public.oli_payment_status ADD VALUE IF NOT EXISTS 'received';
```

This covers the Asaas PIX "received" status. The `receveid` typo in existing data should be fixed with a data update (UPDATE query).

### 2. Fix existing typo data

Use the insert tool to fix the `receveid` typo:

```sql
UPDATE public.oli_payments SET status = 'received' WHERE status::text = 'receveid';
```

### 3. Update `usePaymentRealtime.ts`

Add `received` to the `PaymentStatus` type and to the `hasPaid` check:

```typescript
export type PaymentStatus = "pending" | "paid" | "confirmed" | "received" | "failed" | "refunded" | null;

const hasPaid = paymentStatus === "paid" || paymentStatus === "confirmed" || paymentStatus === "received";
```

### 4. Update `InspectionTimeline.tsx`

Add `received` to the `mapPaymentToTimeline` switch so it maps to `"done"` (green):

```typescript
case "paid":
case "confirmed":
case "received":
  return "done";
```

### 5. Verify the next step unlocks

The existing logic already promotes the next step (`renter_pickup`) to `"current"` when `paymentDone` is `true`. With `received` now included in `hasPaid`, this will work automatically.

## Summary of changes

| File / Resource | Change |
|---|---|
| DB migration | Add `received` to `oli_payment_status` enum |
| DB data fix | Fix `receveid` typo to `received` |
| `usePaymentRealtime.ts` | Add `received` to type and `hasPaid` logic |
| `InspectionTimeline.tsx` | Add `received` to green/done mapping |

