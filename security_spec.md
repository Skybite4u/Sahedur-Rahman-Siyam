# Security Specification (TDD Rules Validation)

This security specification details the authorization models, role-based controls (RBAC), and validation blueprints designed for the Developer Portfolio & Social Feed App.

## 1. Data Invariants & Zero-Trust Integrity Rules

1.  **Identity Lock**: A user can never write a post or comment pretending to be someone else. `authorId` must match `request.auth.uid`.
2.  **Verified Email Mandate**: To prevent bot profiles or dummy accounts, callers attempting to post/comment/update profiles must have verified emails, *except* during the onboarding signup process where they register their user document.
3.  **Immutable Fields**: `createdAt`, `authorId`, and `authorEmail` can never be edited after a post or comment is created.
4.  **Admin Empowerment Rule**: The user with email `siyamrahman1268@gmail.com` is the absolute System Admin. Once authenticated under this identity, they bypass author ownership checks and can moderatingly edit or delete ANY posts or comments in the system.
5.  **Size & Formatting Limits**: All fields must satisfy explicit string sizes to avoid Denial of Wallet and structural bloating (e.g. `content` must be <= 1000 characters).

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Models)

The following 12 payloads represent attacks that our `firestore.rules` will strictly prevent and return `PERMISSION_DENIED` for.

### 1. Identity Spoofing during Post creation
*   **Attack**: User `attacker_uid` tries to create a post with `authorId: "siyam_uid"` to defame Siyam.
*   **Result**: `PERMISSION_DENIED` (authorId mismatch).

### 2. Privilege Escalation during Signup
*   **Attack**: User `normal_user` signs up and attempts to write `/users/normal_uid` with `"role": "admin"`.
*   **Result**: `PERMISSION_DENIED` (Standard registration must set role to `user`).

### 3. Modifying Someone Else's Post
*   **Attack**: Authenticated User B attempts to change the content of User A's post: `/posts/post_a` with a malicious payload.
*   **Result**: `PERMISSION_DENIED` (Not original author or admin).

### 4. Admin Role Stealing
*   **Attack**: A malicious user attempts to update their own profile to make themselves an admin: `role: "admin"`.
*   **Result**: `PERMISSION_DENIED` (role modification blocked for self-update).

### 5. Denial of Wallet via Giant Post Payload
*   **Attack**: Posting a status containing 10MB of random characters to exhaust database space and read bandwidth.
*   **Result**: `PERMISSION_DENIED` (exceeds `.size() <= 2000` limit).

### 6. Poisoning Numeric Counters
*   **Attack**: User tries to increment `lovesCount` directly by +9999 in a single update.
*   **Result**: `PERMISSION_DENIED` (`lovesCount` logic validation matches actual active array size change).

### 7. Spoofing Siyam's Admin Identity via Email String
*   **Attack**: User logs in with `email_verified == false` but with Siyam's email, trying to perform admin deletes.
*   **Result**: `PERMISSION_DENIED` (checks `email_verified == true`).

### 8. Orphaned Comment Creation
*   **Attack**: Creating `/posts/nonexistent_post/comments/comment_1` to flood orphaned subcollections.
*   **Result**: `PERMISSION_DENIED` (relational exists-check for parent post fails).

### 9. Mutating Immortal Dates
*   **Attack**: Changing `createdAt` timestamp of an existing post retroactively to show up as "newer".
*   **Result**: `PERMISSION_DENIED` (mutating immutable field).

### 10. Blank Content Poisoning
*   **Attack**: Writing an empty string post or spaces-only string to the database.
*   **Result**: `PERMISSION_DENIED` (content size must be >= 1).

### 11. Bypassing Validation with Unknown Fields (Shadow Writing)
*   **Attack**: Writing a post containing undocumented keys like `injectedExploitScript: "<script>..."`.
*   **Result**: `PERMISSION_DENIED` (strict keys check fails).

### 12. Deleting Admin's Posts
*   **Attack**: Standard user attempts to delete an announcement post written by Siyam (`siyamrahman1268@gmail.com`).
*   **Result**: `PERMISSION_DENIED` (only author or verified admin can delete posts).
