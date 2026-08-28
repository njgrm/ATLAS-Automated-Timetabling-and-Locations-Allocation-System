# Prompt UX-05 — Public Simplicity and Cross-Role Consistency

## Objective

Make public schedule lookup immediate and close remaining identity/copy drift across roles.

## Target Routes

- `/public/schedules`, redirects, shared status and schedule components, and compatibility surfaces.

## Implementation Directive

1. Default public lookup to section/class search with one search field and clear recent or common results when available.
2. Place teacher and room lookup behind “Search another way” instead of presenting three equal modes initially.
3. Remove internal terms such as run, draft, revision, violation, and generation from public copy.
4. Ensure unpublished, unavailable, stale, empty, and network failure states provide a clear next action.
5. Normalize status language, badges, page titles, spacing, focus states, and school branding across scheduler, faculty, and public surfaces.
6. Confirm public pages do not require authentication and expose only published schedule truth.
7. Decide, with approval, whether compatibility-only `SpecializationMapping.tsx` and duplicate map experiences should be retired, merged, or documented as non-product surfaces.

## Exit Gate

GO when an unauthenticated user can find a section schedule in under three interactions, the default route contains no internal scheduling jargon, and shared identity checks pass across all roles.
