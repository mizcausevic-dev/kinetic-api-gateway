# Kinetic API Gateway: architecture diagrams

Source of truth: `src/` at commit `43006ce`. In-memory, no auth, no DB. GitHub renders the Mermaid blocks below natively.

## Request flow

```mermaid
flowchart TD
  client([HTTP client]) --> server["src/server.js<br/>app.listen(PORT || 3000)"]
  server --> app["src/app.js<br/>dotenv + openapi.yaml parsed at boot"]
  subgraph mw["Global middleware, registration order"]
    direction LR
    helmet["helmet()"] --> cors["cors() origin *"] --> morgan["morgan('dev')"] --> json["express.json()"]
  end
  app --> helmet
  json --> docs["/docs<br/>swagger-ui-express"]
  json --> health["GET /health<br/>routes/health.js"]
  json --> leads["GET /api/leads, /api/leads/:id<br/>routes/leads.js"]
  json --> accounts["GET /api/accounts<br/>routes/accounts.js"]
  json --> campaigns["GET /api/campaigns<br/>routes/campaigns.js"]
  json --> score["POST /api/score<br/>routes/score.js"]
  json --> nf["catch-all 404"]
  docs --> spec[("docs/openapi.yaml")]
  health --> locals["app.locals.serviceName<br/>process.uptime()"]
  leads & accounts & campaigns --> data[("src/data.js<br/>3 accounts, 5 leads, 4 campaigns")]
  score --> scoring["src/utils/scoring.js<br/>pure, no I/O"]
  err["src/middleware/errorHandler.js<br/>{ error: { code, message } }"]
  leads -- "id miss: 404" --> err
  score -- "invalid body: 400" --> err
  nf --> err
  score -. "no JSON body: TypeError 500 (bug)" .-> err
  classDef bug stroke:#A32D2D,stroke-width:2px,color:#A32D2D
  class score bug
```

## POST /api/score internals

```mermaid
flowchart TD
  body["POST /api/score body"] --> guard{"req.body present?<br/>(implicit, unchecked)"}
  guard -- "no" --> e500["TypeError, 500<br/>fix: req.body ?? {}"]
  guard -- "yes" --> valid{"3 finite numbers and<br/>string[] intentSignals?"}
  valid -- "no" --> e400["400 via next(err)"]
  valid -- "yes" --> sp["scoreLeadPayload()"]
  sp --> s1["getCompanySizeScore, max 23"] & s2["getRevenueScore, max 20"] & s3["getEngagementScore, max 36"] & s4["getIntentSignalScore, max 21<br/>dedupe + weights"]
  s1 & s2 & s3 & s4 --> clamp["clamp(sum, 0, 100)"]
  clamp --> tier{"getTier"}
  tier --> t["cold under 40, warm 40+,<br/>qualified 70+, high-intent 85+"]
  t --> out["{ score, tier, explanation[max 4], recommendedNextAction }"]
  classDef bug stroke:#A32D2D,stroke-width:2px,color:#A32D2D
  class e500 bug
```

Red nodes mark the bodyless-request bug: `POST /api/score` without a JSON body returns 500 instead of 400. Remove the red edge and node once `score.js` uses `req.body ?? {}`.
