from unittest.mock import MagicMock

from pymongo.errors import OperationFailure

from skymetrics_etl.load import replace_collection


def make_db():
    collections = {}

    def get(name):
        return collections.setdefault(name, MagicMock(name=name))

    db = MagicMock()
    db.__getitem__.side_effect = get
    return db, collections


def test_replace_collection_uses_staging_and_rename():
    db, cols = make_db()
    n = replace_collection(db, "carrier_monthly", [{"a": 1}], [([("a", 1)], {"unique": True})])
    staging = cols["carrier_monthly__staging"]
    assert n == 1
    staging.drop.assert_called_once()
    staging.insert_many.assert_called_once_with([{"a": 1}], ordered=False)
    staging.create_index.assert_called_once_with([("a", 1)], unique=True)
    staging.rename.assert_called_once_with("carrier_monthly", dropTarget=True)


def test_replace_collection_falls_back_when_rename_unsupported():
    db, cols = make_db()
    cols["x__staging"] = MagicMock()
    cols["x__staging"].rename.side_effect = OperationFailure("not allowed")
    replace_collection(db, "x", [{"a": 1}])
    cols["x"].drop.assert_called_once()
    cols["x"].insert_many.assert_called_once_with([{"a": 1}], ordered=False)
