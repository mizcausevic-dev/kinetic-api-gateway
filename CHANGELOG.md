# Changelog

All notable changes to this project are documented here.

## [1.0.0] - 2026-05-12

### Released
- Published **kinetic-api-gateway** as a core Node and Express backend in the pinned public set.
- Packaged lead scoring, campaign visibility, and revenue workflow automation into a clean API-first operator story.
- Tightened the repo around the idea that GTM workflow systems need stable contracts before they need fancy surfaces.

### Why this mattered
- Many growth and revenue automations fail because the state transitions and service boundaries are murky.
- Teams often have tools for each step but no trustworthy contract at the center.
- This release made the repo credible as backend infrastructure for revenue workflows.

## [0.1.0] - 2026-01-24

### Shipped
- Standardized the first internal API model for leads, campaigns, scoring, and workflow triggers.
- Added the first operator-visible paths for turning go-to-market signals into routable actions.

## [Prototype] - 2025-04-30

### Built
- Built an initial Node and Express service around revenue event handling and lead-scoring surfaces.
- Tested whether the API contract could stay simple while still supporting realistic GTM decisioning.

## [Design Phase] - 2024-02-12

### Designed
- Kept the project contract-first and workflow-aware.
- Avoided turning the repo into a generic REST sample with business nouns attached.
- Framed the service around GTM actionability, not endpoint count.

## [Idea Origin] - 2023-03-29

### Observed
- The concept emerged from repeated situations where teams had automation ambition but brittle workflow contracts.
- The missing layer was a backend surface that treated revenue operations as a system, not a pile of webhooks.