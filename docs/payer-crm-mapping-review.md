# Payer CRM mapping review

Source: complete user-provided field mapping, October 9, 2026. The normalized UI label, CRM API, object, and type for every supplied row are retained in `payer-complete-field-mapping.json`. Custom API names without a suffix use the previously confirmed `__c` suffix.

## Implemented

`src/lib/dataservice/accountPlan/payerMappedFields.js` contains the complete query catalog. Active payer services use this catalog so supplied fields on their objects are included in reads.

- Executive Summary and account header: `Account_Plan_vod__c`.
- Key Wins / Customer Asks: `KPH_Key_Wins_Key_Customer_Asks__c`, separated by their existing record types.
- Network Approach, Decision Making, Quality of Access, and payer assessments: `KPH_Account_Landscape__c`. Assessment APIs now use the complete mapping, replacing the earlier Stakeholder Map mapping. Quality of Access Score now loads and saves `KPH_Quality_of_Access_Score__c`.
- Key Stakeholders: `KPH_Stakeholder_Map__c`.
- Anito-cel Pre-Launch Insights and Commentary: mapped Account Plan fields, paired update dates, CRM picklist values, separate section saves, and supplied text limits.
- Milestones & Engagements: `KPH_Milestones_and_Engagements__c`, scoped through user-confirmed `KPH_Account_Plan__c`. Custom created/updated Date fields are retained. Additional Notes remains one shared box below the table, as corrected by the user. Deleting a milestone preserves shared notes.

Key Wins, Stakeholders, and Milestones now use the supplied `KPH_Is_Deleted__c` flag instead of clearing content. Queries exclude deleted records. System Created/Updated dates retain the previously confirmed normal semantics (`CreatedDate`/`LastModifiedDate`), despite reversed labels in some mapping rows.

## Hierarchy and linked records

Objectives use one `KPH_Account_Objective__c` record per objective, scoped by the confirmed `KPH_Account_Plan__c` lookup. Existing records preserve whichever Objective 1/2/3 field is populated; newly created objectives use the field for their displayed position. Multiple populated text fields on one objective record are rejected as ambiguous. Strategies and tactics use CRM parent IDs. Account-plan selection reloads the hierarchy and barriers/opportunities from CRM.

Actions persist the strategy title in `KPH_Linked_Strategy__c`. New actions inherit the selected strategy as read-only text. Duplicate titles are not automatically assigned to one strategy. Actions, objectives, strategies, tactics, and barriers/opportunities use `KPH_Is_Deleted__c` and preserve their content. The objective deletion field was confirmed by the user on November 17, 2026. Hierarchy queries exclude deleted records. Cascade operations run sequentially and stop on errors; they are not a CRM transaction. Partial failures require reloading the plan before retrying.

Linked-record loading and write errors are shown, and editing is gated until records are loaded. The app no longer resets these records to fixtures when switching plans. System created/updated fields remain server-managed.

Removed UI dropdowns and Test KPI have not been restored merely because their APIs appear in the catalog. Payer Archetype Definition reads the read-only Account Plan formula `KPH_Payer_Archetype_Definition__c`, confirmed in Salesforce on October 21, 2026. The app re-queries it after archetype saves; the PowerPoint export uses the same CRM value.

## Validation

Regression coverage includes summary save/reload, stakeholder and assessment persistence, duplicate assessment selection, scoped barriers mapping, milestone/shared-note persistence, and section saves. A complete-catalog test checks every supplied mapping row and verifies independent launch saves and text limits. Vite production build is checked separately. These checks use the local adapter; live CRM field existence, permissions, and VMOC availability still require verification in the target org. No live CRM data was modified.

## Target CRM field visibility

The user's Object Manager screenshot confirms `KPH_Is_Deleted__c` on `KPH_Key_Wins_Key_Customer_Asks__c`. Queries and soft deletion use this field and preserve record content. The earlier exclusion/content-clearing workaround has been removed. A missing-column response alone does not prove a field is absent: verify field-level Read/Edit access for the actual querying user and that the running app uses the same org. Runtime access has not been verified here.

## Barrier / Opportunity strategy link

User supplied `KPH_Strategy__c` on `KPH_Payers_Barrier_Opportunities__c`. The service queries it and maps `strategyId` to it for both types on reads and saves. The confirmed strategy mapping is `KPH_Strategy__c`. The unused `KPH_Barrier_Strategy__c` is excluded from queries and writes following the user’s correction. The shared strategy field does not determine whether a row is a Barrier or Opportunity. UI persistence still awaits the hierarchy prerequisites above.

Network Size and Network Porosity now read CRM picklist options and save `KPH_Network_Size__c` and `KPH_Network_Porosity__c` with Network Approach. The two retired Network Model/Covered Sites APIs are removed from queries and mappings.

The Executive Summary Anito-cel Launch dropdowns now load CRM picklists and autosave the confirmed Account Plan fields `KPH_AE_Value_Prop_Meeting_Request_Sent__c` and `KPH_ValueProp_Delivered_Within_90_Days__c`. Either save stamps the shared `KPH_Anito_Cel_Update_date__c` Date field.

## Date write behavior

Custom created/updated Date fields use `crmDateToday()` (`YYYY-MM-DD`, device calendar day). Executive Summary autosaves stamp their associated date, including the shared Anito-cel date. Launch readiness saves stamp dates for the edited keys. Assessment saves stamp the changed level/comment's date. Landscape policy saves enforce the mapped date in the service, even when the caller omits it. Milestone creation sets custom created/updated dates; edits preserve created date, and shared notes saves stamp only the notes date. Salesforce system `CreatedDate` and `LastModifiedDate` remain server-managed DateTime fields. User-selected Key Wins dates and Timing values are not replaced with audit timestamps.

CAR T Focus/Expertise comments stamp the confirmed Date field `KPH_CAR_T_Focus_Expertise_Comm_Upd_Date__c` when changed.

Barrier/objective lookup correction: on KPH_Payers_Barrier_Opportunities__c, KPH_Account_Plan__c scopes records to the Account Plan; KPH_Account_Objective_Barrier__c stores the barrier objective. KPH_Barrier_Objective__c is no longer queried or written. Opportunities retain KPH_Opportunities_Objective__c.
