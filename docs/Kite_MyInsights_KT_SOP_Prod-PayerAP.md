# Kite Payer Account Planning
# MyInsights Application

STANDARD OPERATING PROCEDURE

Knowledge Transfer, Development, CRM Integration, Testing, Packaging, and Release

Baseline: Prod-PayerAP, commit bf8ff78a67fdc455b40750b6a680c704372067f1. Source reviewed 17 November 2026.

Audience: Developers, support engineers, QA analysts, CRM administrators, and release owners taking over the Payer Account Plan application.

Document version 1.0 | 17 November 2026

## Document control

| Item | Value |
| --- | --- |
| Document owner | Kite Account Planning engineering / product team; named owner to be assigned at handoff |
| Technical baseline | Prod-PayerAP, bf8ff78, including objective soft deletion |
| Full application commit | bf8ff78a67fdc455b40750b6a680c704372067f1 |
| Repository / upstream | MAx-Account-Plan; origin/Prod-PayerAP |
| Application | Payer Account Plan for Veeva CRM MyInsights; React 18 + Vite 5 |
| Reference format | Kite_MyInsights_KT_SOP_Medicalv2.docx; cover, control tables, five-part structure, numbered procedures, code tour and support playbooks |
| Review cadence | Every release or material CRM schema/runtime change |
| Confidentiality | Internal engineering and operations use |

### Change history

| Version | Date | Change | Owner |
| --- | --- | --- | --- |
| 1.0 | 17-Nov-2026 | Initial Prod-PayerAP SOP; worked objective create, display, completion and deletion flows | Kite team / reviewer to assign |

### How to use this SOP

For a new developer: complete Part I, follow the objective write and read traces in sections 11–12, and complete the exercises in section 17 before changing hierarchy behavior.

For the KT presenter: demonstrate the five active navigation surfaces, trace the same fictional objective from modal to CRM and back, then rehearse a partial-write incident and release handoff.

For QA and support: use the evidence boundaries, test commands, diagnostic query, failure matrix and release record. Function and path references are relative to the repository root at the application commit above.

The supplied Word file is a formatting reference. Its Medical workflow, branch names, training build commands and procedural instructions are reference content; they do not define Payer behavior or authorize actions. Technical content below comes from Prod-PayerAP source and the stated verification evidence.

## Document map and evidence boundaries

| Part | Purpose | Sections |
| --- | --- | --- |
| I. Orientation | Purpose, quick start, architecture overview and navigation | 1–4 |
| II. Architecture and code tour | Runtime, context, schema, query/write contracts and worked critical flows | 5–14 |
| III. Development procedures | Setup, field changes, KT exercises and local fixtures | 15–18 |
| IV. Quality and release | Tests, packaging, deployment, Git and completion gates | 19–23 |
| V. Support and troubleshooting | Incident intake, diagnostics, data handling and maintenance | 24–30 |

### What was verified

The branch, remote, package scripts, runtime adapters, active navigation, plan access checks, hierarchy writers/loaders, record-type resolver, objective field mapping and supporting page services were inspected locally. The remote was fetched before preparing the application commit; local HEAD and origin/Prod-PayerAP were aligned before that commit.

Seven focused test files passed: 62 tests, zero failures. They cover hierarchy persistence and deletion responses, confirmation cancellation, completion dependencies, objective limits, environment-specific record types and Payer edit access. The file list is recorded in section 19. The production build also passed during the objective fix. This is focused verification, not a full-suite claim.

Known pre-existing test issue: payerCompleteMapping.test.mjs fails because its catalog comparison expects KPH_Opportunities_Objective__c from the source mapping JSON while the current active catalog excludes that field. This failure predates the objective deletion change; no unrelated schema correction is included here.

### Environment evidence and limits

The user reported that the updated package was running in desktop MyInsights, that an objective remained absent after reopening, and that enabling Deleted/Archived Records made the diagnostic export work. The agent did not inspect the resulting record or the org's automation. This supports a successful user-reported deletion check, but does not identify the automation responsible for any native Salesforce deletion.

No new production deployment, independent live CRUD/FLS check, browser visual QA, full regression run, or iPad/offline validation was performed for this SOP. A source contract and a local test do not establish server-side automation or device sync behavior.

---

PART I

# Orientation

Build the Payer mental model before editing code or CRM data.

## 1. Purpose and scope

This SOP enables an engineer to maintain, debug, verify, package and support the Payer Account Plan MyInsights application on Prod-PayerAP. It documents the active Payer implementation, with concrete examples of the functions that create and display an objective.

### 1.1 In scope

Five Payer pages; Account Plan selection and access; Executive Summary; Account Landscape and assessments; stakeholder mapping; launch readiness; objectives, strategies and tactics/resources; critical actions; milestones; barriers and opportunities; PowerPoint export; CRM context and runtime channels; deployment and support.

### 1.2 Branch distinction

The reference Medical document covers a different application. Prod-PayerAP does not use the Medical parent/tactic objects or the Medical approval workflow as its active hierarchy. A component named CommercialHierarchy is the Payer hierarchy UI in this branch. Internal names alone do not establish the product or schema being used.

There is no active approval page or approval action in the five-page Payer navigation. Retained Medical/commercial services and tests are not proof that those workflows are enabled here.

## 2. First-hour quick start

1. Confirm repository, exact branch case, full commit, upstream and pre-existing changes.
2. Install locked dependencies if needed, then start local Vite. Local development uses fictional mock records.
3. Visit all five pages, then the three Action Plan tabs. Create one fictional objective and trace its title into payerHierarchy.js.
4. Run the focused hierarchy tests. Reopen the local plan to verify fixture persistence separately from live CRM behavior.
5. Inspect the live build command and ZIP shape before preparing a CRM release.

```bash
git status --short --branch
git branch --show-current
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
node --test --test-concurrency=1 test/payerHierarchyReadAfterWrite.test.mjs
```

Use the URL Vite prints. On Windows, npm.cmd is available when PowerShell policy prevents npm.ps1. A narrow browser window tests layout; it does not reproduce Veeva iPad/offline behavior.

