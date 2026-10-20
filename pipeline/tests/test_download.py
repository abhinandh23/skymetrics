import io
import zipfile
from collections import namedtuple

import pytest

from skymetrics_etl import download
from skymetrics_etl.download import DiskSpaceError, download_month, ensure_free_space, month_url

Usage = namedtuple("Usage", "total used free")


def zip_bytes(members: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, text in members.items():
            archive.writestr(name, text)
    return buffer.getvalue()


@pytest.fixture
def fake_url(monkeypatch):
    def install(payload: bytes):
        monkeypatch.setattr(
            download.urllib.request, "urlopen", lambda *_a, **_k: io.BytesIO(payload)
        )

    return install


def test_month_url():
    assert month_url(2026, 7).endswith("On_Time_Performance_1987_present_2026_7.zip")


def test_ensure_free_space_raises_when_low(monkeypatch, tmp_path):
    monkeypatch.setattr(download.shutil, "disk_usage", lambda _p: Usage(10, 9, 1024**3))
    with pytest.raises(DiskSpaceError, match="at least 2"):
        ensure_free_space(tmp_path, 2)
    ensure_free_space(tmp_path, 0.5)


def test_download_month_extracts_csv_and_removes_zip(fake_url, tmp_path):
    fake_url(zip_bytes({"readme.html": "x", "../evil/On_Time.csv": "a,b\n1,2\n"}))
    csv_path = download_month(2026, 6, tmp_path, min_free_gb=0)
    assert csv_path == tmp_path / "ontime_2026_06.csv"
    assert csv_path.read_text() == "a,b\n1,2\n"
    # The archive is gone and the traversal path in the member name was ignored.
    assert sorted(p.name for p in tmp_path.iterdir()) == ["ontime_2026_06.csv"]


def test_download_month_cleans_up_when_zip_has_no_csv(fake_url, tmp_path):
    fake_url(zip_bytes({"readme.html": "x"}))
    with pytest.raises(RuntimeError, match="No CSV"):
        download_month(2026, 6, tmp_path, min_free_gb=0)
    assert list(tmp_path.iterdir()) == []


def test_download_month_cleans_up_on_corrupt_zip(fake_url, tmp_path):
    fake_url(b"not a zip")
    with pytest.raises(zipfile.BadZipFile):
        download_month(2026, 6, tmp_path, min_free_gb=0)
    assert list(tmp_path.iterdir()) == []
