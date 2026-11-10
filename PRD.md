# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Peptides Bali Online — Complete WordPress to Next.js Migration

**Project URL:** https://peptidesbali.online/  
**Existing Platform:** WordPress + WooCommerce + AffiliateWP  
**Target Platform:** Next.js + Sanity CMS + PostgreSQL  
**Deployment:** Vercel  
**Project Type:** 100% Design, Content, Feature, and Data Migration  
**Design Changes Allowed:** NONE without explicit approval

---

# 1. ROLE AND PRIMARY OBJECTIVE

You are a senior full-stack Next.js developer, UI/UX reverse-engineering specialist, WordPress migration engineer, database architect, and QA engineer.

Your task is to migrate the existing WordPress website:

https://peptidesbali.online/

into a fully functional Next.js application using Sanity CMS for content and product management.

**THIS IS NOT A REDESIGN PROJECT. THIS IS A 100% REPLICATION AND MIGRATION PROJECT.**

The existing website is the single source of truth for visual design, content, layout, interactions, and business functionality.

Do not introduce your own design preferences.

Do not simplify or remove existing functionality.

Do not replace the current design with a generic e-commerce template.

The final Next.js website must look and behave as closely as technically possible to the existing WordPress website.

## Primary Objectives

1. Replicate the existing frontend design with pixel-level fidelity.
2. Preserve all existing public pages and their content.
3. Replicate all existing functional e-commerce features.
4. Replace WooCommerce functionality with a secure transactional backend.
5. Rebuild the existing AffiliateWP functionality without losing existing affiliate data.
6. Use Sanity Studio as the primary CMS for products and website content.
7. Preserve SEO, URLs, images, and structured data.
8. Make WordPress removable after a successful migration.
9. Maintain a clean, beginner-friendly Next.js codebase.
10. Produce documentation explaining the implementation.

## Non-Negotiable Rules

- Do not change branding, colors, typography, or spacing intentionally.
- Do not rewrite, summarize, translate, or improve existing content.
- Do not substitute existing images with stock images or AI-generated images.
- Do not remove existing pages, features, forms, or interactions.
- Do not replace functional features with visual-only mockups.
- Do not use dummy products, fake orders, or fake affiliate earnings in the production application.
- Do not assume a feature is absent simply because it cannot be accessed publicly.
- Do not deploy to the live domain without explicit approval.
- Do not modify the production WordPress database during the audit.
- Never claim the migration is complete until all functional and visual acceptance tests pass.

If a feature cannot be reproduced immediately, document the blocker and implement it only after its behavior has been verified.

---

# 2. REQUIRED DISCOVERY AND AUDIT

Before writing production code, perform a comprehensive audit of the existing WordPress website.

Use the available browser, terminal, code inspection tools, WordPress exports, and authorized API access.

If the environment provides browser automation tools, use them to inspect the website visually and functionally.

If the necessary tools or permissions are unavailable, explicitly document what cannot be inspected. Do not fabricate audit results.

## 2.1 Public Website Audit

Crawl and inspect all accessible pages.

Discover pages through:

- Main navigation
- Footer navigation
- Sitemap XML
- WordPress REST API where accessible
- Product categories
- Product detail pages
- Blog archives
- Pagination
- Search results
- Customer account pages
- Affiliate registration and login pages
- Affiliate program information
- Rewards and loyalty pages
- Legal and policy pages
- Other accessible internal links

Create a complete URL inventory.

For every page, record:

- Original URL
- Page type
- Page title
- Meta title and description
- Canonical URL
- H1–H6 structure
- Full content
- Images and media
- Header and footer variations
- Breadcrumbs
- Forms
- Buttons and links
- Dynamic components
- Interactive behavior
- Mobile behavior
- SEO structured data

Store the inventory in:

`docs/audit/page-inventory.md`

Do not begin implementation until the initial inventory has been documented.

## 2.2 Visual Design Audit

Inspect the live website at desktop, tablet, and mobile widths.

Suggested baseline viewports:

- Desktop: 1440px
- Laptop: 1280px
- Tablet: 768px
- Mobile: 390px
- Small mobile: 375px

For every unique page template, capture reference screenshots and measure:

- Layout widths
- Container sizes
- Section heights
- Margins and padding
- Grid and column structures
- Font families and weights
- Font sizes and line heights
- Exact colors
- Background images
- Border styles and radii
- Shadows
- Buttons and hover states
- Navigation behavior
- Sticky elements
- Animation timing
- Mobile menu behavior
- Product cards
- Cart and checkout layouts
- Form styles
- Responsive breakpoints

Identify and reuse the existing website assets wherever their use is authorized.

Save visual reference notes under:

`docs/audit/visual-reference/`

Create a design token file from observed values.

Never invent visual tokens when the original values can be inspected.

## 2.3 Interaction Audit

Document and test every interactive feature:

- Main menu and dropdowns
- Mobile menu
- Product filtering and sorting
- Product variant selection
- Quantity controls
- Add to cart
- Cart updates
- Coupon application
- Checkout
- Customer registration
- Customer login
- Password reset
- Affiliate registration
- Affiliate login
- Referral URL generation
- Affiliate dashboard
- Affiliate link sharing
- Product COA links
- WhatsApp actions
- Forms
- Popups and modals
- Loyalty and rewards features, if active

Inspect hover, focus, loading, success, and error states.

Do not assume that copying the visual elements means functionality has been migrated.

---

# 3. WORDPRESS AND WOOCOMMERCE AUDIT

Inspect the existing WordPress installation using authorized access.

Read-only auditing must be the default.

Do not change settings, install plugins, generate credentials, or update live data without permission.

## Required WooCommerce Audit

Determine:

1. Total published products
2. Product types
3. Product variations
4. Product attributes
5. Product categories
6. Product tags
7. SKU structure
8. Pricing and sale pricing
9. Inventory behavior
10. Shipping methods
11. Payment methods
12. Tax configuration
13. Coupon rules
14. Customer accounts
15. Order statuses
16. Refund procedures
17. Email notifications
18. Checkout customizations
19. WooCommerce extensions
20. External integrations

Determine whether existing orders contain custom metadata required by other plugins.

Inspect whether there are subscriptions, recurring payments, product bundles, custom checkout fields, or other specialized order types.

Create:

`docs/audit/woocommerce-audit.md`

Produce an implementation mapping:

| Existing WordPress Feature | Data Source | Next.js Implementation | Migration Method | Status |
|---|---|---|---|---|

Do not invent payment integrations or claim payment compatibility without verification.

---

# 4. AFFILIATEWP AUDIT — CRITICAL REQUIREMENT

The existing website uses AffiliateWP.

The affiliate system is a critical business feature and must be preserved.

You must investigate the existing AffiliateWP configuration before designing the replacement.

## 4.1 Confirmed Existing Settings

The following settings have been observed in the existing AffiliateWP administration screenshots.

### Affiliate Registration

- Affiliate registration is enabled.
- Affiliate applications require admin approval.
- Affiliate login uses a dedicated page.
- Affiliate registration uses a dedicated page.
- Affiliate accounts have a dedicated Affiliate Area.
- Terms of Use are configured.
- Additional automatic registration modes are disabled.
- Starting Affiliate ID is configured as 8.

The starting ID does not indicate the current number of affiliates.

### Referral Links

- Referral query parameter: `ref`
- Default referral identifier: username
- Pretty affiliate URLs: enabled

Examples:

`https://peptidesbali.online/?ref=username`

`https://peptidesbali.online/ref/username`

These URL formats must remain functional after migration.

### Registration Security

- Google reCAPTCHA v3 is configured.
- CAPTCHA also protects affiliate login.
- Existing CAPTCHA secrets must never be copied into source code or documentation.

### Affiliate Sharing

Enabled options observed:

- Facebook
- Email
- QR code

Disabled options observed:

- LinkedIn
- X/Twitter

### Additional Features

- Affiliate logout link enabled
- Affiliate landing pages disabled
- Global direct link tracking disabled

Individual affiliate settings and add-ons must still be inspected before concluding that direct link tracking is entirely unused.

## 4.2 Additional AffiliateWP Audit

Inspect these settings:

- General
- Commissions
- Payouts
- Integrations
- Emails
- Anti-Fraud
- Advanced
- Coupons
- Affiliate Area Tabs
- Affiliate Portal
- Installed add-ons

Determine the actual configured behavior for:

1. Referral tracking
2. Cookie duration
3. Attribution method
4. Commission percentage
5. Flat-rate or percentage commissions
6. Per-product commission overrides
7. Affiliate-specific rates
8. Affiliate tiers
9. Commission approval
10. Referral rejection
11. Refund handling
12. Coupon attribution
13. Payout processing
14. Manual or automated payouts
15. Affiliate notifications
16. Anti-fraud protection
17. Affiliate profile management
18. Earnings reports
19. Visits tracking
20. Campaign tracking

Do not assume the public affiliate marketing page accurately reflects the current backend settings.

Use the configuration actually saved in AffiliateWP as the source of truth for business logic, subject to owner approval.

## 4.3 Accessing AffiliateWP Data

If authorized API access is provided, investigate the AffiliateWP REST API.

Documented core data resources include:

- Affiliates
- Referrals
- Visits
- Payouts
- Creatives

Core API access is primarily read-only.

Do not assume full CRUD support unless the relevant extension is installed and verified.

If direct API access is insufficient, use authorized WordPress database exports or a dedicated read-only migration script.

Never bypass authentication.

Never require production admin credentials to be committed to the repository.

Do not expose affiliate payment details or personally identifiable data in logs, screenshots, or documentation.

## 4.4 Affiliate Database Migration

Prepare mappings for:

- Original WordPress user ID
- Original AffiliateWP affiliate ID
- Affiliate username
- Affiliate status
- Registration date
- Commission configuration
- Referral URLs
- Visits history
- Referral history
- Earnings history
- Unpaid commissions
- Paid commissions
- Payout history
- Campaign identifiers
- Coupon associations

Preserve historical identifiers where needed for data reconciliation and existing links.

Do not blindly reset affiliate IDs or overwrite existing data.

Create a migration reconciliation report that verifies:

- Total affiliates by status
- Total referrals by status
- Total historical earnings
- Total unpaid commissions
- Total paid commissions
- Total payouts
- Any mismatched records

These financial totals must reconcile before launch.

---

# 5. TARGET TECHNICAL ARCHITECTURE

Use the following architecture.

## Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Existing fonts and assets
- Server Components where appropriate
- Client Components only where interactivity is required

Use a currently supported, security-patched Next.js version compatible with the project and its dependencies.

## CMS

- Sanity CMS
- Sanity Studio
- GROQ
- Sanity image management
- Portable Text where rich text is required
- Preview support
- Webhook-based content revalidation

## Transactional Backend

- Next.js server-side application layer
- PostgreSQL
- Drizzle ORM
- Server-side validation using Zod
- Secure authentication library such as Better Auth
- Payment provider integration through its official API/SDK

If commerce requirements make a custom transactional engine unnecessarily complex, document the trade-offs and propose an established commerce backend before implementation.

Do not silently introduce an additional platform.

## File Storage

Use Sanity for CMS-managed images and documents where appropriate.

Use private object storage for sensitive operational documents if required.

## Hosting

- Next.js: Vercel
- Sanity: Sanity Cloud
- PostgreSQL: Neon or Supabase
- Email: Provider selected after audit

## Important Architecture Rule

Sanity is the source of truth for editable product content.

PostgreSQL is the source of truth for:

- User authentication
- Shopping carts
- Orders
- Payment records
- Inventory movements
- Affiliate financial records
- Commission balances
- Payouts
- Reward balances, if active

Do not store payment or commission ledgers solely inside Sanity.

---

# 6. SANITY CMS REQUIREMENTS

Sanity Studio must provide an intuitive administration experience similar in capability to a typical WordPress content management interface.

Create the following document types where the existing website requires them.

## Product Schema

Fields:

- Product name
- Original WordPress ID
- Slug
- SKU reference
- Description
- Short description
- Product images
- Gallery
- Category references
- Tag references
- Product attributes
- Variation references
- Product specifications
- COA documents
- Product FAQs
- SEO title
- SEO description
- Canonical URL
- Open Graph image
- Visibility
- Featured status
- Related products
- Publish status

Prices, availability, stock, and sellable SKU identifiers must be handled through the validated transactional product model.

Provide a clear, synchronized administration workflow so editors do not accidentally create conflicting product records.

## Product Variations

Support the actual product variation structures found during the WooCommerce audit.

Do not assume that all products use the same attributes.

Preserve existing labels, choices, ordering, pricing, and image associations.

## Category Schema

- Name
- Slug
- Description
- Image
- Parent category
- SEO metadata
- Display order

## Pages Schema

