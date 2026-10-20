"""Runtime configuration loaded from the repository-level .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PIPELINE_DIR.parent

load_dotenv(REPO_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str | None
    mongodb_db: str
    raw_dir: Path
    min_free_gb: float
    spark_master: str
    spark_driver_memory: str


def get_settings() -> Settings:
    return Settings(
        mongodb_uri=os.getenv("MONGODB_URI") or None,
        mongodb_db=os.getenv("MONGODB_DB", "skymetrics"),
        raw_dir=Path(os.getenv("SKYMETRICS_RAW_DIR", PIPELINE_DIR / "data" / "raw")),
        min_free_gb=float(os.getenv("SKYMETRICS_MIN_FREE_GB", "2")),
        spark_master=os.getenv("SPARK_MASTER", "local[4]"),
        spark_driver_memory=os.getenv("SPARK_DRIVER_MEMORY", "2g"),
    )
