"""Regenerate the Sargassum fixtures from coactive_data_service's real publisher.

    python tests/fixtures/generate-sargassum-fixtures.py [path/to/coactive_data_service]

Runs containers/sargassum/app/runner.py on testdata/sargassum/puerto-rico, then
applies what the Worker's manifest route does: release object keys become
sha256 asset tokens and assets map to site-scoped URLs. The `fixture` key holds
test-only context (tenant ID and the sites-route entry) that the client ignores.
"""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
SERVICE = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[2] / "coactive_data_service"
sys.path.insert(0, str(SERVICE / "containers" / "sargassum"))
from app import runner  # noqa: E402

TENANT_ID = "00000000-0000-4000-8000-000000000001"
RELEASE_ID = "00000000-0000-4000-8000-000000000002"
SITE_ID = "00000000-0000-4000-8000-000000000302"
JOB_ID = "00000000-0000-4000-8000-000000000003"
REVISION = "fixture-v1"
SOURCE = SERVICE / "testdata" / "sargassum" / "puerto-rico"


class Body:
    def __init__(self, data: bytes):
        self.stream = io.BytesIO(data)

    def read(self, limit: int = -1) -> bytes:
        return self.stream.read(limit)


class MemoryS3:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}

    def get_object(self, *, Bucket, Key):
        body, content_type = self.objects[Key]
        return {"Body": Body(body), "ContentType": content_type}

    def put_object(self, *, Bucket, Key, Body, ContentType, Metadata):
        self.objects[Key] = (bytes(Body), ContentType)


def flatten(value):
    """The Worker hands the container 2D positions (validateSiteGeometry)."""
    return value[:2] if isinstance(value[0], (int, float)) else [flatten(item) for item in value]


def main() -> None:
    aoi = json.loads((SOURCE / "puerto-rico-aoi.geojson").read_text(encoding="utf-8"))
    geometry = aoi["features"][0]["geometry"]
    geometry = {"type": geometry["type"], "coordinates": flatten(geometry["coordinates"])}
    site_root = f"applications/sargassum/sites/{SITE_ID}"
    plan = {
        "applicationKey": "sargassum", "jobId": JOB_ID, "siteId": SITE_ID, "operation": "sargassum-detect",
        "sourceRevision": REVISION, "sourcePrefix": f"{site_root}/raw/{REVISION}/",
        "derivedPrefix": f"{site_root}/derived/{REVISION}/{JOB_ID}/",
        "releaseId": RELEASE_ID, "releasePrefix": f"applications/sargassum/releases/{RELEASE_ID}/",
    }
    client = MemoryS3()
    objects = []
    days = {}
    for path in sorted(SOURCE.glob("*.json")):
        body = path.read_bytes()
        key = f"{plan['sourcePrefix']}{path.name}"
        client.objects[key] = (body, "application/json")
        objects.append({"key": key, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "content_type": "application/json", "source_date": path.stem})
        days[path.stem] = json.loads(body)
    manifest = {"applicationKey": "sargassum", "siteId": SITE_ID, "sourceRevision": REVISION, "objects": objects}
    client.objects[f"{plan['sourcePrefix']}source-manifest.json"] = (json.dumps(manifest).encode(), "application/json")
    request = {
        "jobId": JOB_ID, "attempt": 0, "target": "light", "workload": "sargassum", "sargassumRun": plan,
        "site": {"id": SITE_ID, "label": "Puerto Rico", "geometry": geometry},
        "storage": {"endpoint": "http://sargassum.storage", "bucketName": "tenant-bucket", "accessKeyId": "x", "secretAccessKey": "y"},
    }
    events = list(runner.iter_events(request, client))
    assert events[-1]["type"] == "result", events[-1]
    published = json.loads(client.objects[f"{plan['releasePrefix']}manifest.json"][0])

    tokens = {key: artifact["checksum_sha256"] for key, artifact in published["artifacts"].items()}
    payload = published["payload"]
    for row in [*payload["timeline"], payload["latest"]]:
        row["file"] = tokens[row["file"]]
    asset_base = f"/api/tenants/{TENANT_ID}/sargassum/sites/{SITE_ID}/releases/{RELEASE_ID}/assets"
    response = {
        "release": {"id": RELEASE_ID, "site_id": SITE_ID, "application_key": "sargassum", "status": "active", "source_revision": REVISION, "activated_at": "2026-10-01T00:00:00.000Z"},
        "payload": payload,
        "assets": {token: f"{asset_base}/{token}" for token in sorted(tokens.values())},
        "request_id": "fixture-request",
        "fixture": {
            "tenant_id": TENANT_ID,
            "site": {"id": SITE_ID, "label": "Puerto Rico", "bbox": [-180, -90, 180, 90], "can_initiate_processing": True,
                     "current_release": {"id": RELEASE_ID, "source_revision": REVISION, "activated_at": "2026-10-01T00:00:00.000Z"}},
        },
    }
    lons = [point[0] for ring in geometry["coordinates"] for point in ring]
    lats = [point[1] for ring in geometry["coordinates"] for point in ring]
    response["fixture"]["site"]["bbox"] = [min(lons), min(lats), max(lons), max(lats)]
    (HERE / "sargassum-manifest.json").write_text(json.dumps(response, indent=2) + "\n", encoding="utf-8")
    (HERE / "sargassum-days.json").write_text(json.dumps(days, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['timeline'])} days from {SOURCE}")


if __name__ == "__main__":
    main()