- Page title
- Slug
- Flexible content sections
- Rich text
- Images
- Buttons
- Internal links
- SEO metadata
- Publishing controls

The flexible content system must support all existing page layouts without forcing editors to edit source code.

## Blog Schema

- Title
- Slug
- Author
- Publication date
- Featured image
- Rich text body
- Categories
- Tags
- Related posts
- SEO metadata

## Global Settings

- Logo
- Navigation
- Footer content
- Contact information
- Social links
- Announcement bar
- Existing brand assets
- Website-wide SEO defaults

## Editing Experience

Sanity Studio must support:

- Create
- Read
- Update
- Delete
- Draft and publish
- Media upload
- Rich text editing
- Link editing
- Reordering content
- Image alt text
- SEO management
- Preview

All custom Sanity schemas must have clear field labels and descriptions.

Do not over-engineer the CMS.

---

# 7. E-COMMERCE FUNCTIONAL REQUIREMENTS

Reproduce all WooCommerce functionality currently used by the website.

## 7.1 Product Catalog

Required:

- Product grid
- Category pages
- Product search
- Product sorting
- Product filtering
- Product variations
- Product images
- Stock status
- Pricing
- Sale pricing
- Product recommendations
- Pagination or existing loading behavior

Keep the existing layout exactly as observed.

## 7.2 Product Detail Pages

Reproduce:

- Product title
- Image gallery
- Variant selectors
- Quantity controls
- Pricing
- Add-to-cart behavior
- Existing product information
- Description tabs or accordions
- COA/document links
- Related products
- Existing WhatsApp actions
- Other existing product tools and interactive elements

Any specialized product tool discovered during the audit must be documented and reviewed for compliance before implementation.

## 7.3 Shopping Cart

Required:

- Add products
- Update quantities
- Remove products
- Persist cart
- Handle expired or invalid cart items
- Calculate totals server-side
- Apply coupons
- Display shipping information
- Display relevant errors

The frontend must never be trusted as the source of product prices.

## 7.4 Checkout

Recreate the existing checkout flow, including confirmed:

- Customer details
- Billing details
- Shipping details
- Shipping method selection
- Coupon validation
- Order summary
- Payment flow
- Order confirmation
- Transactional email

Payment processing must use an authorized provider that supports the actual products, countries, currencies, and business model.

Do not create an unverified live payment integration.

Use a sandbox environment until payment eligibility and technical compatibility are confirmed.

Never store raw card details.

## 7.5 Customer Account

Required:

- Registration
- Login
- Logout
- Forgot password
- Reset password
- Profile editing
- Address management
- Order history
- Order details

Preserve the existing public-facing account design.

If historical password hashes cannot be safely migrated, implement a secure account recovery process.

---

# 8. CUSTOM AFFILIATE SYSTEM

Build a new affiliate module to replace the business functionality currently provided by AffiliateWP.

The new system must replicate verified existing behavior rather than invent new business rules.

## 8.1 Affiliate Registration

Required:

- Public affiliate application form
- Input validation
- CAPTCHA or equivalent abuse protection
- Terms acceptance
- Secure password handling
- Pending application status
- Admin approval
- Admin rejection
- Email notifications

Users must not earn referral commissions before approval if the existing configuration requires approval.

## 8.2 Affiliate Authentication

Implement secure login and logout.

A customer may also hold an affiliate role.

Use the same underlying user identity where appropriate, with separate role permissions and dashboard access.

Avoid duplicate accounts unless the existing system requires them.

## 8.3 Affiliate Dashboard

Replicate the actual existing AffiliateWP frontend experience.

Potential dashboard modules include:

- Earnings overview
- Unpaid earnings
- Paid earnings
- Referral statistics
- Referral history
- Visits/clicks
- Conversion statistics
- Referral URL generator
- Sharing tools
- QR code generation
- Payout history
- Affiliate profile settings

Display only verified and supported modules.

Do not invent analytics or earnings.

## 8.4 Referral Tracking

Support both legacy URL patterns:

`/?ref=username`

`/ref/username`

The tracking system must:

1. Validate affiliate status.
2. Resolve the affiliate identifier.
3. Record the visit where applicable.
4. Store attribution securely.
5. Respect the configured referral attribution window.
6. Associate valid attribution with an eligible completed order.
7. Prevent duplicate referral commissions.
8. Prevent unauthorized self-referrals where prohibited.
9. Handle expired and invalid referral identifiers.
10. Preserve existing campaign tracking where used.

