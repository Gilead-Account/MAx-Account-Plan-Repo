# CRM environments and record types

The record type data from `record types.xlsx` is classified as sandbox data,
following the user's request. Notes in the workbook are reference data. They do
not change the application from Payer account planning to Network account planning.
Final Med was consulted as a reference; its source was not changed. It resolves
Medical barrier/driver IDs from connected-org metadata, but has no sandbox versus
production detector. Its Medical type mappings are separate from these Payer types.

## Environment selection

1. Local preview keeps its existing mock identities and uses no live record types.
2. Live CRM queries `Organization` for `IsSandbox`. Explicit `true` selects
   sandbox; explicit `false` selects production. Wrapped field values and the
   strings `true` and `false` are supported.
3. If org metadata is unavailable, `VITE_CRM_ENVIRONMENT` supplies the environment.
   Allowed values are `sandbox` and `production`. Without a setting, sandbox wins.
4. If a setting conflicts with the detected org, the operation fails before
   selecting a record type. Invalid settings also fail.

Use the same ZIP in either environment when Organization metadata is available.
For an offline production installation without that metadata, build explicitly:

```bash
VITE_CRM_ENVIRONMENT=production npm run build
```

Vite's `--mode production` and `import.meta.env.PROD` describe the optimized build;
neither identifies the Salesforce org. CDN URLs and local iPad paths also do not
identify the org. No environment is inferred from the browser URL.

## Resolution and application scope

`src/lib/dataservice/accountPlan/recordTypes.js` contains the workbook catalog.
In sandbox, a catalog entry resolves only if its supplied ID exists in active
metadata for the expected object. Both 15 and 18 character Salesforce IDs match.
When metadata includes Name or DeveloperName, it must also match the configured
type. A mismatch reports both the expected sandbox ID and the IDs found under
the expected name; it does not silently replace the supplied ID.
In production, the resolver uses the expected Name or DeveloperName in the
connected org. It never falls back to a workbook ID. Metadata access failures,
missing matches, and duplicate matches stop the operation; failed resolutions
can be retried. Concurrent metadata requests for the same object are shared.

The Payer app applies these workbook entries to scoped reads, new records, and
deletion identity checks:

| Type | Object | Sandbox ID |
| --- | --- | --- |
| Payer Account Objective | KPH_Account_Objective__c | 012VE0000081kx3YAA |
| Payer Strategy | KPH_Strategy__c | 012VE0000081l0HYAQ |
| Payer Tactics & Resource | KPH_Tactics_Resource__c | 012VE0000081kdhYAA |
| Payer Stakeholder | KPH_Stakeholder_Map__c | 012VE0000084tFq |
| Payer Actions & Critical | KPH_Actions_and_Critical_Next_Steps__c | 012VE0000081kLxYAI |
| Payer Milestone Engagement | KPH_Milestones_and_Engagements__c | 012VE0000081k93YAA |

The user subsequently supplied these additional sandbox mappings for
`KPH_Key_Wins_Key_Customer_Asks__c`:

| Type | Sandbox ID |
| --- | --- |
| Key Customer Ask | 012VE000007qhzJYAQ |
| Key Customer Asks Network | 012VE000007zKk9YAE |
| Key Wins | 012VE000007qhxhYAA |
| Key Wins Network | 012VE000007zKSPYA2 |
| KLT Asks | 012VE000007zKnNYAU |

Payer summary reads, saves, and deletions use Key Wins and Key Customer Ask.
Network and KLT types remain separate catalog entries. Production resolves each
type by its specific name in the connected org; the supplied IDs are sandbox only.

Payer Account Plan, Payer Account Landscape, Barrier, and Opportunities have no
supplied Payer IDs. They resolve by their own specific names from the connected
org in both environments. Matching ignores punctuation,
spaces, an optional KPH prefix, and Barrier/Barriers or Opportunity/Opportunities.
Ambiguous names require correction in the resolver configuration or org metadata;
the resolver does not select an arbitrary match. Existing fixture-only IDs for
Payer plans and summary records are used only by local preview.

### Confirmed assignment labels

The assignment screenshots supplied on November 16 confirm these types for the
Payer app. The user confirmed these are from the **MAx Payer MyInsights User**
permission set and that it is assigned to Test KAD. The screenshots show labels
and assignment checkboxes, not the underlying record type IDs or object Create
permission settings.

| Object | Assigned record type used by this app |
| --- | --- |
| Account_Plan_vod__c | Payer Account Plan |
| KPH_Account_Landscape__c | Payer Account Landscape |
| KPH_Account_Objective__c | Payer Account Objective |
| KPH_Actions_and_Critical_Next_Steps__c | Payer Actions & Critical |
| KPH_Key_Wins_Key_Customer_Asks__c | Key Customer Ask; Key Wins |
| KPH_Milestones_and_Engagements__c | Payer Milestone Engagement |
| KPH_Payers_Barrier_Opportunities__c | Barrier; Opportunities |
| KPH_Stakeholder_Map__c | Payer Stakeholder |
| KPH_Strategy__c | Payer Strategy |
| KPH_Tactics_Resource__c | Payer Tactics & Resource |
| Account | Payer (shown; the app reads linked accounts and does not create them) |

Barrier and Opportunities are the exact labels shown, without a Payer prefix.
Their resolver also accepts explicit legacy Payer developer-name aliases.
Network names are excluded. Landscape and assessment reads include the Payer
landscape record type, and both create paths explicitly send that type's org ID.

Network plans, barriers/opportunities, hierarchy records, stakeholders, site
performance, and expansion record types are preserved in the sandbox catalog for
their respective objects. The Payer app does not implement those Network/site
workflows and does not apply their IDs to Payer data. In particular:

- `012VE0000081nTVYAY` is Network Account Plan, not Payer Account Plan.
- `012VE0000081kNZYAY` and `012VE0000081kaTYAQ` are Network types, not Payer types.
- The workbook's Account Landscape row repeats the Account Plan wording and gives
  `012VE0000085KcbYAE`. Its exact object is unconfirmed. The catalog retains the
  ID with no object mapping, and attempting to resolve it fails with an explicit
  mapping error. Payer landscape and assessment flows resolve Payer Account
  Landscape by name and scope reads by both plan and record type.

Org metadata queries and record types must be available to the logged-in CRM
user, including synced RecordType rows on offline iPad. Local tests cover
selection logic and persistence; a deployment still needs validation in the
actual sandbox and production orgs.

## Record type rejected for a user

An active `RecordType` metadata row does not establish that the current user can
create a record with that type. If CRM rejects an objective create with
`INVALID_CROSS_REFERENCE_KEY` and says the Record Type ID is invalid for the
user, verify the type in the same sandbox and check the user's record type
availability and object Create permission. For the reported Test KAD issue,
the configured Payer Account Objective type is `012VE0000081kx3YAA` on
`KPH_Account_Objective__c`. A Salesforce administrator must check the user's
profile and permission sets; changing the app's ID to the Network type would
change the record's meaning.

The later screenshots show Payer Account Objective checked in MAx Payer
MyInsights User, confirmed assigned to Test KAD. Missing record type assignment
is not established as the cause of the reported error. To distinguish a
stale/wrong ID from effective Create permissions or session state, verify this
metadata in the same sandbox:

```sql
SELECT Id, Name, DeveloperName, SobjectType, IsActive
FROM RecordType
WHERE SobjectType = 'KPH_Account_Objective__c'
```

The editor preserves the draft and shows administrator guidance when this
explicit rejection occurs before any acknowledged write. If earlier writes
succeeded, the app retains its reload requirement to reconcile partial saves.
The app does not retry creation with an omitted or different record type.
