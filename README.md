# MAx Payer Account Plan

React + Vite implementation of the Payer Account Plan for Veeva MyInsights.
Local development uses a Veeva-shaped mock adapter, so the complete plan can be
reviewed without a CRM login or connected data.

## Preview on localhost

From this repository:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Fixture data is enabled
only by the local Vite development server.

For a populated plan, open the [11-inch iPad preview](http://localhost:5173/?preview=ipad-11)
or the [desktop demo](http://localhost:5173/?demo=populated). These include linked
objectives, strategies, tactics, barriers, opportunities, stakeholders, actions,
milestones, and summary records. Demo edits persist in a separate local-storage
namespace so they do not overwrite data saved in the basic preview.

## Mock data

- CRM-shaped records: `src/lib/mockData/fixtures.js`
- Populated Payer preview records: `src/lib/mockData/payerPreviewFixtures.js`
- Picklists and local Veeva adapter: `src/lib/mockData/mockAdapter.js`

## Build for Veeva CRM

```bash
npm run build
```

The default command creates a CRM-only ZIP in `dist/`. It embeds the Veeva Q
and MyInsights DataService libraries, excludes local Payer fixtures, and
validates that known mock records did not leak into the bundle. The package
must run inside Veeva MyInsights; without `window.ds` it displays a runtime
error or empty state rather than mock records.

`npm run build:live` is an explicit alias for the same live build. There is no
mock-backed ZIP build; mock data is restricted to `npm run dev`.

Each live build removes older live Veeva bundles from `dist/`, keeping only
the latest build's dated ZIP and timestamped ZIP.

## CRM environment and record types

Sandbox is the default CRM environment. The app checks the connected org's
`Organization.IsSandbox`; an explicit production result selects production.
For offline deployments where org metadata is unavailable, set
`VITE_CRM_ENVIRONMENT=sandbox` or `VITE_CRM_ENVIRONMENT=production` at build time.
A conflict between configuration and the connected org blocks record type use.
`npm run build` does not select the production CRM environment.

The supplied workbook IDs are sandbox mappings. Live production IDs are resolved
from that org's active RecordType metadata. See
[CRM environments and record types](docs/crm-record-types.md) for scope and setup.
