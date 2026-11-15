"""Download and verify authoritative NAIF SPICE kernels for LUNAR WINDOW.

Used during deployment build phase to provision required SPICE kernels:
- naif0012.tls (LSK)
- moon_de440_250416.tf (FK)
- moon_pa_de440_200625.bpc (Binary PCK)
"""

import sys
from pathlib import Path

# Add backend root to path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.services.spice_manager import SpiceManager


def main() -> None:
    target_dir = backend_root / "data" / "kernels"
    print(f"[SPICE Provisioning] Downloading authoritative NAIF kernels to: {target_dir}")
    downloaded = SpiceManager.download_kernels(target_dir, timeout=120.0)
    print(f"[SPICE Provisioning] Successfully verified and provisioned {len(downloaded)} kernels:")
    for key, path in downloaded.items():
        print(f"  - {key}: {path.name} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
