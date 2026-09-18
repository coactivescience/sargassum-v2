"""Regenerate synthetic browser contracts with the real service builder (requires numpy).

Run from this repository with a Python containing the service's scientific dependencies:
  python tests/fixtures/generate-intelligence-fixtures.py /path/to/coactive_data_service
No operational observations are used or represented by these fixtures.
"""
import ast
import json
from pathlib import Path
import sys

service = Path(sys.argv[1]) / 'containers/salvinia-heavy/app'
sys.path.insert(0, str(service))
from salvinia.intelligence import build_intelligence_payload, _legacy_context

parsed = ast.parse((service / 'test_runner.py').read_text())
source = next(row for row in parsed.body if isinstance(row, ast.FunctionDef) and row.name == 'intelligence_results')
namespace = {}
exec(compile(ast.Module(body=[source], type_ignores=[]), 'service-intelligence-fixture', 'exec'), namespace)
results = namespace['intelligence_results']()
# Include surge, currently clear front, and decline alongside original service fixture.
results['record']['mat_area_ha'][-1] = [8., 6., .5, 4.]
payload = build_intelligence_payload(results, {'productCount': 5}, crew_budget=3)
payload.pop('legacy_context', None)  # Verify optional-less releases remain supported.
root = Path(__file__).parent
(root / 'intelligence-release.json').write_text(json.dumps(payload, indent=2) + '\n')
context = _legacy_context({
    'occurrences': [{'date':'2020-06-01','lonlat':[-94.15,32.71], 'source':'Synthetic occurrence for contract testing; not operational data'}],
    'santee_reference': {'years': [
        {'year':2020, 'reference_ha':{'salvinia':112.6,'crested_floating_heart':20,'waterhyacinth':4,'duckweed':3}},
        {'year':2025, 'reference_ha':{'salvinia':1215.4,'crested_floating_heart':30,'waterhyacinth':5,'duckweed':4}},
    ]},
})
(root / 'intelligence-context.json').write_text(json.dumps(context, indent=2) + '\n')
