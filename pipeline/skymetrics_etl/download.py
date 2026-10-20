"""Download one month of BTS on-time data and extract the CSV.

Source: Bureau of Transportation Statistics, "Reporting Carrier On-Time Performance
(1987-present)", pre-zipped monthly files at transtats.bts.gov/PREZIP.
"""

from __future__ import annotations

import logging
import shutil
import urllib.request
import zipfile
from pathlib import Path

log = logging.getLogger(__name__)

BTS_URL = (
    "https://transtats.bts.gov/PREZIP/"
    "On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{year}_{month}.zip"
)


class DiskSpaceError(RuntimeError):
    """Raised when free disk space is below the configured minimum."""


def free_gb(path: Path) -> float:
    path.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(path).free / 1024**3


def ensure_free_space(path: Path, min_free_gb: float) -> None:
    available = free_gb(path)
    if available < min_free_gb:
        raise DiskSpaceError(
            f"Only {available:.2f} GB free at {path}; at least {min_free_gb} GB required."
        )
    log.info("Free disk space: %.2f GB", available)


def month_url(year: int, month: int) -> str:
    return BTS_URL.format(year=year, month=month)


def download_month(year: int, month: int, dest_dir: Path, min_free_gb: float = 2.0) -> Path:
    """Download and extract one month. The zip is always removed; the CSV path is returned."""
    ensure_free_space(dest_dir, min_free_gb)
    dest_dir.mkdir(parents=True, exist_ok=True)
    zip_path = dest_dir / f"ontime_{year}_{month:02d}.zip"
    csv_path = dest_dir / f"ontime_{year}_{month:02d}.csv"
    url = month_url(year, month)

    log.info("Downloading %s", url)
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "skymetrics-etl/0.1"})
        with urllib.request.urlopen(request, timeout=120) as resp, zip_path.open("wb") as out:
            shutil.copyfileobj(resp, out, length=1024 * 1024)

        with zipfile.ZipFile(zip_path) as archive:
            members = [m for m in archive.infolist() if m.filename.lower().endswith(".csv")]
            if not members:
                raise RuntimeError(f"No CSV found in {url}")
            # Write to a fixed name instead of trusting the archive's member path.
            with archive.open(members[0]) as src, csv_path.open("wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
    except BaseException:
        csv_path.unlink(missing_ok=True)
        raise
    finally:
        zip_path.unlink(missing_ok=True)

    log.info("Extracted %s (%.1f MB)", csv_path.name, csv_path.stat().st_size / 1024**2)
    return csv_path
