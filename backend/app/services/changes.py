"""A counter that moves whenever map data changes, so open screens can poll it
cheaply (no database) and only refetch when something actually changed.

In-process: the backend runs as a single uvicorn worker. The boot id makes a
restart look like a change, so clients refetch after a redeploy too.
"""

from __future__ import annotations

import itertools
import uuid

_boot = uuid.uuid4().hex[:8]
_counter = itertools.count(1)
_version = f"{_boot}:0"


def bump() -> None:
    global _version
    _version = f"{_boot}:{next(_counter)}"


def current() -> str:
    return _version