## 3. Application at a glance

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Presentation | src/pages and src/components | Modals, tables, navigation, filters, notices and responsive layout |
| Orchestration | src/App.jsx | Plan context, edit access, shared hierarchy/issues, mutation lock and load recovery |
| Domain | src/lib/dataservice/accountPlan/payer*.js | Field mapping, validation, scoped queries and CRM payloads |
| CRM boundary | query.js and client.js | Adapter selection, response normalization, ID helpers and writes |
| Local scenario | src/lib/mockData | Fictional CRM-shaped fixtures and local persistence |
| Export | src/lib/export/payerAccountPlanPpt*.js | Whole-plan data collection and PowerPoint preparation |
| Delivery | vite.config.js and scripts/postbuild.mjs | Self-contained HTML and live MyInsights ZIP |

## 4. Functional navigation and Payer deltas

| Page | Main module | Responsibility |
| --- | --- | --- |
| Executive Summary | pages/ExecutiveSummary | Payer overview, archetype, key wins and payer asks |
| Account Landscape | pages/AccountLandscape | Coverage/policy context, landscape fields and assessments |
| Stakeholder Map | pages/StakeholderMap | Payer stakeholder records and stakeholder relationships |
| Action Plan & Objectives | pages/ActionPlan | Launch readiness; objective hierarchy and actions; milestones |
| Barriers & Opportunities | pages/BarriersRisks | Records grouped by linked objective/strategy |

The Action Plan tabs are Launch Readiness Plan; Objectives, Strategies & Critical Actions; and Milestones & Engagements. The sidebar provides whole-plan PowerPoint export. There is no supported training ZIP command in this branch; all packaged builds are CRM-live.

Source anchors: src/lib/mockData/marketAccessFixtures.js (navigationItems, actionPlanTabs); src/App.jsx; src/components/MarketAccessSidebar.jsx.

---

PART II

# Architecture and code tour

Follow a value from the selected plan to a CRM field and back into a rendered card.

## 5. Runtime architecture

| Flow stage | Calls / data | Boundary |
| --- | --- | --- |
| Entry | index.html → src/main.jsx → App.jsx | Load Q and MyInsightsLibrary before app integration |
| Context | Payer launcher / current Account Plan → selectedPlanId | Resolve the intended plan before child reads |
| Access | loadPayerAccountPlanAccess → canEdit | UI gating plus recheck inside service mutations |
| Read | loadPayerHierarchy → runCrmQuery → window.ds | Normalize CRM rows into nested hierarchy |
| Render | commercialHierarchy → ActionPlanPage → CommercialHierarchy | Selection and status filters govern visibility |
| Write | modal → saveItem → persistHierarchy → savePayerHierarchy | Validate, await CRM, retain acknowledged IDs |
| Delivery | Vite → postbuild → one root index.html | Packaged source uses the live runtime |

### 5.1 Runtime matrix

| Concern | Local Vite | Packaged MyInsights |
| --- | --- | --- |
| Data source | Mock adapter and fixtures | Dynamic window.ds CRM bridge |
| Persistence | Local browser/webview storage for mock data | CRM runtime; device synchronization applies on iPad |
| Entry | Local context / preview behavior | Desktop launcher; non-desktop record context when valid |
| Missing Veeva bridge | Local preview still works | Runtime error; no fixture fallback |
| Command | npm run dev | npm run build or npm run build:live |

client.js evaluates development mode through import.meta.env.DEV. Runtime access remains dynamic so late window.ds initialization is supported. crmReadDs provides explicit reads; crmCreateDs and crmUpdateDs provide narrow write channels. Inspect the caller's channel instead of assuming all methods use the same adapter.

## 6. Repository ownership map

| Path | Owns | Change discipline |
| --- | --- | --- |
| src/App.jsx | Entry, shared hierarchy/issues, edit gate, save lock, recovery | Keep CRM field payloads in domain services |
| src/pages/ActionPlan/index.jsx | Hierarchy modal, selection, add/edit/delete, critical actions and milestones | Preserve awaited callbacks and cancellation behavior |
| payerHierarchy.js / payerHierarchyFields.js | Objective/strategy/tactic queries, relationships and writes | Keep one record per objective; preserve textField |
| payerMappedFields.js | Field catalog and active/deleted helpers | Confirm APIs and FLS before adding fields |
| recordTypes.js / crmEnvironment.js | Record type resolution and target-org classification | Do not substitute Network types for Payer types |
| payerAccountPlan.js / payerAccess.js | Plan resolution and service-level authorization | Do not infer access from visible UI alone |
| query.js / client.js | DataService wrappers and runtime selection | Preserve online/offline ID and query semantics |
| test | Focused regression coverage | Pick tests that exercise changed behavior |
| scripts/postbuild.mjs | Runtime embedding and packaging | Do not move business rules here |

## 7. Runtime mode, plan context and access

### 7.1 Plan entry and resolution

Packaged desktop entry deliberately opens the Account Plan selector, even if the surrounding CRM shell supplies a stale current-object ID. Selecting a plan sets the shared current-plan override, resets payer resolution, sets selectedPlanId and loads the workspace. Change-plan navigation refuses to proceed while a CRM mutation lock is active.

For record-context entry, resolveContextualPayerAccountPlanId reads the shared current-plan context and verifies that it is a Payer Account Plan using buildPayerAccountPlanWhere. The general resolver can fall back to the most recently modified visible Payer plan when no valid contextual plan exists. Its in-flight/cached promise is reset when plan selection changes.

When selectedPlanId changes, App.jsx clears linked readiness and loads hierarchy plus barriers/opportunities concurrently. Rejected reads show a linked-data error and Retry loading; editing remains unavailable until the shared records load successfully.

### 7.2 Edit access

loadPayerAccountPlanAccess reads signed-in User profile/department/primary territory and the plan marketplace. payerAccountPlanAccess grants KPH-Home Office and System Administrator profiles edit access; NPAD and designated leadership departments can edit across territories. KAD requires a full, nonempty primary-territory match. NAD/RAD remain read-only. Unknown or unavailable departments do not grant editing.

