# Guest Bookings & Rent Income

How guest stays are recorded and how they turn into rent income on a
property's transaction ledger. Replaces the manually-maintained booking
spreadsheet.

## Adding a guest

1. From any property page, open the **Bookings** tab and click
   **Manage guests →** (or go directly to `/property/guests/`).
2. Click **Add Guest** and fill in name, email, and phone. Email/phone are
   optional — useful for repeat guests you don't have contact info for yet
   (e.g. a walk-up booking).
3. A guest is shared across all properties — if the same person books two
   different properties, they only need to be added once.

## Adding a booking

1. On the property's detail page, open the **Bookings** tab and click
   **Add Booking**.
2. Pick the guest (or follow the "Add a new guest" link if they aren't in
   the system yet), then fill in:
   - **Source** — AirBnB, VRBO, Direct, Houfy, Facebook, Friend, Repeat, or
     Other. This becomes part of the transaction description.
   - **Start date / End date** — nights and per-night price are calculated
     automatically from these two dates and the total cost; there's nothing
     to compute by hand.
   - **Total cost** — the full amount for the stay.
3. **Deposit & Balance fields are for Direct bookings only.** Platform
   bookings (AirBnB/VRBO/Houfy) handle their own payment collection, so
   leave these blank unless **Source = Direct**.

## How the rent income sync works

Saving a booking automatically creates a matching transaction on the
property's **Transactions** tab — there is no separate step to log the
income.

- **Category:** `Rent Income`
- **Amount:** the booking's total cost
- **Description:** `{Source} - {Guest Name}` (e.g. `VRBO - Sarah Bradley`)
- **Date:** the booking's start date

**Editing** a booking (changing the cost, dates, source, or guest) updates
that same transaction in place — it does not create a duplicate.

**Deleting** a booking also deletes its linked transaction, so the income
disappears from the ledger along with the booking. There's no orphaned
transaction left behind to clean up.

## Where this shows up

Both views below are behind login — only accounts you've created (you and
your wife) can see them. Renters never see any part of this app; "guest"
here just refers to the person renting the property, not a role in the
system.

- **Bookings tab** — your internal record of who's staying, when, at what
  nightly rate, and (for Direct bookings) whether the deposit/balance has
  been collected.
- **Transactions tab** — the accounting view used for YTD income/expense
  totals. Booking-driven income appears here automatically, filterable by
  year/month like any other transaction.
