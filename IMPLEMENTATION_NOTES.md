# PUSH – hierarchy and contribution upgrade

Implemented:
- University → Faculty → Course → Posts navigation for public users.
- Same drill-down structure in the admin area.
- Course search by Arabic name or course number/code.
- Course number/code is required for all newly created courses.
- Regular users can submit new course requests and course content; both require admin approval.
- Publication log visible only through admin/owner APIs.
- Each user account has a publication history.
- Published content can be edited/deleted by its creator for 6 hours from publication/creation; afterward the UI directs the user to contact administration.
- Gear/settings entry points for account information and addition actions.
- Approved submissions are linked to their creator (`materials.created_by`) for ownership and audit history.

Supabase:
Run `supabase/schema.sql` for a complete schema, or run the focused migration:
`supabase/migrations/20260926_hierarchy_contributions.sql`

Note: the local environment did not have a complete dependency installation, so a full Next.js production build could not be executed here. The source changes were checked structurally; run `npm install` and `npm run build` in the deployment environment before publishing.
