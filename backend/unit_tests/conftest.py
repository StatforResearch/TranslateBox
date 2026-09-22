# Tests must never touch the operator's persistent catalog.
import os
os.environ['EVENTS_DB_PATH'] = ':memory:'
