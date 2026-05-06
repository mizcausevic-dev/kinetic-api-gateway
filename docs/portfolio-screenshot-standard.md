# Portfolio Screenshot Standard

## Purpose

Every portfolio repository should include a small set of screenshots that quickly prove:

- what the project is
- what it looks like or returns
- that it actually works

This keeps repositories recruiter-friendly and visually consistent across frontend, backend, and data projects.

## Folder Convention

Create a top-level folder named:

```text
screenshots/
```

Recommended contents:

```text
screenshots/
  01-hero.png
  02-feature.png
  03-proof.png
  04-mobile-or-detail.png
```

Use only the screenshots that make sense for the project. Three is usually enough.

## Naming Standard

Use ordered filenames so screenshots render and sort predictably:

- `01-hero.png`
- `02-feature.png`
- `03-proof.png`
- `04-mobile-or-detail.png`

If a project needs more specificity, use:

- `01-home-dashboard.png`
- `02-api-docs.png`
- `03-test-results.png`

## Dimensions

### Standard README Screenshots

- `1600x900` preferred
- `1440x900` acceptable

### Social / Portfolio Preview Images

- `1280x640`

### Mobile Screenshots

- around `900x1600`

Keep dimensions consistent within each repo when possible.

## Screenshot Rules By Project Type

### Frontend Projects

Capture:

1. Hero screen or homepage
2. Core interaction or feature state
3. Mobile or responsive view

Optional:

- analytics view
- settings panel
- success state

### Backend / API Projects

Capture:

1. Swagger / OpenAPI docs page
2. Example API response or request/response workflow
3. Proof-of-function screen such as test results or architecture diagram

Optional:

- Postman collection
- terminal run output
- monitoring or logs screenshot

### Data / SQL / Analytics Projects

Capture:

1. Schema / ERD diagram
2. Query results or dashboard output
3. Metric or insight screenshot

Optional:

- seed data preview
- notebook chart
- warehouse / BI output

## README Placement Standard

Place screenshots after the project overview and before deep technical detail.

Recommended section:

```md
## Screenshots

### Hero View
![Hero View](./screenshots/01-hero.png)

### Core Feature
![Core Feature](./screenshots/02-feature.png)

### Proof of Function
![Proof of Function](./screenshots/03-proof.png)
```

## Screenshot Quality Standard

Default workflow:

- capture clean screenshots quickly
- crop only if needed
- keep interface readable
- avoid cluttered browser chrome when possible

Manual polish is worth doing only for:

- portfolio homepage images
- LinkedIn post images
- hero visuals for flagship projects

## Do Not Include

- real secrets, API keys, tokens, or customer data
- messy desktops or unrelated browser tabs
- broken states unless explicitly presented as debugging work
- unreadable tiny screenshots

## Per-Project Minimum

Every repo should aim for:

1. one hero screenshot
2. one proof-of-function screenshot
3. one technical or feature screenshot

## Kinetic API Gateway Recommendation

For this project, the ideal screenshots are:

1. Swagger UI at `/docs`
2. Example `POST /api/score` request/response
3. Test run or architecture diagram
