# Bug: Car Delete Does Not Remove Record

- ID: TR-55-CAR-DELETE
- Status: Open
- Area: Cars module
- Priority: High (causes persistent test data and failing E2E assertions)

## Summary

Deleting a car from the Cars module shows the confirmation dialog and accepts `OK`, but the car card remains visible afterward.

## Environment

- URL: https://main.d1gak7oijss0a0.amplifyapp.com/
- Browser: Chromium (Playwright)
- Test: `e2e/tests/cars.spec.ts` (`Cars - Deleting a car removes it from the list`)

## Steps to Reproduce

1. Sign in as a valid user.
2. Open Cars module from dashboard.
3. Create a new car.
4. Click `Delete` on that car and accept the confirmation dialog.
5. Observe the same car card still present in the list.

## Expected

The car record is deleted and no longer appears in the list after confirmation.

## Actual

The car remains visible after delete confirmation and refresh window.

## Impact

- E2E delete test fails.
- Test-created car records accumulate across runs.
- Potential data integrity issue for end users.

## Notes

- E2E cleanup now attempts best-effort deletion by VIN after tests, but full cleanup depends on this bug being fixed.
