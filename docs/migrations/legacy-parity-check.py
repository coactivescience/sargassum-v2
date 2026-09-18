"""Compare sampled selection/contract behavior without imagery or geospatial dependencies.

Run from any directory: python3 docs/migrations/legacy-parity-check.py
Exit 1 means these sampled legacy behaviors still differ. This is an audit
probe, not an end-to-end scientific validation; raster rendering is stubbed.
"""
import ast
from datetime import date
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
LEGACY = ROOT.parent / "giant_salvinia/salvinia"
SERVICE = ROOT.parent / "coactive_data_service/containers/salvinia-heavy/app/salvinia"


def function(path, name, namespace):
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    future = ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0)
    module = ast.fix_missing_locations(ast.Module(body=[future, node], type_ignores=[]))
    exec(compile(module, str(path), "exec"), namespace)
    return namespace[name]


differences = []


def compare(label, legacy, migration):
    print(f"{label}: legacy={legacy!r}; migration={migration!r}")
    if legacy != migration:
        differences.append(label)


rows = [dict(cove_id=i, cove=f"Cove {i}", start="before", end="after", lonlat=[0, 0],
             elapsed_days=20, area_before_ha=10, area_after_ha=3, nir_decline=.1,
             basin_area_change=-.5, drift_possible=False) for i in [1, 1, 2, 3, 4, 5]]
old = function(LEGACY / "display.py", "_verification_pairs", {
    "VerificationPair": lambda cove_id, before, after: SimpleNamespace(cove_id=cove_id),
})({"collapse_candidates": rows})
new = function(SERVICE / "historical.py", "_verification", {
    "display": SimpleNamespace(_verification_pairs=function(SERVICE / "display.py", "_verification_pairs", {"VerificationPair": lambda cove_id, before, after: SimpleNamespace(cove_id=cove_id)})),
    "_frames": lambda records, *args: records,
    "render": SimpleNamespace(leaflet_bounds=lambda grid: [], presentation_grid=lambda *args: None),
    "imagery": SimpleNamespace(STYLE=SimpleNamespace(max_dimension=1)),
})(SimpleNamespace(acquisitions=[{"id": "before"}, {"id": "after"}], grid=None),
   None, None, None, {}, candidates=rows)
compare("Verification cove selection", [x.cove_id for x in old],
        [x["cove_id"] for x in new["candidates"]])

records = [dict(id=label, date=day, timestamp=day, clear_coverage=.9, geometric_coverage=1)
           for label, day in [("mid-month", "2026-06-14"), ("month-end", "2026-06-30")]]
old = function(LEGACY / "analysis.py", "_monthly_records", {
    "_ordinal": lambda value: date.fromisoformat(value).toordinal(),
})(records)
new = function(SERVICE / "analysis.py", "_monthly_records", {
    "_ordinal": lambda value: date.fromisoformat(value).toordinal(),
})(records)
compare("Monitor equal-coverage tie", old[0]["id"], new[0]["id"])

# Inspect the actual compiler's literal evidence contract; no science is mocked.
tree = ast.parse((SERVICE / "historical.py").read_text())
build = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "build_historical_payload")
payload = next(n.value for n in build.body if isinstance(n, ast.Assign)
               and any(isinstance(t, ast.Name) and t.id == "payload" for t in n.targets))
evidence = next(value for key, value in zip(payload.keys, payload.values)
                if isinstance(key, ast.Constant) and key.value == "evidence")
published = ast.literal_eval(evidence)
# Apply actual evidence assignments made by the compiler after the literal.
namespace = {"payload": {"evidence": published}, "response": {"comparison": [{"method": "example", "median_overlap": .1}]}}
for statement in build.body:
    if isinstance(statement, ast.Assign) and all(ast.unparse(target).startswith("payload['evidence']") for target in statement.targets):
        exec(compile(ast.Module(body=[statement], type_ignores=[]), str(SERVICE / "historical.py"), "exec"), namespace)
expected = function(LEGACY / "presentation.py", "_evidence", {"MINIMUM_PATCH_HA": .1})(
    {"record": {"acquisitions": []}}, {"overlap_count": 1, "comparison": [{"method": "example", "median_overlap": .1}]},
)
compare("Response comparison reaches evidence renderer", bool(expected["response"].get("comparison")),
        bool(published["response"].get("comparison")))

print(f"{len(differences)} parity differences reproduced.")
raise SystemExit(bool(differences))
