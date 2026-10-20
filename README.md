# SkyMetrics

Aviation analytics dashboard over real US airline on-time performance data, with a natural-language "Ask your data" feature.

> Work in progress — full documentation is added as the project is built.

## Structure

```
pipeline/   Python + PySpark ETL (BTS data -> MongoDB KPI collections)
server/     Node.js + Express REST API
client/     React (Vite) frontend
```
