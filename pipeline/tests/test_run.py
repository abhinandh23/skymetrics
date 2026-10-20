import pytest

from skymetrics_etl.run import main, parse_month, process_csv

from .conftest import SAMPLE_CSV


def test_parse_month():
    assert parse_month("2026-07") == (2026, 7)
    for bad in ["2026-13", "26-07", "2026/07"]:
        with pytest.raises(Exception, match="Invalid month"):
            parse_month(bad)


def test_process_csv_returns_pandas_frames(spark):
    frames, rows_read, rows_clean = process_csv(spark, SAMPLE_CSV)
    assert (rows_read, rows_clean) == (16, 14)
    assert set(frames) == {
        "carrier_monthly",
        "airport_monthly",
        "route_monthly",
        "delay_causes_monthly",
        "carrier_daily",
    }
    assert len(frames["carrier_monthly"]) == 4


def test_main_dry_run_with_local_csv(spark):
    run = main(["--csv", str(SAMPLE_CSV), "--dry-run"])
    assert run["rowsRead"] == 16
    assert run["rowsAfterCleaning"] == 14
    assert run["documents"]["carrier_monthly"] == 4
    assert SAMPLE_CSV.exists()  # local inputs are never deleted