Determine existing attribution rules during the AffiliateWP audit.

Do not hardcode an arbitrary cookie duration.

Do not assume last-click or first-click attribution without verification.

## 8.5 Commission Engine

Commission calculations must occur server-side.

Support the commission configuration found in the original system, including any relevant:

- Percentage rates
- Flat rates
- Product-specific rates
- Affiliate-specific rates
- Tier-based rates
- Exclusions
- Coupon attribution
- Tax/shipping exclusions
- Refund reversals
- Order cancellation behavior

If rolling 30-day commission tiers are actually enabled, reproduce their precise existing calculation rules.

Do not derive financial logic solely from marketing copy.

Each commission must be linked to the corresponding order and affiliate.

Use immutable financial records or a reversible ledger.

## 8.6 Payout Management

Required if used in the original system:

- Pending commissions
- Approved commissions
- Paid commissions
- Payout history
- Manual payout processing
- Payout reconciliation
- Administrative notes
- Audit logs

Payouts must never be marked paid solely because a user clicked a frontend button.

Require authorized server-side actions and verified payment confirmation.

## 8.7 Affiliate Admin

Admin users must be able to:

- View affiliates
- Approve applications
- Reject applications
- Suspend affiliates
- View referral history
- Inspect commission records
- Review payout history
- Export reports
- Adjust commissions through audited correction entries
- Review fraud indicators

Use role-based access control.

Customer and affiliate users must never have permission to alter their own commissions.

---

# 9. DATABASE DESIGN

Use PostgreSQL with Drizzle ORM.

Create modular schemas.

## Authentication

- users
- sessions
- accounts
- verification_tokens
- user_roles

## Commerce

- product_records
- product_variants
- inventory
- inventory_movements
- carts
- cart_items
- orders
- order_items
- payments
- refunds
- shipments
- coupons
- coupon_redemptions

## Affiliate

- affiliates
- affiliate_settings
- affiliate_links
- affiliate_visits
- affiliate_attributions
- affiliate_referrals
- affiliate_commissions
- affiliate_tiers
- affiliate_payouts
- affiliate_payout_items
- affiliate_audit_logs

## Other

- loyalty_accounts
- loyalty_transactions
- admin_audit_logs
- legacy_id_mappings
- migration_logs

Only implement loyalty tables if the functionality is confirmed to be active.

## Database Requirements

- Use proper foreign keys.
- Use database transactions for financial operations.
- Use integer minor units or appropriate fixed-precision numeric types for money.
- Never use JavaScript floating-point arithmetic as the authoritative method for monetary calculations.
- Ensure payment webhooks are idempotent.
- Ensure commissions cannot be created twice for the same eligible event.
- Preserve historical records.
- Create appropriate indexes.
- Never expose sensitive database credentials to the browser.

Provide documented Drizzle migration commands.

---

# 10. UI/UX REPLICATION REQUIREMENTS

This is a strict visual migration.

The existing website must be treated as the visual specification.

## Layout

Replicate:

- Header
- Navigation
- Footer
- Page containers
- Section layouts
- Product grids
- Product cards
- Account areas
- Affiliate pages
- Blog layouts
- All existing interactive elements

## Typography

Use the same fonts, weights, sizes, letter spacing, and line heights wherever the original assets and computed styles can be obtained.

## Colors

Extract actual colors from the original website.

Do not invent a new color palette.

## Responsive Behavior

Replicate existing breakpoint behavior.

Do not simply scale the desktop layout down to mobile.

## Animations

Replicate existing animations, transitions, hover effects, and interaction states.

Do not introduce extra animations.

## Fidelity Validation

For each unique template:

1. Capture the original screenshot.
2. Capture the Next.js screenshot.
3. Compare at matching viewport dimensions.
4. Identify differences.
5. Fix differences.
6. Repeat until meaningful discrepancies are resolved.

Use visual regression testing where possible.

Visual fidelity is more important than introducing a new design system.

However, semantic HTML, accessibility, and security must not be sacrificed merely to imitate implementation quirks.

---

# 11. SEO MIGRATION

Preserve existing SEO wherever possible.

Required:

- Existing page URLs
- Product slugs
- Category slugs
- Blog slugs
- Title tags
- Meta descriptions
- Heading hierarchy
- Canonical URLs
- Open Graph metadata
- Structured data
- Alt text
- Breadcrumbs
- Internal links
- XML sitemap
- robots.txt
- 301 redirects where necessary

Prevent staging and preview deployments from being indexed.

Do not accidentally block indexing on the production domain.

Ensure product structured data reflects actual product information.

Do not generate fictional reviews or ratings.

Create:

`docs/migration/seo-url-mapping.md`

Include original URL, new URL, redirect requirement, and validation result.

---

# 12. BEGINNER-FRIENDLY PROJECT STRUCTURE

Use this structure as a starting point.

```text
src/
├── app/
│   ├── (store)/
│   │   ├── page.tsx
│   │   ├── shop/
│   │   ├── product/
│   │   ├── cart/
│   │   └── checkout/
│   ├── (auth)/
│   ├── account/
│   ├── affiliate/
│   ├── admin/
│   └── api/
│
├── components/
│   ├── layout/
│   ├── products/
│   ├── cart/
│   ├── forms/
│   ├── affiliate/
│   └── ui/
│
├── features/
│   ├── auth/
│   ├── catalog/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── affiliate/
│   └── loyalty/
│
├── sanity/
│   ├── schemas/
│   ├── queries/
│   └── lib/
│
├── db/
│   ├── schema/
│   ├── migrations/
│   └── index.ts
│
├── lib/
│   ├── payments/
│   ├── email/
│   └── security/
│
└── types/

scripts/
├── audit/
├── migration/
└── verification/

docs/
├── audit/
├── architecture/
├── migration/
└── testing/
```

Keep components small and understandable.

Separate presentation code from business logic.

Use descriptive function names.

Avoid unnecessary abstractions and excessive dependencies.

Do not put all business logic inside route files.

Document important architectural decisions in plain language.

---

# 13. MIGRATION PLAN

## Phase 1 — Discovery

- Crawl and audit the existing website.
- Inspect WordPress and WooCommerce.
- Inspect AffiliateWP.
- Identify all plugins and integrations.
- Create inventories and audit reports.

## Phase 2 — Architecture

- Define Sanity schemas.
- Define PostgreSQL schemas.
- Define authentication architecture.
- Define product synchronization strategy.
- Define checkout architecture.
- Define affiliate attribution and commission design.
- Identify technical and compliance blockers.

## Phase 3 — Frontend Replication

- Rebuild the existing layout.
- Rebuild all public page templates.
- Reuse original assets.
- Preserve content and URLs.
- Test desktop, tablet, and mobile fidelity.

## Phase 4 — CMS Integration

- Configure Sanity Studio.
- Implement product CRUD.
- Implement category CRUD.
- Implement blog and page management.
- Implement content previews.
- Implement content revalidation.

## Phase 5 — Commerce Backend

- Implement or integrate the approved commerce engine.
- Implement authentication.
- Implement cart functionality.
- Implement checkout.
- Implement authorized payment integration.
- Implement orders, stock, shipping, and customer account features.

## Phase 6 — Affiliate Replacement

- Import affiliate records.
- Implement approval workflow.
- Reproduce legacy referral URLs.
- Implement attribution.
- Implement commission calculations.
- Implement payout management.
- Implement affiliate dashboard.
- Reconcile historical financial data.

## Phase 7 — QA and Migration

- Import all approved production data.
- Validate record counts.
- Validate order totals.
- Validate affiliate balances.
- Validate URLs and SEO.
- Perform visual regression tests.
- Perform security tests.
- Perform transaction tests.

## Phase 8 — Deployment

- Deploy to Vercel staging.
- Configure production environment variables.
- Verify payment callbacks and email.
- Perform final incremental data migration.
- Obtain explicit launch approval.
- Update production DNS.
- Monitor all critical business flows.
- Keep WordPress available as a secure rollback source.

Do not remove the original WordPress system until the new platform passes final acceptance.

---

# 14. SECURITY AND DATA PROTECTION

Mandatory:

- Secure authentication and password hashing
- Role-based permissions
- Server-side input validation
- Rate limiting
- CSRF protection where applicable
- Secure session cookies
- Payment webhook signature verification
- Restricted administrative actions
- Audit logs
- Secure environment variable management
- Database backups
- Safe file upload validation
- Least-privilege API access

Never expose:

