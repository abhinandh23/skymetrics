"""Read raw BTS CSVs and turn them into a typed, cleaned flights DataFrame."""

from __future__ import annotations

from pathlib import Path

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

# Raw BTS column -> cleaned column name.
COLUMN_MAP: dict[str, str] = {
    "FlightDate": "flight_date",
    "Reporting_Airline": "airline",
    "Origin": "origin",
    "Dest": "dest",
    "DepDelay": "dep_delay",
    "ArrDelay": "arr_delay",
    "Cancelled": "cancelled",
    "Diverted": "diverted",
    "Distance": "distance",
    "CarrierDelay": "carrier_delay",
    "WeatherDelay": "weather_delay",
    "NASDelay": "nas_delay",
    "SecurityDelay": "security_delay",
    "LateAircraftDelay": "late_aircraft_delay",
}

CAUSE_COLUMNS = [
    "carrier_delay",
    "weather_delay",
    "nas_delay",
    "security_delay",
    "late_aircraft_delay",
]


def read_raw(spark: SparkSession, path: str | Path) -> DataFrame:
    """Read a BTS CSV as strings and keep only the needed columns.

    Everything is read as string so that type conversion happens in one explicit place.
    """
    df = (
        spark.read.option("header", True)
        .option("inferSchema", False)
        .option("mode", "PERMISSIVE")
        .csv(Path(path).resolve().as_uri())
    )
    missing = [c for c in COLUMN_MAP if c not in df.columns]
    if missing:
        raise ValueError(f"Input is missing expected columns: {missing}")
    return df.select(*COLUMN_MAP.keys())


def _to_double(col: str):
    return F.col(col).cast("double")


def _to_flag(col: str):
    return F.coalesce(F.col(col).cast("double"), F.lit(0.0)) == 1.0


def clean(raw: DataFrame) -> DataFrame:
    """Cast types, drop unusable rows, and normalise cancelled/diverted flights.

    Rules:
    - Rows without a valid date, airline, or 3-letter origin/destination are dropped.
    - Cancelled flights never departed: both delays become null.
    - Diverted flights never arrived at the scheduled destination: arrival delay becomes null.
    - Missing delay-cause minutes become 0 (BTS leaves them blank when there was no delay).
    """
    df = raw.select(
        F.to_date(F.col("FlightDate"), "yyyy-MM-dd").alias("flight_date"),
        F.upper(F.trim(F.col("Reporting_Airline"))).alias("airline"),
        F.upper(F.trim(F.col("Origin"))).alias("origin"),
        F.upper(F.trim(F.col("Dest"))).alias("dest"),
        _to_double("DepDelay").alias("dep_delay"),
        _to_double("ArrDelay").alias("arr_delay"),
        _to_flag("Cancelled").alias("cancelled"),
        _to_flag("Diverted").alias("diverted"),
        _to_double("Distance").alias("distance"),
        *[
            F.coalesce(_to_double(raw_name), F.lit(0.0)).alias(clean_name)
            for raw_name, clean_name in COLUMN_MAP.items()
            if clean_name in CAUSE_COLUMNS
        ],
    )

    df = df.where(
        F.col("flight_date").isNotNull()
        & F.col("airline").rlike("^[A-Z0-9]{2}$")
        & F.col("origin").rlike("^[A-Z]{3}$")
        & F.col("dest").rlike("^[A-Z]{3}$")
    )

    df = df.withColumn(
        "dep_delay", F.when(F.col("cancelled"), F.lit(None)).otherwise(F.col("dep_delay"))
    ).withColumn(
        "arr_delay",
        F.when(F.col("cancelled") | F.col("diverted"), F.lit(None)).otherwise(F.col("arr_delay")),
    )

    return df.withColumn("month", F.date_format("flight_date", "yyyy-MM"))
