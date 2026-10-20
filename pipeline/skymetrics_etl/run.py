"""Command-line entry point: download -> clean -> aggregate -> load, one month at a time.

Usage:
    python -m skymetrics_etl.run --months 2026-06 2026-07 2026-08
"""

from __future__ import annotations

import argparse
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from pymongo import MongoClient
from pyspark.sql import SparkSession

from .aggregate import all_aggregates
from .clean import clean, read_raw
from .config import get_settings
from .download import download_month, free_gb
from .load import load_all, record_run
from .spark import build_spark

log = logging.getLogger("skymetrics_etl")

DEFAULT_MONTHS = ["2026-06", "2026-07", "2026-08"]


def parse_month(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})-(\d{2})", value)
    if not match or not 1 <= int(match.group(2)) <= 12:
        raise argparse.ArgumentTypeError(f"Invalid month '{value}', expected YYYY-MM")
    return int(match.group(1)), int(match.group(2))


def process_csv(spark, csv_path: Path) -> tuple[dict[str, pd.DataFrame], int, int]:
    """Clean and aggregate one CSV; returns (aggregates as pandas, rows read, rows kept)."""
    raw = read_raw(spark, csv_path)
    rows_read = raw.count()
    flights = clean(raw).cache()
    rows_clean = flights.count()
    frames = {name: df.toPandas() for name, df in all_aggregates(flights).items()}
    flights.unpersist()
    return frames, rows_read, rows_clean


def main(argv: list[str] | None = None) -> dict:
    parser = argparse.ArgumentParser(description="SkyMetrics ETL")
    parser.add_argument("--months", nargs="+", default=DEFAULT_MONTHS, help="YYYY-MM values")
    parser.add_argument(
        "--csv", nargs="+", type=Path, help="Process local CSVs instead of downloading"
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write to MongoDB")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    settings = get_settings()
    if not args.dry_run and not settings.mongodb_uri:
        parser.error("MONGODB_URI is not set (see .env.example) — or pass --dry-run")

    started = time.perf_counter()
    started_at = datetime.now(timezone.utc)
    owns_spark = SparkSession.getActiveSession() is None
    spark = build_spark(settings.spark_master, settings.spark_driver_memory)

    collected: dict[str, list[pd.DataFrame]] = {}
    per_month: list[dict] = []
    sources = (
        [(p.stem, None, p) for p in args.csv]
        if args.csv
        else [(m, parse_month(m), None) for m in args.months]
    )

    try:
        for label, ym, local_csv in sources:
            month_started = time.perf_counter()
            csv_path = local_csv or download_month(*ym, settings.raw_dir, settings.min_free_gb)
            download_seconds = time.perf_counter() - month_started
            try:
                frames, rows_read, rows_clean = process_csv(spark, csv_path)
                process_seconds = time.perf_counter() - month_started - download_seconds
            finally:
                if local_csv is None:
                    csv_path.unlink(missing_ok=True)  # never keep raw data around
                    log.info(
                        "Deleted raw file %s (free: %.2f GB)",
                        csv_path.name,
                        free_gb(settings.raw_dir),
                    )
            for name, frame in frames.items():
                collected.setdefault(name, []).append(frame)
            per_month.append(
                {
                    "month": label,
                    "rowsRead": rows_read,
                    "rowsClean": rows_clean,
                    "downloadSeconds": round(download_seconds, 1),
                    "processSeconds": round(process_seconds, 1),
                }
            )
            log.info("%s: read %d rows, kept %d", label, rows_read, rows_clean)
    finally:
        if owns_spark:
            spark.stop()

    final = {name: pd.concat(parts, ignore_index=True) for name, parts in collected.items()}
    run = {
        "startedAt": started_at,
        "months": [m["month"] for m in per_month],
        "rowsRead": sum(m["rowsRead"] for m in per_month),
        "rowsAfterCleaning": sum(m["rowsClean"] for m in per_month),
        "perMonth": per_month,
        "downloadSeconds": round(sum(m["downloadSeconds"] for m in per_month), 1),
        "processSeconds": round(sum(m["processSeconds"] for m in per_month), 1),
        "documents": {name: len(frame) for name, frame in final.items()},
    }

    if not args.dry_run:
        with MongoClient(settings.mongodb_uri) as client:
            db = client[settings.mongodb_db]
            load_all(db, final)
            run["runtimeSeconds"] = round(time.perf_counter() - started, 1)
            record_run(db, run)
    run["runtimeSeconds"] = round(time.perf_counter() - started, 1)

    log.info(
        "DONE: %d rows read, %d rows after cleaning, %d months, "
        "%.1fs total (%.1fs download, %.1fs Spark processing), documents=%s",
        run["rowsRead"],
        run["rowsAfterCleaning"],
        len(per_month),
        run["runtimeSeconds"],
        run["downloadSeconds"],
        run["processSeconds"],
        run["documents"],
    )
    return run


if __name__ == "__main__":
    main()