- WordPress administrator credentials
- AffiliateWP API tokens
- Sanity write tokens
- Database passwords
- Payment secret keys
- CAPTCHA secret keys

If existing credentials are found in screenshots or files, report them as security risks and recommend rotation.

Do not perform destructive production actions without approval.

---

# 15. QUALITY ASSURANCE

Create automated and manual tests for:

## Frontend

- Visual regression
- Navigation
- Responsive behavior
- Forms
- Images
- Links
- Product selection
- Cart functionality

## Commerce

- Correct product pricing
- Product variations
- Cart calculations
- Discount application
- Order creation
- Payment verification
- Refund handling
- Inventory adjustments

## Affiliate

- Registration
- Approval
- Login
- Legacy referral URL resolution
- Cookie attribution
- Referral recording
- Commission calculation
- Duplicate commission prevention
- Refund reversal
- Payout reconciliation
- User permissions

## SEO

- URL matching
- Redirects
- Sitemap
- Canonical URLs
- Structured data
- Metadata
- Staging noindex behavior

Never use real financial transactions for initial automated testing.

Use approved sandbox integrations and synthetic test accounts.

---

# 16. PROJECT DOCUMENTATION

Create the following documents:

1. `docs/audit/page-inventory.md`
2. `docs/audit/woocommerce-audit.md`
3. `docs/audit/affiliatewp-audit.md`
4. `docs/audit/plugin-inventory.md`
5. `docs/architecture/system-architecture.md`
6. `docs/architecture/database-schema.md`
7. `docs/migration/data-mapping.md`
8. `docs/migration/seo-url-mapping.md`
9. `docs/testing/qa-checklist.md`
10. `docs/deployment/vercel-setup.md`
11. `README.md`

Documentation must be understandable to a developer who is still learning Next.js.

Explain where to edit:

- Header
- Footer
- Product cards
- Product pages
- Sanity schemas
- Checkout logic
- Affiliate rules
- Database schema
- Environment variables

---

# 17. DEVELOPMENT WORKFLOW FOR CLAUDE

IMPORTANT: Do not attempt to complete the entire project in one uncontrolled implementation.

Work in phases.

Before each phase:

1. Review the current project.
2. Identify dependencies.
3. Explain the implementation plan.
4. Make focused code changes.
5. Run available validation.
6. Fix errors.
7. Update documentation.
8. Summarize what was completed and what remains.

Use Git commits for major verified milestones where repository access is provided.

Do not overwrite unrelated code.

Do not delete existing work without inspecting it first.

Do not silently change the project architecture.

If external credentials, APIs, exports, or administrator access are missing, continue with independently implementable work and record the dependency.

Do not create fake implementations merely to make a task appear complete.

---

# 18. ACCEPTANCE CRITERIA

The project is complete only when:

- All original public pages have been migrated.
- Existing content is preserved.
- Existing images are preserved.
- Designs match the original at required viewports.
- Navigation and interactive elements work.
- Products and variations are correctly migrated.
- Product CRUD works through the approved CMS workflow.
- Customer authentication works securely.
- Checkout works with a verified payment provider.
- Orders and payments are correctly recorded.
- Affiliate registration and approval work.
- Existing referral URLs continue to function.
- Affiliate commissions are calculated correctly.
- Affiliate payment records are preserved.
- Historical data has been reconciled.
- SEO URLs and redirects are validated.
- Security checks pass.
- Staging and production deployment are documented.
- The website no longer requires WordPress for normal operation after the approved cutover.

Anything that cannot be verified must be listed as an unresolved issue, not marked complete.

---

# 19. FIRST TASK — START HERE

Do not immediately begin coding.

First, perform the discovery and audit phase.

Start by:

1. Inspecting https://peptidesbali.online/.
2. Discovering accessible URLs and page templates.
3. Identifying the existing design system.
4. Recording all visible functional components.
5. Identifying the WordPress, WooCommerce, and AffiliateWP details that require authorized backend access.
6. Producing a technical feasibility report.
7. Creating a migration implementation checklist.
8. Identifying the biggest technical risks.
9. Proposing a database architecture.
10. Presenting an implementation sequence.

Return the initial audit findings before moving into production implementation.

The ultimate goal is a complete, functionally equivalent Next.js migration with 100% intentional visual and content preservation, no unapproved redesign, and no lost business-critical data.
