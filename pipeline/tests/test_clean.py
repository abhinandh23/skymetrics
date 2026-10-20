import pytest

from skymetrics_etl.clean import COLUMN_MAP, read_raw


def test_read_raw_keeps_only_needed_columns(raw):
    assert raw.columns == list(COLUMN_MAP.keys())
    assert "Tail_Number" not in raw.columns


def test_read_raw_rejects_missing_columns(spark, tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text("FlightDate,Origin\n2026-06-01,JFK\n")
    with pytest.raises(ValueError, match="missing expected columns"):
        read_raw(spark, bad)


def test_clean_drops_invalid_rows(raw, flights):
    assert raw.count() == 16
    # one row without airline, one with an unparseable date
    assert flights.count() == 14


def test_clean_types(flights):
    types = dict(flights.dtypes)
    assert types["flight_date"] == "date"
    assert types["dep_delay"] == "double"
    assert types["cancelled"] == "boolean"
    assert types["month"] == "string"


def test_cancelled_flights_have_no_delays(flights):
    rows = flights.where("cancelled").collect()
    assert len(rows) == 2
    assert all(r.dep_delay is None and r.arr_delay is None for r in rows)


def test_diverted_flights_keep_departure_delay_only(flights):
    (row,) = flights.where("diverted").collect()
    assert row.dep_delay == 50.0
    assert row.arr_delay is None


def test_missing_cause_minutes_become_zero(flights):
    row = flights.where("flight_date = '2026-06-01'").first()
    assert row.carrier_delay == 0.0
    assert row.late_aircraft_delay == 0.0


def test_month_column(flights):
    months = {r.month for r in flights.select("month").distinct().collect()}
    assert months == {"2026-06", "2026-07"}
