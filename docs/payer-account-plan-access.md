# Payer Account Plan access

The app reads the logged-in Salesforce User's `Profile_Name_vod__c`, `Department`, and
`KPH_Primary_Territory_Description__c`. It compares the user's primary territory
with `Account_Plan_vod__c.KPH_Territory_Description__c`, the field displayed as
Marketplace in the Payer app.

Users with the **KPH-Home Office** or **System Administrator** User Profile can
edit all accessible Payer Account Plans, regardless of department or territory.
This profile rule takes precedence over the department rules below. The app
reads the profile name directly from `User.Profile_Name_vod__c`.
Profile names require an exact match after ignoring case and surrounding or
repeated whitespace. Blank or other profiles retain department-based access.

| Department (abbreviation or full name) | Read | Edit |
| --- | --- | --- |
| KAD / Key Account Director | All accessible plans | Matching primary territory / marketplace |
| NAD / National Account Director | All accessible plans | None |
| RAD / Regional Account Director | All accessible plans | None |
| NPAD / National Payer Account Director | All accessible plans | All accessible plans |
| Senior Director, Key Accounts | All accessible plans | All accessible plans |
| Strategic Engagement Head | All accessible plans | All accessible plans |
| Missing or unrecognized department | All accessible plans | None |

Department comparisons accept the role's abbreviation, full name, or both
(for example, `KAD - Key Account Director` or `Key Account Director (KAD)`),
including the `KPH-` prefix. They do not use substring or owner fallbacks.
Department and territory comparisons ignore case, surrounding whitespace, and
repeated spaces. Territory comparisons also treat hyphens and spaces alike,
so `Mid Central` matches `MID-CENTRAL`. Matching still requires a full, nonempty match. Missing
territories never grant a KAD edit access. The app has no department or territory
filter on the plan list; its existing Payer record type filter is retained.

The app checks the connected org's `Organization.IsSandbox` value and defaults
unknown/offline environments to sandbox. An explicit `VITE_CRM_ENVIRONMENT`
setting supports offline deployments; a disagreement with the detected org
blocks record type resolution. Vite's production build mode is unrelated to
the CRM environment. See [CRM environments and record types](crm-record-types.md).

Payer plan, Barrier/Opportunity, and summary record types are resolved by their
specific names in active metadata from the connected org. Payer objectives,
strategies, tactics, stakeholders, actions, and milestones use the supplied
spreadsheet IDs in sandbox and resolve names in production. Network types never
substitute for Payer types. Missing, ambiguous, or denied metadata blocks the
operation and can be retried. Reads and new records share these resolved IDs;
local preview retains its fixture IDs. Offline iPad use requires the relevant
RecordType rows to be synced, and CRM must permit writes to the selected type.

The dashboard waits for its access check before mounting editors. Read-only
users retain navigation, filtering, sorting, expansion, and export. Save and
delete services independently recheck access against the resolved target plan,
including queued assessment saves. Query failures leave the dashboard read-only
and prevent writes. Reopening a plan retries its dashboard access check.
An unrecognized department is shown in the read-only message; a missing value
is identified as blank or unavailable so it can be corrected in Salesforce.

Deployment requires Salesforce read access to these User fields and the plan's
marketplace field. Include the fields in offline User / Account Plan sync
configuration for iPad use. Salesforce sharing must expose all required plans
and their related records to these departments, and CRUD/FLS must allow the
intended editors to save. This repository does not configure org sharing,
permission sets, or offline sync rules. Mirror these restrictions in Salesforce
for writes made through other interfaces or APIs; app checks govern this app.