Every Payer service mutation calls assertPayerAccountPlanEditable again. Salesforce sharing, CRUD, field permissions and validation remain authoritative. Failure to verify access leaves the app read-only.

Source anchors: App.jsx; payerAccountPlan.js; payerAccess.js; src/lib/payerAccountPlanAccess.js.

## 8. CRM data model quick reference

| Object | Role | Key fields / relationship |
| --- | --- | --- |
| Account_Plan_vod__c | Selected Payer plan and launch/summary fields | Account_vod__c; payer RecordType; KPH_Territory_Description__c |
| KPH_Account_Objective__c | One record per objective | KPH_Account_Plan__c; one of KPH_Objective_1__c / 2 / 3; KPH_Status__c |
| KPH_Strategy__c | Strategy under an objective | KPH_Account_Plan__c; KPH_Account_Objective__c; KPH_Strategy_Title__c; KPH_Strategy_Status__c |
| KPH_Tactics_Resource__c | Tactic/resource under a strategy | Plan, objective and KPH_Strategy__c; KPH_Tactics_and_Resources_Title__c; KPH_Tactic_Status__c |
| KPH_Payers_Barrier_Opportunities__c | Barrier/opportunity record types | KPH_Account_Plan__c; KPH_Account_Objective_Barrier__c; KPH_Strategy__c |
| KPH_Actions_and_Critical_Next_Steps__c | Critical action | KPH_Account_Plan__c; KPH_Linked_Strategy__c stores strategy text |
| KPH_Milestones_and_Engagements__c | Milestone rows and shared notes | KPH_Account_Plan__c; milestone fields and Additional Notes |
| KPH_Key_Wins_Key_Customer_Asks__c | Key wins / payer asks | Separate record types; KPH_Account_Plan__c |
| KPH_Account_Landscape__c | Landscape and assessment data | KPH_Account_Plan__c; Payer Account Landscape record type |
| KPH_Stakeholder_Map__c | Payer stakeholders | KPH_Account_Plan__c; Payer Stakeholder record type |

Objectives, strategies, tactics, barriers/opportunities, actions, milestones, summary children and stakeholders use their mapped KPH_Is_Deleted__c flag. Do not add that filter to every object indiscriminately. CreatedDate and LastModifiedDate are server-managed timestamps. Custom Date fields use their explicit mappings.

### 8.1 Record type discipline

resolveCrmEnvironment uses Organization.IsSandbox when available, checks an optional VITE_CRM_ENVIRONMENT setting, and otherwise defaults to sandbox. A configured/detected mismatch rejects. Vite production mode describes the build, not the connected Salesforce org.

resolveRecordTypeId queries active RecordType metadata. Sandbox entries with confirmed IDs require that ID and compatible name when supplied. Production resolves the matching name/developer name from the connected org, not the sandbox ID. Missing or ambiguous matches fail visibly. Barrier/Opportunities accept confirmed unprefixed labels and explicit Payer aliases; Network aliases are not valid substitutes.

Source anchors: payerHierarchyFields.js; payerMappedFields.js; docs/crm-record-types.md; recordTypes.js; crmEnvironment.js.

## 9. Read/query contract

| Function | Purpose | Operational rule |
| --- | --- | --- |
| runQuery | Default-channel list read | Local preview can use mocks |
| runCrmQuery | Explicit CRM list read | Payer services choose it when hasVeevaRuntime is true |
| unwrap | Convert wrapped CRM cells to plain values | Map rows before comparing fields and IDs |
| buildIdMatchWhere | ID expression | Supports Salesforce ID variants; pass expressions rather than full SELECT text |
| inClause | Runtime-aware IN list | Avoid embedding desktop-only list syntax in shared device queries |
| payerQueryFields | Mapped fields plus deduplicated extras | Add only confirmed object fields |
| payerRecordTypeWhere | Payer type filter | Resolve metadata before issuing the feature query |

where contains an expression only. sort entries omit ORDER BY. Avoid dotted relationship fields unless a supported path explicitly opts in; query related records by ID when necessary. Identical in-flight reads can be coalesced, but callers must not treat that as device synchronization or a permanent server cache.

The objective loader queries all three hierarchy objects concurrently, scoped to the current plan, active deletion flag and appropriate Payer record type. It then filters deleted rows defensively after unwrapping. Missing data can therefore result from plan/type/filter/access conditions, not only an empty object.

## 10. Write and record-lifecycle contract

1. Validate form values and selected context; construct a proposed model without mutating the prior model.
2. Await the parent persistence callback. App.jsx refuses writes without edit access, linked readiness or an available mutation lock.
3. The domain writer reloads relevant current CRM records and rechecks access, relationships and limits.
4. Construct only mapped editable fields; use createCrmRecord or updateRecord with the CRM option in the live runtime.
5. Update visible state only after the awaited write path succeeds. Retain acknowledged IDs and drafts where supported.
6. Verify persistence with a scoped CRM reread or reentry. Separate a successful runtime response from later CRM automation.

Hierarchy writes are sequential, not a CRM transaction. A later failure can leave earlier records saved. App.jsx marks shared data unready after uncertain failures and requests a reload. A first-create record-type/custom-validation rejection can instead return a correctable draft error. Do not retry an entire partially completed creation blindly.

## 11. Worked critical flow: create an objective

### 11.1 Scenario and prerequisites

Use the fictional objective “Improve coverage review readiness” with an available CRM status value, illustrated below as Open. Select the intended Payer plan, confirm edit access, and open Action Plan & Objectives → Objectives, Strategies & Critical Actions. Fewer than three objectives may be open before adding another. The limit counts open statuses, not all stored objectives; completed history can remain visible.

### 11.2 Function-by-function sequence

