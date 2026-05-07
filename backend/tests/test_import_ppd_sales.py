from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from backend.scripts import import_ppd_sales


def _write_ppd_csv(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                '"{11111111-1111-1111-1111-111111111111}","305000","2024-02-01 00:00","ig3 8aa","T","N","F","14","","HIGH ROAD","","ILFORD","REDBRIDGE","GREATER LONDON","A","A"',
                '"{22222222-2222-2222-2222-222222222222}","450000","2024-03-15 00:00","rm1 1aa","S","Y","F","22","","MAIN ROAD","","ROMFORD","HAVERING","GREATER LONDON","A","A"',
                '"{33333333-3333-3333-3333-333333333333}","375000","2024-04-20 00:00","tw3 1zz","F","N","L","7","","STATION ROAD","","HOUNSLOW","HOUNSLOW","GREATER LONDON","A","A"',
                '"{44444444-4444-4444-4444-444444444444}","not-a-price","2024-04-20 00:00","ig3 9bb","F","N","L","7","","BAD ROW","","ILFORD","REDBRIDGE","GREATER LONDON","A","A"',
                '"{55555555-5555-5555-5555-555555555555}","250000","bad-date","ig3 9cc","F","N","L","7","","BAD DATE","","ILFORD","REDBRIDGE","GREATER LONDON","A","A"',
            ]
        )
        + "\n"
    )


def test_iter_rows_parses_official_ppd_order_and_filters_prefixes(tmp_path):
    csv_path = tmp_path / "ppd.csv"
    _write_ppd_csv(csv_path)

    rows = list(import_ppd_sales._iter_rows(csv_path, ["IG", "RM"]))

    assert [row["postcode"] for row in rows] == ["IG3 8AA", "RM1 1AA"]
    assert rows[0] == {
        "transaction_id": "11111111-1111-1111-1111-111111111111",
        "price": 305000,
        "date_of_transfer": "2024-02-01",
        "postcode": "IG3 8AA",
        "property_type": "T",
        "new_build": False,
        "tenure": "F",
        "paon": "14",
        "saon": None,
        "street": "HIGH ROAD",
        "locality": None,
        "town_city": "ILFORD",
        "district": "REDBRIDGE",
        "county": "GREATER LONDON",
    }


def test_main_upserts_launch_prefix_rows_by_transaction_id(monkeypatch, tmp_path):
    csv_path = tmp_path / "ppd.csv"
    _write_ppd_csv(csv_path)
    calls = []

    class _Table:
        def upsert(self, rows, *, on_conflict=None):
            calls.append((rows, on_conflict))
            return self

        def execute(self):
            return SimpleNamespace(data=None)

    class _Supabase:
        def table(self, name):
            assert name == "ppd_sales"
            return _Table()

    monkeypatch.setattr(import_ppd_sales, "get_supabase", lambda required=True: _Supabase())
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "import_ppd_sales.py",
            "--csv",
            str(csv_path),
            "--prefix",
            "IG",
            "--prefix",
            "RM",
            "--batch-size",
            "1",
        ],
    )

    assert import_ppd_sales.main() == 0

    assert [on_conflict for _rows, on_conflict in calls] == ["transaction_id", "transaction_id"]
    upserted = [row for rows, _on_conflict in calls for row in rows]
    assert [row["transaction_id"] for row in upserted] == [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
    ]
    assert all(row["postcode"] == row["postcode"].upper() for row in upserted)
