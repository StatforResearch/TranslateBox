#!/usr/bin/env python3
"""Run on the server outside a live session. Never send the printed code in chat."""
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
env = root / '.env'
if not env.is_file() or env.is_symlink():
    raise SystemExit('Expected a regular .env file in the project directory.')
lines = env.read_text().splitlines()
if sum(line.startswith('OPERATOR_TOKEN=') for line in lines) != 1:
    raise SystemExit('Expected exactly one OPERATOR_TOKEN entry; no changes made.')
code = secrets.token_hex(24)
updated = '\n'.join('OPERATOR_TOKEN=' + code if line.startswith('OPERATOR_TOKEN=') else line for line in lines) + '\n'
fd, temp = tempfile.mkstemp(prefix='.env-rotate-', dir=root)
try:
    with os.fdopen(fd, 'w') as stream:
        stream.write(updated)
    os.chmod(temp, 0o600)
    os.replace(temp, env)
finally:
    if os.path.exists(temp):
        os.unlink(temp)
result = subprocess.run(['docker', 'compose', 'up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '120', 'backend'], cwd=root)
if result.returncode:
    raise SystemExit('The file was updated but the backend restart failed. Fix Docker, then restart backend. Read OPERATOR_TOKEN from .env privately.')
print('\nNew operator code (keep private; save in your password manager):\n' + code)
print('\nSign in again. The API key and saved events were preserved.')
