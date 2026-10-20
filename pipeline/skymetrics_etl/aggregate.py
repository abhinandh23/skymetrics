"""KPI aggregations over the cleaned flights DataFrame.

On-time definition (BTS standard): a completed flight (not cancelled, not diverted)
whose arrival delay is under 15 minutes. Airport KPIs use departure delay instead.
"""

from __future__ import annotations

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

FLIGHTS_VIEW = "flights"
MIN_ROUTE_FLIGHTS = 50

_COMMON_COUNTS = """
    COUNT(*)                                                     AS flights,
    SUM(CASE WHEN NOT cancelled AND NOT diverted THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN cancelled THEN 1 ELSE 0 END)                   AS cancelled,
    SUM(CASE WHEN diverted THEN 1 ELSE 0 END)                    AS diverted,
    ROUND(100 * AVG(CASE WHEN cancelled THEN 1D ELSE 0D END), 2) AS cancelPct,
    ROUND(100 * AVG(CASE WHEN diverted THEN 1D ELSE 0D END), 2)  AS divertPct
"""

_ARRIVAL_METRICS = """
    ROUND(100 * AVG(CASE WHEN arr_delay IS NULL THEN NULL
                         WHEN arr_delay < 15 THEN 1D ELSE 0D END), 2) AS onTimePct,
    ROUND(AVG(arr_delay), 2) AS avgArrDelay,
    ROUND(AVG(dep_delay), 2) AS avgDepDelay
"""


def register_flights(flights: DataFrame) -> None:
    flights.createOrReplaceTempView(FLIGHTS_VIEW)


def carrier_monthly(flights: DataFrame) -> DataFrame:
    register_flights(flights)
    return flights.sparkSession.sql(
        f"""
        SELECT month, airline, {_COMMON_COUNTS}, {_ARRIVAL_METRICS}
        FROM {FLIGHTS_VIEW}
        GROUP BY month, airline
        ORDER BY month, airline
        """
    )


def airport_monthly(flights: DataFrame) -> DataFrame:
    register_flights(flights)
    return flights.sparkSession.sql(
        f"""
        SELECT month, origin AS airport, {_COMMON_COUNTS},
            ROUND(100 * AVG(CASE WHEN dep_delay IS NULL THEN NULL
                                 WHEN dep_delay < 15 THEN 1D ELSE 0D END), 2) AS onTimeDepPct,
            ROUND(AVG(dep_delay), 2) AS avgDepDelay
        FROM {FLIGHTS_VIEW}
        GROUP BY month, origin
        ORDER BY month, airport
        """
    )


def route_monthly(flights: DataFrame, min_flights: int = MIN_ROUTE_FLIGHTS) -> DataFrame:
    register_flights(flights)
    return flights.sparkSession.sql(
        f"""
        SELECT month, origin, dest, CONCAT(origin, '-', dest) AS route,
            {_COMMON_COUNTS}, {_ARRIVAL_METRICS},
            ROUND(AVG(distance), 0) AS distance
        FROM {FLIGHTS_VIEW}
        GROUP BY month, origin, dest
        HAVING COUNT(*) >= {int(min_flights)}
        ORDER BY month, origin, dest
        """
    )


def delay_causes_monthly(flights: DataFrame) -> DataFrame:
    causes = {
        "carrier_delay": "carrierMin",
        "weather_delay": "weatherMin",
        "nas_delay": "nasMin",
        "security_delay": "securityMin",
        "late_aircraft_delay": "lateAircraftMin",
    }
    sums = [F.round(F.sum(src), 0).alias(dst) for src, dst in causes.items()]
    agg = flights.groupBy("month", "airline").agg(F.count(F.lit(1)).alias("flights"), *sums)
    total = sum((F.col(c) for c in causes.values()), F.lit(0.0))
    return agg.withColumn("totalDelayMin", total).orderBy("month", "airline")


def all_aggregates(flights: DataFrame, min_route_flights: int = MIN_ROUTE_FLIGHTS):
    """Return {collection_name: DataFrame} for every KPI collection."""
    return {
        "carrier_monthly": carrier_monthly(flights),
        "airport_monthly": airport_monthly(flights),
        "route_monthly": route_monthly(flights, min_route_flights),
        "delay_causes_monthly": delay_causes_monthly(flights),
    }
