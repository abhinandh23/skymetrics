from pathlib import Path

import pytest

from skymetrics_etl.clean import clean, read_raw
from skymetrics_etl.spark import build_spark

SAMPLE_CSV = Path(__file__).parent / "fixtures" / "sample.csv"


@pytest.fixture(scope="session")
def spark():
    session = build_spark(master="local[1]", driver_memory="1g")
    yield session
    session.stop()


@pytest.fixture(scope="session")
def raw(spark):
    return read_raw(spark, SAMPLE_CSV)


@pytest.fixture(scope="session")
def flights(raw):
    return clean(raw).cache()


def by_key(df, *keys):
    """Collect a small DataFrame into {key tuple: row dict}."""
    return {tuple(r[k] for k in keys): r.asDict() for r in df.collect()}