| Step | Function / location | Input and result |
| --- | --- | --- |
| 1 | CommercialHierarchy.addObjective; pages/ActionPlan/index.jsx | availableObjectiveSlots(hierarchy) permits setItemDraft({ kind: 'objective' }) |
| 2 | HierarchyItemModal | Loads KPH_Status__c picklist; requires title and status; trims title; title maximum 200 characters |
| 3 | Modal submit → saveItem | Calls onSave({ kind, text, status }); new draft has no persisted ID |
| 4 | saveItem | Creates temporary hierarchyId('commercial-objective'); appends objective with strategies: []; validates objective limit |
| 5 | setHierarchy prop → App.persistHierarchy | Resolves functional updater against commercialHierarchy and awaits savePayerHierarchy(previous, next) |
| 6 | savePayerHierarchy | Loads stored hierarchy, rechecks edit access and objective limit, flattens proposed records |
| 7 | New objective mapping | Chooses textField for displayed position, builds title/status/plan fields and Payer objective RecordTypeId |
| 8 | createCrmRecord → crmCreateDs → window.ds.createRecord | Writes KPH_Account_Objective__c; returns saved record ID |
| 9 | savePayerHierarchy return | Replaces temporary ID in returned hierarchy; returns { ids, hierarchy } |
| 10 | App.persistHierarchy → saveItem | Stores saved hierarchy, notifies Saved; selects mapped saved ID, aligns status filter, closes modal |

### 11.3 Concrete payload and returned state

Illustrative payload for the first displayed objective; substitute the selected plan ID, resolved record type and actual allowed status API value. The sample strings in angle brackets are labels, not executable Salesforce IDs.

```javascript
// Object: KPH_Account_Objective__c
{
  KPH_Objective_1__c: 'Improve coverage review readiness',
  KPH_Status__c: 'Open',
  KPH_Account_Plan__c: '<selected-plan-id>',
  RecordTypeId: '<resolved-payerObjective-record-type-id>'
}

// Returned UI model (simplified)
{
  id: '<saved-objective-id>',
  textField: 'KPH_Objective_1__c',
  objective: 'Improve coverage review readiness',
  status: 'Open',
  strategies: []
}
```

Each objective is its own CRM record. The three objective text fields are not three objectives on one record. Existing objectives retain their populated textField when edited. New text-field selection uses displayed index capped at the third field; multiple records can use the same text field. Do not join objectives by text-field name or displayed ordinal.

### 11.4 Failure and verification checkpoints

Blank/overlength titles are stopped by the modal and service checks. A fourth open objective or reopening beyond the limit is rejected. A missing or unavailable Payer record type blocks creation; the error advises checking active assignment and Create access. Partial writes require reloading before retrying.

After creation, record the saved ID. Confirm the expected plan lookup, Payer record type, one populated title field and status. Reopen the app and compare by ID. Immediate post-create mobile queries can lag: savePayerHierarchy deliberately retains acknowledged created IDs instead of replacing them with an immediate stale reload.

Tests: payerHierarchyPersistence.test.mjs; payerHierarchyReadAfterWrite.test.mjs; payerObjectiveLimit.test.mjs; payerObjectiveAddControl.test.mjs.

## 12. Worked critical flow: load and display an objective

### 12.1 Read-to-render sequence

| Step | Function / location | Result |
| --- | --- | --- |
| 1 | App.jsx selectedPlanId effect | Starts loadPayerHierarchy and loadPayerBarriersOpportunities concurrently |
| 2 | loadPayerHierarchy | resolvePayerAccountPlanId obtains plan context |
| 3 | Domain queries | Read OBJECTIVE, STRATEGY and TACTIC with plan, deletion and record-type filters; sort CreatedDate ASC |
| 4 | unwrap / isPayerDeleted | Convert cells to plain values and remove deleted rows |
| 5 | Objective mapping | Require title text; exactly one objective text field populated; map Id, textField, objective and status |
| 6 | sameCrmId joins | Nest strategies by KPH_Account_Objective__c; tactics by KPH_Strategy__c |
| 7 | App state | setCommercialHierarchy(tree.hierarchy), setIssues and setLinkedDataReady(true) |
| 8 | ActionPlanPage → CommercialHierarchy | Props carry hierarchy plus persistence callbacks and selection state |
| 9 | Card render | hierarchy index, status filter and selection determine displayed cards and linked strategy/tactic views |

### 12.2 Query example

This is an illustrative expanded SOQL query for administrator inspection. The application passes a structured query object to runCrmQuery and uses ID helpers plus dynamically resolved record types.

```sql
SELECT Id, KPH_Account_Plan__c, KPH_Objective_1__c,
       KPH_Objective_2__c, KPH_Objective_3__c,
       KPH_Status__c, KPH_Is_Deleted__c, CreatedDate, LastModifiedDate
FROM KPH_Account_Objective__c
WHERE KPH_Account_Plan__c = '<selected-plan-id>'
  AND (KPH_Is_Deleted__c = false OR KPH_Is_Deleted__c = null)
  AND RecordTypeId = '<resolved-payerObjective-record-type-id>'
ORDER BY CreatedDate ASC
```

### 12.3 Mapping example and UI behavior

```javascript
// Plain CRM row after unwrap; other selected fields omitted
{
  Id: '<saved-objective-id>',
  KPH_Objective_2__c: 'Improve coverage review readiness',
  KPH_Status__c: 'Open',
  KPH_Is_Deleted__c: false
}
// loadPayerHierarchy maps it to:
{
  id: '<saved-objective-id>', textField: 'KPH_Objective_2__c',
  objective: 'Improve coverage review readiness',
  status: 'Open', strategies: [/* matched strategies */]
}
```

The rendered card label comes from its position in the current hierarchy, while content comes from objective.objective. Selecting a card updates selectedObjectiveId and linked strategy selection. Status filters can hide an otherwise valid row. The loader omits empty-title records and rejects a record with multiple populated objective title fields as ambiguous.

Do not diagnose a missing card using only a global object query. First compare selected plan ID, Payer record type, title population, deletion state and status filter. Inspect the linked-data error and Retry loading state before changing CRM data.

