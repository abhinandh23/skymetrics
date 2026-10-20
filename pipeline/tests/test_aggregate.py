import pandas as pd
import pytest

from skymetrics_etl.aggregate import (
    airport_monthly,
    carrier_monthly,
    delay_causes_monthly,
    route_monthly,
)
from skymetrics_etl.load import records_from_pandas

from .conftest import by_key


def test_carrier_monthly_metrics(flights):
    rows = by_key(carrier_monthly(flights), "month", "airline")
    aa = rows[("2026-06", "AA")]
    assert aa["flights"] == 6
    assert aa["completed"] == 4
    assert aa["cancelled"] == 1
    assert aa["diverted"] == 1
    assert aa["onTimePct"] == 50.0  # -5 and 14 on time; 45 and 15 late
    assert aa["avgArrDelay"] == 17.25
    assert aa["avgDepDelay"] == 19.0
    assert aa["cancelPct"] == pytest.approx(16.67)
    assert aa["divertPct"] == pytest.approx(16.67)

    dl = rows[("2026-06", "DL")]
    assert dl["flights"] == 3
    assert dl["onTimePct"] == pytest.approx(66.67)
    assert dl["avgArrDelay"] == 20.0
    assert set(rows) == {("2026-06", "AA"), ("2026-06", "DL"), ("2026-07", "AA"), ("2026-07", "DL")}


def test_airport_monthly_uses_departures(flights):
    rows = by_key(airport_monthly(flights), "month", "airport")
    jfk = rows[("2026-06", "JFK")]
    assert jfk["flights"] == 5
    assert jfk["onTimeDepPct"] == 75.0
    assert jfk["avgDepDelay"] == 10.0
    assert jfk["cancelPct"] == 20.0


def test_route_monthly_threshold(flights):
    assert route_monthly(flights).count() == 0  # nothing reaches 50 flights in the sample
    rows = by_key(route_monthly(flights, min_flights=4), "month", "route")
    assert set(rows) == {("2026-06", "JFK-LAX")}
    route = rows[("2026-06", "JFK-LAX")]
    assert route["flights"] == 4
    assert route["origin"] == "JFK" and route["dest"] == "LAX"
    assert route["distance"] == 2475.0


def test_delay_causes_monthly(flights):
    rows = by_key(delay_causes_monthly(flights), "month", "airline")
    aa = rows[("2026-06", "AA")]
    assert (aa["carrierMin"], aa["weatherMin"], aa["nasMin"], aa["lateAircraftMin"]) == (
        35.0,
        0.0,
        10.0,
        15.0,
    )
    assert aa["totalDelayMin"] == 60.0
    assert rows[("2026-06", "DL")]["weatherMin"] == 70.0
    assert rows[("2026-07", "DL")]["totalDelayMin"] == 120.0


def test_records_from_pandas_converts_to_native_types():
    frame = pd.DataFrame({"flights": [3], "avg": [float("nan")], "name": ["AA"]})
    (record,) = records_from_pandas(frame)
    assert record == {"flights": 3, "avg": None, "name": "AA"}
    assert type(record["flights"]) is int


@pytest.mark.parametrize(
    "builder", [carrier_monthly, airport_monthly, route_monthly, delay_causes_monthly]
)
def test_aggregates_have_no_decimal_columns(flights, builder):
    """Decimal columns would not serialise to BSON; every metric must be a double or integer."""
    types = dict(builder(flights).dtypes)
    assert not [name for name, t in types.items() if t.startswith("decimal")]
