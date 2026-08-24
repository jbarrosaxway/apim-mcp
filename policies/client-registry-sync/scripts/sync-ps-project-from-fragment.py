# -*- coding: utf-8 -*-
"""Copia o fragmento canonico (fragment/) para ps-project-with-sync/."""
from __future__ import print_function
import argparse
import os
import shutil
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
FRAG = os.path.join(PKG_ROOT, "fragment")
PROJ = os.path.join(PKG_ROOT, "ps-project-with-sync")


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Copia fragment/ canonico para ps-project-with-sync/."
    )
    p.add_argument(
        "--fragment-path",
        default=FRAG,
        help="Pasta fragment YAML (default: fragment/)",
    )
    p.add_argument(
        "--ps-project-path",
        default=PROJ,
        help="Pasta ps-project-with-sync (default: ps-project-with-sync/)",
    )
    return p.parse_args(argv or sys.argv[1:])

COPY_PATHS = (
    os.path.join("Policies", "Client Registry Sync"),
    os.path.join("Libraries", "Cache Manager"),
    os.path.join("Server Settings", "Portal Alerts"),
    os.path.join("External Connections", "Auth Profiles"),
    os.path.join("Environment Configuration", "Service", "Client Registry Sync Services"),
    os.path.join("Environment Configuration", "Service", "local-apimanager.yaml"),
    os.path.join("META-INF", "_fragment.yaml"),
)


def copy_tree(src, dst):
    if os.path.isdir(src):
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        parent = os.path.dirname(dst)
        if parent and not os.path.isdir(parent):
            os.makedirs(parent)
        shutil.copy2(src, dst)


def main(argv=None):
    global FRAG, PROJ
    args = parse_args(argv)
    FRAG = os.path.normpath(args.fragment_path)
    PROJ = os.path.normpath(args.ps_project_path)
    frag_root = FRAG
    if not os.path.isdir(frag_root):
        raise SystemExit("fragment/ nao encontrado: " + frag_root)
    if not os.path.isdir(PROJ):
        raise SystemExit("ps-project-with-sync/ nao encontrado: " + PROJ)
    for rel in COPY_PATHS:
        src = os.path.join(frag_root, rel)
        dst = os.path.join(PROJ, rel)
        if not os.path.exists(src):
            print("SKIP (ausente no fragment):", rel)
            continue
        print("sync:", rel)
        copy_tree(src, dst)
    print("OK ps-project-with-sync alinhado com fragment/")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else 1
        sys.exit(code)
