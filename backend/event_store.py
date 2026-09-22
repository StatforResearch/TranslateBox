"""Small durable event catalog. Audio and transcripts never enter this database."""
import json
import sqlite3
from pathlib import Path


class EventStore(dict):
    def __init__(self, path):
        if path != ':memory:':
            Path(path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.execute('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
        super().__init__((eid, json.loads(data)) for eid, data in self.connection.execute('SELECT id, data FROM events'))

    def __setitem__(self, key, value):
        with self.connection:
            self.connection.execute('INSERT OR REPLACE INTO events VALUES (?, ?)', (key, json.dumps(value)))
        super().__setitem__(key, value)

    def pop(self, key, default=None):
        with self.connection:
            self.connection.execute('DELETE FROM events WHERE id = ?', (key,))
        return super().pop(key, default)

    def clear(self):
        with self.connection:
            self.connection.execute('DELETE FROM events')
        super().clear()

    def close(self):
        self.connection.close()
