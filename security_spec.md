# Security Specification - SmartAcc

## Data Invariants
1. A user profile must have a valid UID matching the authenticated user.
2. Only Admins can modify other users' roles or subscription status.
3. Activity logs are append-only for standard users (though the app currently uses `setDoc` which implies creation).
4. Global announcements can only be modified by Admins.
5. User databases are private to the owner and Admins.

## The "Dirty Dozen" Payloads (Unauthorized Attempts)

1. **Identity Spoofing**: User A attempts to create/update a profile for User B.
2. **Privilege Escalation (Self)**: Standard user attempts to set `role: 'Admin'` on their own profile.
3. **Privilege Escalation (Other)**: Standard user attempts to set `isPro: true` on another user's profile.
4. **Global Setting Hijack**: Non-admin attempts to update `/settings/announcement`.
5. **Data Scraping**: Authenticated user attempts to list all documents in `/user_databases`.
6. **Cross-User Data Access**: User A attempts to read User B's document in `/user_databases/UserB`.
7. **Cross-User Data Modification**: User A attempts to write to User B's document in `/user_databases/UserB`.
8. **Resource Poisoning (ID)**: Attempting to create a user with a 2KB junk string as UID.
9. **Resource Poisoning (Data)**: Attempting to set `displayName` to a 1MB string.
10. **Log Tampering**: Non-admin attempts to update or delete an existing entry in `activity_logs`.
11. **Unverified Auth**: User with an unverified email attempts to write data.
12. **Shadow Fields**: Attempting to add an `isAdmin: true` field to a `UserProfile` document which is not in the schema.

## Test Cases (Expected Denial)

| Payload ID | Target Path | Operation | Reason for Denial |
|------------|-------------|-----------|-------------------|
| 1 | /users/UserB | write | auth.uid (UserA) != userId (UserB) |
| 2 | /users/UserA | update | affectedKeys() contains 'role' and not Admin |
| 3 | /users/UserB | update | not Admin |
| 4 | /settings/announcement | write | not Admin |
| 5 | /user_databases | list | No blanket reads allowed |
| 6 | /user_databases/UserB | get | auth.uid != userId and not Admin |
| 7 | /user_databases/UserB | write | auth.uid != userId and not Admin |
| 8 | /users/[long_id] | write | isValidId() size limit |
| 9 | /users/UserA | write | isValidUserProfile() size limit |
| 10 | /activity_logs/LogA | update | Not allowed for non-admins (or restricted to append-only) |
| 11 | Any | write | email_verified != true |
| 12 | /users/UserA | write | hasOnly() check |