Tests: payerHierarchyReadAfterWrite.test.mjs; payerHierarchyPersistence.test.mjs; hierarchyStatusFilter.test.mjs.

## 13. Worked critical flows: child creation, completion and deletion

### 13.1 Create a strategy and tactic/resource

addStrategy(objectiveId) or addTactic(objectiveId, strategyId) opens the shared HierarchyItemModal with read-only linked context. saveItem changes the relevant nested array, then calls the same App.persistHierarchy → savePayerHierarchy path.

| Record | Title and status | Relationships sent |
| --- | --- | --- |
| Strategy | KPH_Strategy_Title__c; KPH_Strategy_Status__c | KPH_Account_Objective__c; KPH_Account_Plan__c on create |
| Tactic/resource | KPH_Tactics_and_Resources_Title__c; KPH_Tactic_Status__c | KPH_Account_Objective__c; KPH_Strategy__c; KPH_Account_Plan__c on create |

flat(next) visits objective, strategy and tactic in parent-first order. The ids mapping substitutes newly saved parent IDs in child payloads. Existing title/status changes use updateRecord. All hierarchy titles use the 1–200 character service constraint.

### 13.2 Complete an objective or strategy

completionDependencies collects incomplete linked descendants for an existing objective/strategy moving to a completed status. The modal lists them and requires an explicit checkbox confirmation. completeDependencies chooses one unambiguous completion API value from CRM picklist options for each affected kind; missing/ambiguous metadata blocks the cascade.

For objective completion, strategies/tactics, linked strategy barriers and objective opportunities are considered. Strategy completion considers that strategy's tactics and barriers, preserving sibling strategies and objective opportunities. saveItem persists issue changes first, then hierarchy changes. A later hierarchy failure can therefore follow successful issue writes; reload before repair. Critical actions are not part of this completion helper.

### 13.3 Delete an objective

1. deleteObjective gathers all child strategy and tactic names and linked barriers/opportunities, including items hidden by current filters.
2. Two confirmDeletion prompts describe the scope and require confirmation. Canceling either leaves the records unchanged.
3. App.persistIssues deletes linked issue rows through deletePayerBarrierOpportunity first.
4. App.persistHierarchy passes the objective-removed proposal to savePayerHierarchy.
5. The deletion loop reverses the flattened prior records so tactics precede strategies and the objective. Each removed stored record receives { KPH_Is_Deleted__c: true }.
6. An error response is accepted only when the verification path confirms the saved flag, or the recognized NOT_FOUND path confirms absence by ID. Otherwise the write error propagates.
7. On success, the UI clears selected objective/strategy/tactic context and the loader excludes deleted rows on reentry.

This code requests soft deletion and preserves title/status fields. Server automation may subsequently remove a record; inspect the actual org outcome. The browser flow does not call the native deleteRecord wrapper for this operation.

Critical actions are preserved by objective/strategy deletion. They store linked strategy text, not the hierarchy's strategy lookup ID. Do not extend the cascade to actions without an explicit requirement.

### 13.4 Verify deletion correctly

Inspect the specific saved record ID. If a normal export returns no rows, enable the export tool's Deleted/Archived Records option and include both native IsDeleted and custom KPH_Is_Deleted__c. The recent support session was resolved after the user enabled that option; the actual returned field values were not supplied.

```sql
SELECT Id, IsDeleted, KPH_Is_Deleted__c,
       KPH_Objective_1__c, KPH_Objective_2__c,
       KPH_Objective_3__c, LastModifiedDate
FROM KPH_Account_Objective__c
WHERE Id = '<saved-objective-id>'
```

Record whether the custom flag is true, native IsDeleted is true, or no accessible row is returned even with deleted records included. Those outcomes require different investigation; an empty ordinary query alone is not proof that the flag write failed or that a particular Flow ran.

Tests: objectiveDeletionConfirmation.test.mjs; payerHierarchyReadAfterWrite.test.mjs; hierarchyCompletion.test.mjs; payerHierarchyPersistence.test.mjs.

## 14. Other critical application flows

### 14.1 Barriers and opportunities

loadPayerBarriersOpportunities reads KPH_Payers_Barrier_Opportunities__c for the selected plan, active flag and resolved Barrier/Opportunity record types. payerBarrierOpportunityFromRow identifies the type from populated type-specific fields and rejects mixed records. savePayerBarrierOpportunity maps only the selected type's fields, validates plan membership on update and preserves the existing type.

The objective lookup is KPH_Account_Objective_Barrier__c; strategy is KPH_Strategy__c. Both types use that shared strategy field when supplied. Do not restore retired similarly named lookup APIs from older mapping documents without confirmation.

### 14.2 Critical actions

ActionPlanPage calls savePayerCriticalAction, then reloads actions. New actions inherit selected strategy text in the modal; KPH_Linked_Strategy__c stores that text. The writer maps the action, people/roles, timing, status and next steps and checks plan membership/access. Action title limit is 500; next steps limit is 5000. The writer enforces limits for other mapped text values as well. Deletion sets the mapped flag.

### 14.3 Milestones and shared notes

savePayerMilestone writes changed mapped fields and validates the title. loadPayerMilestones separates titled milestone rows from one shared Additional Notes view. savePayerMilestoneNotes selects the shared-notes row, writes a custom updated date and re-reads to confirm text persistence. Before deleting the row carrying shared notes, deletePayerMilestone preserves those notes on a separate record. Notes are not a per-milestone UI field.

### 14.4 Summary, landscape, stakeholders and launch readiness

Executive Summary uses payerExecutiveSummary.js: plan fields, Payer Archetype and its reread formula, separate key win/payer ask record types. Landscape uses payerAccountLandscape.js and payerAssessments.js, with mapped field/date pairs and scoped records. Stakeholder Map uses payerStakeholders.js, including plan checks and CRM/mobile ID handling. LaunchReadinessPlan tracks dirty keys by group and calls savePayerLaunchReadiness only for the saved group. Read those dedicated maps before changing fields that have similar display labels.

