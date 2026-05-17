#!/usr/bin/env python3
import base64
import json
import os
import sys
import time
from pathlib import Path
from urllib import request, error


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT_DIR / ".env.development.local"
DEFAULT_LOGIN_URL = "https://app.mayadataprivacy.eu/mdp/app-safe-idm/auth/login"
TOKEN_REFRESH_SKEW_SECONDS = 120


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def get_config() -> dict[str, str]:
    merged: dict[str, str] = {}
    for env_name in (".env.development", ".env.local", ".env.development.local"):
        merged.update(load_env_file(ROOT_DIR / env_name))
    merged.update({key: value for key, value in os.environ.items() if value})
    return merged


def decode_jwt_payload(token: str) -> dict[str, object]:
    try:
        payload = token.split(".")[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(f"{payload}{padding}")
        return json.loads(decoded)
    except Exception:
        return {}


def token_is_fresh(token: str) -> bool:
    payload = decode_jwt_payload(token)
    exp = payload.get("exp")
    return isinstance(exp, int) and exp > int(time.time()) + TOKEN_REFRESH_SKEW_SECONDS


def update_env_file(path: Path, updates: dict[str, str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    seen: set[str] = set()
    next_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            next_lines.append(line)
            continue

        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            next_lines.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            next_lines.append(line)

    for key, value in updates.items():
        if key not in seen:
            next_lines.append(f"{key}={value}")

    path.write_text("\n".join(next_lines) + "\n", encoding="utf-8")


def fetch_token(login_url: str, username: str, password: str) -> str:
    payload = json.dumps({"userName": username, "password": password}).encode("utf-8")
    req = request.Request(
        login_url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"IDM login failed with HTTP {exc.code}: {body[:200]}") from exc

    data = json.loads(body)
    token = data.get("jwtToken")
    if not isinstance(token, str) or not token:
        raise RuntimeError("IDM login response did not include jwtToken")
    return token


def main() -> int:
    config = get_config()
    env_file = Path(config.get("MDP_JWT_ENV_FILE", str(DEFAULT_ENV_FILE))).expanduser()
    login_url = config.get("MDP_IDM_LOGIN_URL", DEFAULT_LOGIN_URL)
    username = config.get("MDP_IDM_USERNAME")
    password = config.get("MDP_IDM_PASSWORD")
    existing_token = config.get("VITE_MDP_JWT_TOKEN", "")

    if existing_token and token_is_fresh(existing_token):
        print("MDP JWT bootstrap: existing token is still valid.")
        return 0

    if not username or not password:
        print(
            "MDP JWT bootstrap skipped: set MDP_IDM_USERNAME and MDP_IDM_PASSWORD "
            "in .env.development.local.",
            file=sys.stderr,
        )
        return 0

    token = fetch_token(login_url, username, password)
    payload = decode_jwt_payload(token)
    exp = payload.get("exp")
    expires_at = str(exp) if isinstance(exp, int) else ""

    update_env_file(
        env_file,
        {
            "VITE_MDP_JWT_TOKEN": token,
            "VITE_MDP_JWT_EXPIRES_AT": expires_at,
        },
    )
    print("MDP JWT bootstrap: refreshed token.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
