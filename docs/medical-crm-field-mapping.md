# Medical CRM Mapping Inventory

Generated from the active application data-service mappings.

## How to use this export

- Populate **New Medical Object API** and **New Medical Field API** in the CSV.
- Treat rows marked **Confirm/reuse platform field** as standard Veeva/Salesforce fields that may remain unchanged.
- Validate lookup direction, record types, picklist values, field-level security, offline availability, and create/update permission before implementation.
- The reviewer-name field `KPH_Last_MPD_Reviewer__c` is explicitly provisional.
- Duplicate field rows are intentional when the same backend field supports multiple pages.
- The CSV is a mapping template only; generating it does not remove or change any current CRM API mappings.

## Coverage

- 164 page/backend field dependencies
- 383 page-specific current-usage rows
- 21 functional groups
- 11 current CRM objects

## Current objects requiring a Medical mapping decision

- `Account`
- `Account_Plan_vod__c`
- `Account_Team_Member_vod__c`
- `KPH_Additional_Critical_Activities__c`
- `KPH_Medical_Barrier_Tactical_Actions__c`
- `KPH_Ecosystem_Map_Dynamics__c`
- `KPH_Ecosystem_Plan__c`
- `KPH_Other_Healthcare_Networks__c`
- `KPH_Stakeholder_Map__c`
- `KPH_Strategy__c`
- `User`

## Functional groups

### Desktop Account Plan Launcher — Plan selection and launcher table

- Current object: `Account_Plan_vod__c`
- Access: Read
- Fields: 14
- Source: `src/lib/dataservice/accountPlan/accountPlanLauncher.js`

### Desktop Account Plan Launcher — Owner fallback lookup

- Current object: `User`
- Access: Read
- Fields: 4
- Source: `src/lib/dataservice/accountPlan/accountPlanLauncher.js`

### Desktop Account Plan Launcher — Account priority lookup and eligible-plan filters

- Current object: `Account`
- Access: Read
- Fields: 5
- Source: `src/lib/dataservice/accountPlan/accountPlanLauncher.js`

### Desktop Account Plan Launcher — Cohort fallback lookup

- Current object: `KPH_Ecosystem_Plan__c`
- Access: Read
- Fields: 4
- Source: `src/lib/dataservice/accountPlan/accountPlanLauncher.js`

### Shared Shell / Every Page — Account Plan header and common context

- Current object: `Account_Plan_vod__c`
- Access: Read / Update
- Fields: 9
- Source: `src/lib/dataservice/accountPlan/shared.js`

### Shared Shell / Every Page — ATC account header

- Current object: `Account`
- Access: Read
- Fields: 5
- Source: `src/lib/dataservice/accountPlan/shared.js`

### MRD Approval Backend — Submit and approve workflow

- Current object: `Account_Plan_vod__c`
- Access: Read / Update
- Fields: 7
- Source: `src/lib/dataservice/accountPlan/approval.js`

### MRD Approval Backend — Logged-in reviewer identity and profile gating

- Current object: `User`
- Access: Read
- Fields: 4
- Source: `src/lib/dataservice/accountPlan/shared.js`

### Home — Header KPIs and profile strip

- Current object: `KPH_Ecosystem_Plan__c`
- Access: Read
- Fields: 4
- Source: `src/lib/dataservice/accountPlan/home.js + shared.js`

### Home / Barriers & Opportunities — Barrier and Opportunity records, CRUD, filters, and picklists

- Current object: `KPH_Medical_Barrier_Tactical_Actions__c`
- Access: Read / Create / Update
- Fields: 17
- Source: `src/lib/dataservice/accountPlan/shared.js + barriersDrivers.js + home.js`

### Home / Barriers & Opportunities — Strategy lookup and rank

- Current object: `KPH_Strategy__c`
- Access: Read
- Fields: 6
- Source: `src/lib/dataservice/accountPlan/shared.js + barriersDrivers.js + home.js`

### Home / Medical Tactics / Barriers & Opportunities — Medical Tactic records, parent mapping, CRUD, and picklists

- Current object: `KPH_Additional_Critical_Activities__c`
- Access: Read / Create / Update
- Fields: 16
- Source: `src/lib/dataservice/accountPlan/shared.js + criticalActivities.js + home.js`

### Home / Team Members — Account Plan team membership

- Current object: `Account_Team_Member_vod__c`
- Access: Read / Create / Update
- Fields: 10
- Source: `src/lib/dataservice/accountPlan/shared.js + teamMembers.js + home.js`

### Cross Functional Plan of Action — DLBCL Plan of Action blocks

- Current object: `Account_Plan_vod__c`
- Access: Read / Update
- Fields: 5
- Source: `src/lib/dataservice/accountPlan/shared.js + crossFunctionalPlan.js`

### Medical Account Profile — Profile identity and read-only regional dynamics

- Current object: `KPH_Ecosystem_Plan__c`
- Access: Read
- Fields: 5
- Source: `src/lib/dataservice/accountPlan/shared.js + accountProfile.js`

### Medical Account Profile — MM fields stored on Account Plan rather than profile record

- Current object: `Account_Plan_vod__c`
- Access: Read / Update
- Fields: 7
- Source: `src/lib/dataservice/accountPlan/shared.js + accountProfile.js`

### Referral & Dynamics — Referral mapping records

- Current object: `KPH_Ecosystem_Map_Dynamics__c`
- Access: Read / Create / Update
- Fields: 10
- Source: `src/lib/dataservice/accountPlan/shared.js + accountProfile.js`

### Referral & Dynamics — Other Healthcare Networks (currently read-only UI)

- Current object: `KPH_Other_Healthcare_Networks__c`
- Access: Read
- Fields: 6
- Source: `src/lib/dataservice/accountPlan/shared.js + accountProfile.js`

### Stakeholders — Stakeholder records and influence fields

- Current object: `KPH_Stakeholder_Map__c`
- Access: Read / Create / Update
- Fields: 13
- Source: `src/lib/dataservice/accountPlan/shared.js + stakeholders.js`

### Shared Lookups / Backend — Account lookup for ATCs, sites, networks, and stakeholders

- Current object: `Account`
- Access: Read
- Fields: 9
- Source: `src/lib/dataservice/accountPlan/shared.js`

### Shared Lookups / Backend — User lookup for created-by, owners, POD, and reviewer

- Current object: `User`
- Access: Read
- Fields: 4
- Source: `src/lib/dataservice/accountPlan/shared.js`


## Backend migration checklist

1. Supply the new Medical parent Account Plan object and Account lookup.
2. Supply each child object and its parent lookup field.
3. Supply Medical record type IDs for Barriers and Opportunities.
4. Confirm picklist values and controlling/dependent picklist metadata.
5. Confirm soft-delete fields and active-row filters.
6. Confirm reviewer profile names and the reviewer-name/date fields.
7. Confirm offline VQL availability and field-level security by profile.
8. Update mock fixtures, tests, exports, and desktop launcher mappings.
9. Validate create, update, submit, approve, and polling operations on iPad.

## Derived and export-only behavior

- PDF, PowerPoint, and executive-summary exports consume the existing page loaders; they do not issue separate CRM queries.
- Read-only UI sections are still listed when their loaders or backend services query fields.
- Display labels, calculated counts, status sorting, and other derived values do not require additional CRM fields.
- Removed commercial-only tabs are not treated as active Medical page dependencies.
