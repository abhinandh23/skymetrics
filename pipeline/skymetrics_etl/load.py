"""Write aggregated KPI rows to MongoDB (idempotent: collections are replaced per run)."""

from __future__ import annotations

import logging
import math
from collections.abc import Iterable, Mapping
from typing import Any

import pandas as pd
from pymongo import ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import OperationFailure

log = logging.getLogger(__name__)

IndexSpec = tuple[list[tuple[str, int]], dict[str, Any]]

INDEXES: dict[str, list[IndexSpec]] = {
    "carrier_monthly": [
        ([("month", ASCENDING), ("airline", ASCENDING)], {"unique": True}),
        ([("airline", ASCENDING)], {}),
    ],
    "airport_monthly": [
        ([("month", ASCENDING), ("airport", ASCENDING)], {"unique": True}),
        ([("airport", ASCENDING)], {}),
        ([("flights", DESCENDING)], {}),
    ],
    "route_monthly": [
        ([("month", ASCENDING), ("origin", ASCENDING), ("dest", ASCENDING)], {"unique": True}),
        ([("origin", ASCENDING), ("dest", ASCENDING)], {}),
        ([("avgArrDelay", DESCENDING)], {}),
    ],
    "delay_causes_monthly": [
        ([("month", ASCENDING), ("airline", ASCENDING)], {"unique": True}),
    ],
}


def _native(value: Any) -> Any:
    """Convert numpy/pandas scalars to BSON-friendly Python values (NaN -> None)."""
    if value is None:
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def records_from_pandas(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [{k: _native(v) for k, v in row.items()} for row in frame.to_dict("records")]


def replace_collection(
    db: Database, name: str, records: list[Mapping[str, Any]], indexes: Iterable[IndexSpec] = ()
) -> int:
    """Load records into a staging collection, index it, then swap it in atomically."""
    staging = db[f"{name}__staging"]
    staging.drop()
    if records:
        staging.insert_many(list(records), ordered=False)
    else:
        db.create_collection(staging.name)
    for keys, options in indexes:
        staging.create_index(keys, **options)

    try:
        staging.rename(name, dropTarget=True)
    except OperationFailure as exc:  # some shared-tier clusters restrict renameCollection
        log.warning("rename failed (%s); falling back to drop + insert", exc)
        target = db[name]
        target.drop()
        if records:
            target.insert_many(list(records), ordered=False)
        for keys, options in indexes:
            target.create_index(keys, **options)
        staging.drop()

    log.info("Loaded %d documents into %s", len(records), name)
    return len(records)


def load_all(db: Database, frames: Mapping[str, pd.DataFrame]) -> dict[str, int]:
    counts = {}
    for name, frame in frames.items():
        records = records_from_pandas(frame)
        counts[name] = replace_collection(db, name, records, INDEXES.get(name, []))
    return counts


def record_run(db: Database, run: Mapping[str, Any]) -> None:
    db["pipeline_runs"].insert_one(dict(run))
    db["pipeline_runs"].create_index([("startedAt", DESCENDING)])