### 14.5 Whole-plan PowerPoint export

Opening Export in MarketAccessSidebar starts preparePayerAccountPlanPpt. loadPayerExportData loads ten feature payloads concurrently and rejects a plan-ID mismatch. buildPayerAccountPlanSlides creates content, createAccountPlanPresentation builds the presentation, and presentation.write returns a nonempty blob. The user then triggers delivery; Open / Save PPT provides a manual path when needed. Request IDs invalidate stale preparations when plan context changes. The exported plan must match the selected plan, even when pages have not been visited.

Source anchors: payerBarriersOpportunities.js; payerCriticalActions.js; payerMilestones.js; payerExecutiveSummary.js; payerAccountLandscape.js; payerStakeholders.js; payerLaunchReadiness.js; payerAccountPlanPpt.js; MarketAccessSidebar.jsx.

---

PART III

# Development procedures

Keep schema, UI state and runtime boundaries traceable.

## 15. Set up a development workspace

1. Confirm Prod-PayerAP and upstream. Capture status before installing dependencies or building.
2. Use a Node/npm environment compatible with the lockfile. npm ci replaces installed dependencies; preserve unrelated local work first.
3. Start Vite, use fictional records, and confirm local adapter behavior.
4. Locate the page, domain service, field map and closest tests before editing.
5. Run focused checks, inspect the intended diff, and build the CRM package when runtime behavior changed.

This checkout has tracked dependency content and unrelated archive deletions/modifications. Stage explicit paths. Do not include node_modules, .DS_Store or unrelated ZIP changes in a business change commit merely because they appear in status.

## 16. Add or change a mapped field

1. Confirm exact object, API name, type, read/write permission and offline availability in the intended org.
2. Update the feature mapping and payerMappedFields catalog where appropriate. Update the maintained mapping documentation separately from source examples.
3. Trace loader → mapper → UI → editor → writer → CRM field. Use API values for picklists and display labels only for presentation.
4. Add validation at the domain boundary; preserve dates, blanks/nulls, boolean values and existing relationship IDs correctly.
5. Choose a meaningful focused regression: payload field, parent link, plan guard, reload persistence or failure behavior.
6. Verify the deployed query/write with the intended user. Local fixtures cannot prove FLS, validation or automation.

For hierarchy changes, preserve existing textField; enforce the three-open-objective rule when adding or reopening; keep source arrays immutable; retain acknowledgment IDs; and review completion/deletion cascades for hidden descendants.

## 17. KT exercises and acceptance criteria

| Exercise | Perform | Acceptance evidence |
| --- | --- | --- |
| Objective create/read | Add the fictional coverage objective, reopen, trace saved ID | Exact call chain, payload and loaded model explained; one CRM record |
| Hierarchy links | Add a strategy and tactic/resource | Saved parent IDs match both child payloads; records reload nested correctly |
| Completion | Complete an objective with open descendants, cancel once, then confirm | Cancel preserves data; confirmed scope changes only intended descendants |
| Deletion | Delete an agreed test objective, verify flagged/deleted record by ID | Both prompts understood; descendants handled; actions preserved; deleted-record export considered |
| Access | Compare permitted editor and read-only user | UI and service mutation checks agree; unknown access fails closed |
| Error recovery | Explain a partial child-write failure | Identify saved IDs and reload/repair rather than duplicate creation |
| Export | Export after switching plans | PPT reflects selected plan and reports load/preparation failures |

A KT recipient should demonstrate the create/read traces without relying on a diagram alone, identify the exact object.field for one displayed value, select the closest test, and explain the difference between an application ZIP rollback and CRM data remediation.

## 18. Local fixtures and packaged-data boundaries

Local Vite uses the mock adapter; mock changes are tied to local storage and context. Clearing site data can reset them. Fixtures should be clearly fictional and shaped like CRM responses, including relationships and wrapped values when relevant.

Prod-PayerAP has no build:training script. npm run build and build:live are both CRM-live. vite.config.js aliases the bundled mock adapter and fixture module to live stubs for packaged builds. Missing runtime access rejects instead of silently substituting a training scenario. verify:training-data remains a repository utility; its presence is not a supported training build path.

Do not copy the reference Medical SOP's hybrid runtime matrix into this branch. Check package.json, client.js, Vite aliases and the actual service caller when determining persistence behavior.

---

PART IV

# Quality and release

Prove the changed behavior, exact artifact and target branch.

## 19. Testing strategy and recorded results

| Gate | Evidence required |
| --- | --- |
| Focused behavior | Exact file list, test count and exit status |
| Broader regression | Run for cross-cutting changes; classify pre-existing failures |
| Rendered QA | Actual navigation/modal/filter/export checks at relevant viewports |
| Build | Fresh live build exit and output filenames |
| Artifact audit | Root entries, embedded runtimes, HTML byte match and ZIP hash |
| CRM/device | User/org/client, exact saved record fields, automation and sync result |

### 19.1 Verified focused command

```bash
node --test --test-concurrency=1 \
  test/payerHierarchyPersistence.test.mjs \
  test/payerHierarchyReadAfterWrite.test.mjs \
  test/objectiveDeletionConfirmation.test.mjs \
  test/hierarchyCompletion.test.mjs \
  test/payerObjectiveLimit.test.mjs \
  test/crmEnvironmentRecordTypes.test.mjs \
  test/payerAccess.test.mjs
```

Result for the SOP baseline: 62 passed, zero failed. Serial execution avoids collisions between Vite-backed test setup instances. Test infrastructure may require a permitted local port.

### 19.2 Known limitation

The complete catalog test has the pre-existing field discrepancy described in the evidence boundaries. It must be reconciled against the confirmed schema separately; do not add an obsolete query field just to make the comparison pass. No full-suite success is claimed here.

For a broader requested check, discover test files first and run the appropriate suite. Local tests do not replace a real MyInsights save/query, field access check or iPad sync test.

## 20. Build and package

### 20.1 Commands and semantics

```bash
npm run build
# Equivalent explicit live alias:
npm run build:live
```

