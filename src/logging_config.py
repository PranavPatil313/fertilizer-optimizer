# src/logging_config.py
import logging
import sys
from logging import Logger

def setup_logging():
    """
    Configure root logger with a sane default. Call this in `src/api/main.py` on startup.
    """
    root = logging.getLogger()
    if root.handlers:
        return root

    fmt = '{"time":"%(asctime)s","level":"%(levelname)s","module":"%(module)s","message":"%(message)s"}'
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt))
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    return root
