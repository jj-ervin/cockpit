"""Concrete backend adapters.

Importing this package registers every adapter into
cockpit.core.adapter.ADAPTER_REGISTRY (via CockpitAdapter.__init_subclass__).
Adding a new adapter means: write the module, give it a BACKEND_ID, and add
one import line below — host_bridge.py's dispatch logic never needs to
change again.
"""

from cockpit.adapters.eco import EcoAdapter
from cockpit.adapters.development import CockpitDevelopmentAdapter
from cockpit.adapters.niji import NijiAdapter
from cockpit.adapters.system import SystemAdapter
from cockpit.adapters.workspace import WorkspaceAdapter

__all__ = ["CockpitDevelopmentAdapter", "EcoAdapter", "NijiAdapter", "SystemAdapter", "WorkspaceAdapter"]