Both commands run vite build --mode production followed by node scripts/postbuild.mjs live. Vite targets ES2022, uses relative paths and inlines application JS/CSS. postbuild embeds q.js and MyInsightsLibrary.js as base64 data-URI scripts, removes the copied static/assets output and creates date-only plus timestamped ZIPs.

### 20.2 Expected outputs

```text
dist/index.html
dist/kite_myinsights_v2_live_YYYY-MM-DD.zip
dist/kite_myinsights_v2_live_YYYYMMDD_HHMMSS.zip

ZIP entries:
  index.html
```

postbuild names artifacts using UTC. Vite empties dist on build; retain an approved prior release artifact elsewhere before rebuilding when needed. The generated HTML is a build artifact, not the source to edit.

### 20.3 Artifact audit

Verify one root index.html, no enclosing folder, and no source, tests, dependencies or credentials. Compare ZIP HTML bytes to dist/index.html. Confirm embedded q.js precedes MyInsightsLibrary.js and unresolved ./static script references are absent. Record size and SHA-256. Use the exact timestamped artifact for handoff, since the date-only filename can be replaced by a later build.

```bash
unzip -l dist/<actual-timestamped-live-file>.zip
shasum -a 256 dist/<actual-timestamped-live-file>.zip
```

These are command templates; replace angle-bracket filenames before execution. On Windows, use Get-FileHash -Algorithm SHA256 and an approved archive viewer.

## 21. Veeva deployment handoff

1. Record intended org, report/content record, Payer plan entry, user/profile and release owner.
2. Capture branch, application commit, documentation revision, test result and exact ZIP path/hash.
3. Preserve the prior approved package and identify rollback criteria and ownership.
4. Upload through the team's MyInsights content process. Check target-org report configuration rather than assuming a branch name determines the org.
5. Reopen MyInsights. Verify desktop plan selection and the intended Payer records.
6. Smoke-test create → reload → edit → completion/deletion on agreed test data; query by saved record ID. Include Deleted/Archived Records when investigating native-deleted rows.
7. Check read-only behavior, barriers links, notes preservation and PowerPoint export.
8. If iPad is in scope, synchronize and repeat affected online/offline flows on the actual device.
9. Record observed outcomes, limitations and recovery action. Do not infer success solely from a disappearing card or toast.

### 21.1 Release evidence template

| Item | Record at release |
| --- | --- |
| Source | Prod-PayerAP; full application SHA; SOP revision; upstream |
| Artifact | Live ZIP filename, absolute path, bytes and SHA-256 |
| Verification | Tests, build exit, archive audit and rendered flows |
| Environment | Org, report/content record, user/profile, browser/device |
| Data | Saved objective ID, plan/type/title/status/deletion fields and reload outcome |
| Automation | Observed native deletion/Flow evidence, if available; otherwise unverified |
| Offline | Device, last sync, object/field availability and affected flow result |
| Recovery | Previous package/hash, rollback owner and data remediation owner |

### 21.2 Rollback scope

Restoring an older HTML ZIP restores application behavior, not CRM data already created, updated or deleted. Preserve affected IDs and before/after evidence and coordinate any data repair with the CRM owner. Changing code cannot restore a permanently removed record by itself.

## 22. Git branch, pull and push procedure

### 22.1 Establish target and preserve work

```bash
git status --short --branch
git branch --show-current
git remote -v
git fetch origin
git rev-list --left-right --count HEAD...origin/Prod-PayerAP
```

The intended branch here is exactly Prod-PayerAP and the remote is origin. Preserve unrelated files and inspect divergence before integrating. Use a deliberate fast-forward or agreed merge/rebase flow; never force push to bypass divergence. Authentication and restricted-filesystem errors are access issues, not a reason to change the remote or discard files.

### 22.2 Commit and push

Stage explicit intended files, inspect the staged diff and run relevant checks. Build output is included only when intentionally updating the repository's tracked bundle. Exclude unrelated dependency changes, archives and operating-system metadata.

```bash
git diff --check -- src test docs dist
git diff --cached --stat
git commit -m '<specific change description>'
git push origin HEAD:Prod-PayerAP
git ls-remote origin refs/heads/Prod-PayerAP
git rev-parse HEAD
```

After pushing, compare the remote branch SHA with local HEAD and retain the result as publishing evidence. Publishing Git source and uploading a MyInsights package are separate operations.

## 23. Definition of done

- Correct branch/upstream and intended changes recorded; unrelated work preserved.
- UI → model → domain function → CRM object.field → loaded UI trace documented.
- Focused checks pass; broader known failures and unrun checks are explicit.
- Build and archive checks completed for a release artifact.
- Access, relationships, deletion, completion, partial failures and ID mapping assessed.
- Exact pushed SHA and package hash available for handoff.
- Actual CRM/device validation distinguished from local tests and user-reported evidence.
- SOP, mappings and release record updated for material behavior changes.

---

PART V

# Support and troubleshooting

Classify the failing boundary before changing code or CRM data.

## 24. Incident intake template

| Capture | Guidance |
| --- | --- |
| Runtime | Local Vite, desktop MyInsights, iPad online/offline |
| Source/artifact | Branch, application SHA, exact uploaded ZIP and hash |
| Context | Plan ID, objective/child IDs, user/profile, org and last device sync |
| Action | Exact buttons, values, filters and confirmation choices |
| Expected/actual | Visibility, saved field, status, relationship or export difference |
| Evidence | Sanitized console/error, query result and exact object/field names |
| Scope | One record/user or reproducible across plans and profiles |

## 25. Failure classification

| Symptom | First boundary to check | First evidence |
| --- | --- | --- |
| Blank app or endless loading | Bootstrap/context/query | window.ds, first rejected read and linked-data error |
| Objective missing | Plan/type/active/title/status filters | Saved ID, query fields, selected plan, UI filter |
| New objective appears then vanishes | Create acknowledgment vs later read | Returned ID, current plan, CRM title/flag and automation |
| Deleted card gone but ordinary export empty | Custom flag vs native deletion visibility | Enable Deleted/Archived Records; inspect both deletion fields by ID |
| Fourth open objective rejected | Intended limit | Open-objective count and statuses |
| Record type create rejected | Metadata/assignment/access | Environment, configured sandbox ID or production name, actual Salesforce error |
| Read-only user cannot save | Intended access or verification failure | Department/profile/territory and service recheck |
| Some cascade records saved | Sequential partial write | Last successful object/ID; reload before retry |
| Milestone removed, notes still present | Intended notes preservation | Separate shared-notes record |
| Desktop correct, iPad stale | Sync/config/query | Last sync, object/field availability and ID formats |
| PowerPoint wrong/missing plan | Export snapshot/context | Selected plan and mismatched loader plan IDs |

## 26. Troubleshooting playbooks

### 26.1 Objective absent from the UI

Capture the saved objective ID, then inspect its plan lookup and Payer record type. Check custom/native deletion state, exactly one populated title field and status. Clear relevant UI status filters and reenter the correct plan. If shared load failed, use Retry loading and inspect the primary query error. Do not create a replacement record until the original is located.

### 26.2 Deletion and empty query results

The application writes KPH_Is_Deleted__c, while IsDeleted is the native Salesforce deletion indicator. Inspect both using an export mode that includes deleted records. CRM automation can change the record after an application write; the code does not establish which automation is configured. Retain the ID and LastModifiedDate and ask the CRM owner to inspect automation when the observed result differs from the requested flag update.

The November 17 desktop session was resolved by enabling Deleted/Archived Records. That support outcome should not be generalized to every empty query: access, wrong org/ID, plan/type filters and permanent deletion must still be distinguished.

### 26.3 Record type or permission failure

Read the detailed error from crmWriteError, not only a generic RecordError. Confirm Organization.IsSandbox or the explicit environment setting. Inspect active metadata and user availability for the exact Payer record type and object. Production must resolve its own org ID. Never retry creation with a Network type or omit the required type to bypass a rejection.

### 26.4 Partial create or cascade failure

Stop repeating the full operation. Record successful returned IDs, reload the plan and identify which child/issue writes persisted. Correct validation, access or metadata on the failing object, then repair only the remaining scope. App.jsx deliberately pauses shared editing after uncertain failures. Canceling a confirmation and a failed write are different states; compare actual records before cleanup.

### 26.5 Wrong package or missing runtime

Check the exact uploaded ZIP, timestamp, HTML bytes and embedded runtimes. Verify the app is reopened against that content record. Local Vite fixture behavior does not prove a packaged write. A packaged app without window.ds must report runtime failure instead of switching to mock data. If the wrong org is detected, correct configuration rather than weakening record-type checks.

### 26.6 Device and export discrepancies

On iPad, establish the last completed synchronization and affected object/field coverage before comparing with desktop. Refreshing React state cannot download records excluded from mobile configuration. For PowerPoint, reopen Export after plan changes, inspect loader errors and use the manual Open / Save PPT path if delivery is blocked. Compare exported values with the same selected plan.

## 27. Security and data handling

Use fictional examples and sanitized diagnostics. Do not place credentials, session tokens or private keys in source, documents, browser code or artifacts. Query results, stakeholder names and account identifiers can be sensitive; share the minimum needed for diagnosis.

Respect CRM sharing, CRUD/FLS, record-type access and validation. UI canEdit is a presentation gate plus service check, not a substitute for Salesforce enforcement. Capture exact environment and saved ID before investigating a connected write. Review exported PPTs and release ZIPs for unintended content.

Code rollback and data remediation have separate owners and evidence. Avoid bulk cleanup based on inferred or incomplete query results.

## 28. Glossary

| Term | Meaning |
| --- | --- |
| MyInsights / DataService | Veeva HTML application runtime / window.ds bridge |
| Objective hierarchy | Objective → strategy → tactic/resource; nested UI models backed by separate CRM records |
| textField | Existing objective's selected KPH_Objective_1__c / 2 / 3 field, retained on edits |
| Temporary ID / ids map | Local draft identifier / mapping to CRM-created record ID |
| Custom soft deletion | KPH_Is_Deleted__c flag used by the application |
| Native deletion | Salesforce IsDeleted state, distinct from the custom flag |
| FLS / mobile configuration | Field-level security / Veeva object/field and synchronization configuration |
| KAD / NPAD / NAD / RAD | Key Account Director / National Payer Account Director / National Account Director / Regional Account Director |
| Live package / local fixture | CRM-connected deployable bundle / fictional local development data |
| Partial write | Earlier sequential changes persisted before a later operation failed |

## 29. Command reference

```bash
git status --short --branch
git rev-parse HEAD
git diff --check -- src test docs dist
rg -n 'savePayerHierarchy|loadPayerHierarchy' src test
npm run dev -- --host 127.0.0.1 --port 5173
node --test --test-concurrency=1 test/payerHierarchyReadAfterWrite.test.mjs
npm run build:live
unzip -l dist/<actual-timestamped-live-file>.zip
shasum -a 256 dist/<actual-timestamped-live-file>.zip
git push origin HEAD:Prod-PayerAP
git ls-remote origin refs/heads/Prod-PayerAP
```

These are operator procedures, not actions implied by reading this SOP. Confirm the intended context and scope before running mutations or deployment commands. Replace placeholder filenames and do not paste illustrative angle-bracket IDs into live queries.

## 30. Maintenance and ownership

Update application SHA, branch/upstream, active pages, mappings, record types, access rules, objective lifecycle, validation evidence and build naming after material changes. Keep the Word and Markdown editions aligned. Word page numbers are fields and update when opened or printed; the document map uses section numbers to avoid stale fixed page references.

Assign a named technical owner and reviewer at handoff. Maintain release evidence separately with the pushed documentation revision, exact package hash, org/client, CRM/device outcomes, outstanding issues and recovery owner. Each behavior claim should remain traceable to application source, a meaningful test or clearly attributed observed evidence.
