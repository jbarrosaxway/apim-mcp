#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador cross-platform do fragmento Client Registry Sync (YAML + XML).

Camadas:
  1) Sempre (sem Axway): parse XML, regras estaticas, estrutura YAML/fragment
  2) Com Axway (auto-detect ou --gateway-home): yamles validate + import dry-run

Uso:
  python validate-fragment.py
  python validate-fragment.py --yaml-only
  python validate-fragment.py --xml-only --strict --gateway-home /opt/axway
  python validate-fragment.py --regenerate-xml
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from typing import List, Optional, Sequence, Tuple

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
FRAGMENT_DIR = os.path.join(PKG_ROOT, "fragment")
FRAGMENT_YAML = os.path.join(FRAGMENT_DIR, "META-INF", "_fragment.yaml")
FRAGMENT_XML = os.path.join(
    PKG_ROOT, "fragment-xml", "client-registry-sync-fragment.xml"
)
YAML_TO_XML_PY = os.path.join(SCRIPT_DIR, "yaml-frag-to-xml.py")
VALIDATE_XML_PY = os.path.join(SCRIPT_DIR, "validate-xml-fragment.py")

DEFAULT_GATEWAY_HOME = r"C:\Axway-7.7.20260530"
NS = "http://www.vordel.com/2005/06/24/entityStore"
EXPECTED_PORTAL_ALERTS = 23

REQUIRED_FRAGMENT_PATHS = (
    os.path.join("Policies", "Client Registry Sync"),
    os.path.join("Libraries", "Cache Manager", "Client Registry Sync Seen.yaml"),
    os.path.join(
        "Environment Configuration",
        "Service",
        "Client Registry Sync Services",
    ),
    os.path.join("Environment Configuration", "Service", "local-apimanager.yaml"),
    os.path.join(
        "External Connections",
        "Auth Profiles",
        "HTTP Basic.yaml",
    ),
    os.path.join("Server Settings", "Portal Alerts", "Organization"),
    os.path.join("Server Settings", "Portal Alerts", "Application"),
    os.path.join("Server Settings", "Portal Alerts", "Application Credentials"),
)

REQUIRED_ADD_OR_REPLACE = (
    "/Policies/Client Registry Sync",
    "/Libraries/Cache Manager/Client Registry Sync Seen",
    "/Environment Configuration/Service/Client Registry Sync Services",
    "/Environment Configuration/Service/local-apimanager",
    "/External Connections/Auth Profiles/HTTP Basic/Local API Manager",
    "/External Connections/Auth Profiles/HTTP Basic/Sync Peer",
    "/Server Settings/Portal Alerts/Organization",
    "/Server Settings/Portal Alerts/Application",
    "/Server Settings/Portal Alerts/Application Credentials",
)

ANTI_LOOP_MARKERS = (
    ("Policies/Client Registry Sync/Common/Guard Sync Send.yaml", "Guard Sync Send"),
    ("Policies/Client Registry Sync/Common/Mark Sync Seen.yaml", "Mark Sync Seen"),
    (
        "Libraries/Cache Manager/Client Registry Sync Seen.yaml",
        "Client Registry Sync Seen",
    ),
)

ENV_PEER_SELECTOR = "${env.CLIENT.REGISTRY.SYNC.PEER.URL}"
LOCAL_APIM_URL_PREFIX = "http://local-apimanager:8075"


class ValidationError(Exception):
    pass


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(problems: Sequence[str]) -> None:
    raise ValidationError("; ".join(problems))


def detect_gateway_home(explicit: Optional[str]) -> Optional[str]:
    if explicit:
        return os.path.normpath(explicit)
    env = os.environ.get("AXWAY_GATEWAY_HOME")
    if env and os.path.isdir(env):
        return os.path.normpath(env)
    if os.path.isdir(DEFAULT_GATEWAY_HOME):
        return DEFAULT_GATEWAY_HOME
    return None


def find_axway_tools(gateway_home: str) -> Optional[Tuple[str, str, str]]:
    """Return (yamles, jython, blank_tpl) or None."""
    gateway = os.path.join(gateway_home, "apigateway")
    if not os.path.isdir(gateway):
        return None

    bin_candidates: List[str] = []
    if sys.platform == "win32":
        bin_candidates.append(os.path.join(gateway, "Win32", "bin"))
    else:
        for plat in ("posix", "Linux.x86_64", "Linux.aarch64", "MacOSX"):
            candidate = os.path.join(gateway, plat, "bin")
            if os.path.isdir(candidate):
                bin_candidates.append(candidate)

    for bin_dir in bin_candidates:
        if sys.platform == "win32":
            yamles = os.path.join(bin_dir, "yamles.bat")
            jython = os.path.join(bin_dir, "jython.bat")
        else:
            yamles = os.path.join(bin_dir, "yamles")
            jython = os.path.join(bin_dir, "jython")
        if os.path.isfile(yamles) and os.path.isfile(jython):
            blank = os.path.join(
                gateway,
                "system",
                "conf",
                "templates",
                "BlankConfiguration-VordelGateway",
            )
            if os.path.isdir(blank):
                return yamles, jython, blank
    return None


def get_axway_version(gateway_home: str) -> str:
    lib = os.path.join(gateway_home, "apigateway", "system", "lib")
    if not os.path.isdir(lib):
        return "desconhecida"
    for name in os.listdir(lib):
        m = re.match(r"vordel-apigateway-(.+)\.jar$", name)
        if m:
            return m.group(1)
    return os.path.basename(gateway_home)


def run_cmd(cmd: Sequence[str], cwd: Optional[str] = None, env: Optional[dict] = None) -> int:
    log("      $ " + " ".join(cmd))
    merged = os.environ.copy()
    if env:
        merged.update(env)
    proc = subprocess.run(
        list(cmd),
        cwd=cwd,
        env=merged,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if proc.stdout:
        for line in proc.stdout.rstrip().splitlines():
            log("        " + line)
    return proc.returncode


# ---------------------------------------------------------------------------
# XML — offline
# ---------------------------------------------------------------------------


def check_xml_well_formed(xml_path: str) -> None:
    log("[xml] Parse well-formed: " + xml_path)
    if not os.path.isfile(xml_path):
        fail([f"XML nao encontrado: {xml_path}"])
    size = os.path.getsize(xml_path)
    log(f"      size={size} bytes")
    if size < 1000:
        fail(["XML demasiado pequeno"])
    try:
        ET.parse(xml_path)
    except ET.ParseError as exc:
        fail([f"XML mal formado: {exc}"])
    log("      OK well-formed")


def check_xml_static_rules(xml_path: str) -> None:
    log("[xml] Regras estaticas (Policy Studio import)")
    with open(xml_path, "r", encoding="utf-8") as fh:
        data = fh.read()
    problems: List[str] = []
    if "superType:" in data:
        problems.append(
            "realizedTypes em YAML (superType:) — regenerar via yaml-frag-to-xml.py"
        )
    if re.search(r'<entity[^>]*type="BasicProfile"', data):
        problems.append("entidade BasicProfile no fragmento (sem passwords encriptadas)")
    if "passphraseTest" in data:
        problems.append("campo passphraseTest presente (No Passphrase Details no PS)")
    if re.search(r'<fval name="httpAuthPass"><value>[^<]+</value></fval>', data):
        problems.append("httpAuthPass com valor encriptado")
    head = data[:8000]
    if "<entityType" in head and "<realizedTypes>" not in head:
        problems.append("entityType fora de realizedTypes no cabecalho")
    if problems:
        fail(problems)
    log("      OK (sem YAML pollution / BasicProfile / passphrase)")


def check_xml_entity_store_structure(xml_path: str) -> None:
    log("[xml] Estrutura entityStoreData")
    tree = ET.parse(xml_path)
    root = tree.getroot()
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag != "entityStoreData":
        fail([f"root inesperado: {tag} (esperado entityStoreData)"])
    if root.tag.endswith("entityStoreData") and NS not in root.tag:
        fail([f"namespace inesperado em entityStoreData: {root.tag}"])

    meta = root.find(f"{{{NS}}}metaInfo")
    if meta is None:
        fail(["metaInfo ausente"])
    for child in ("exportRoots", "typeVersions", "realizedTypes"):
        if meta.find(f"{{{NS}}}{child}") is None:
            fail([f"metaInfo/{child} ausente"])

    rt = meta.find(f"{{{NS}}}realizedTypes")
    rt_text = (rt.text or "") + "".join(ET.tostring(e, encoding="unicode") for e in rt)
    if "superType:" in rt_text:
        fail(["realizedTypes contem YAML (superType:)"])

    problems: List[str] = []
    export_roots = meta.find(f"{{{NS}}}exportRoots")
    if export_roots is not None:
        roots_xml = ET.tostring(export_roots, encoding="unicode")
        for marker in (
            "Client Registry Sync",
            "Client Registry Sync Services",
            "local-apimanager",
            "Portal Alerts",
            "Client Registry Sync Seen",
        ):
            if marker not in roots_xml:
                problems.append(f"exportRoots sem '{marker}'")

    portal_callbacks = root.findall(f".//{{{NS}}}entity[@type='PortalCallback']")
    if len(portal_callbacks) != EXPECTED_PORTAL_ALERTS:
        problems.append(
            f"esperados {EXPECTED_PORTAL_ALERTS} PortalCallback, encontrados {len(portal_callbacks)}"
        )

    xml_data = data_read(xml_path)
    if ENV_PEER_SELECTOR not in xml_data:
        problems.append(f"selector peer ausente: {ENV_PEER_SELECTOR}")
    if LOCAL_APIM_URL_PREFIX not in xml_data:
        problems.append(
            f"Call Local APIM sem URL Remote Host: {LOCAL_APIM_URL_PREFIX}"
        )
    if "CLIENT.REGISTRY.LOCAL.APIM.URL" in xml_data:
        problems.append("selector env APIM local nao deve estar no XML")

    if problems:
        fail(problems)
    log(f"      OK (entityStoreData, {EXPECTED_PORTAL_ALERTS} alerts, env URL)")


def data_read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def validate_xml_offline(xml_path: str) -> None:
    check_xml_well_formed(xml_path)
    check_xml_static_rules(xml_path)
    check_xml_entity_store_structure(xml_path)


# ---------------------------------------------------------------------------
# YAML — offline
# ---------------------------------------------------------------------------


def _try_import_yaml():
    try:
        import yaml  # type: ignore

        return yaml
    except ImportError:
        return None


def check_yaml_fragment_structure(fragment_dir: str) -> None:
    log("[yaml] Estrutura do fragment folder")
    problems: List[str] = []
    if not os.path.isdir(fragment_dir):
        fail([f"fragment dir nao encontrado: {fragment_dir}"])
    if not os.path.isfile(FRAGMENT_YAML):
        problems.append("META-INF/_fragment.yaml ausente")
    for rel in REQUIRED_FRAGMENT_PATHS:
        if not os.path.exists(os.path.join(fragment_dir, rel)):
            problems.append(f"caminho ausente: {rel}")
    for rel, label in ANTI_LOOP_MARKERS:
        if not os.path.isfile(os.path.join(fragment_dir, rel)):
            problems.append(f"anti-loop ausente: {label} ({rel})")
    http_basic = os.path.join(
        fragment_dir,
        "External Connections",
        "Auth Profiles",
        "HTTP Basic.yaml",
    )
    if os.path.isfile(http_basic):
        hb = data_read(http_basic)
        for name in ("Local API Manager", "Sync Peer"):
            if name not in hb:
                problems.append(f"HTTP Basic.yaml sem profile: {name}")
        if re.search(r"^\s*httpAuthPass\s*:", hb, re.MULTILINE):
            problems.append("HTTP Basic.yaml contem httpAuthPass (omitir no fragmento)")
    else:
        problems.append("External Connections/Auth Profiles/HTTP Basic.yaml ausente")
    call_target = os.path.join(
        fragment_dir,
        "Policies",
        "Client Registry Sync",
        "Common",
        "Call Target Sync Endpoint.yaml",
    )
    if os.path.isfile(call_target):
        text = data_read(call_target)
        if ENV_PEER_SELECTOR not in text:
            problems.append(f"Call Target Sync Endpoint sem {ENV_PEER_SELECTOR}")
    else:
        problems.append("Call Target Sync Endpoint.yaml ausente")
    for rel in (
        os.path.join("Common", "Call Local APIM.yaml"),
        os.path.join("Common", "Call Local APIM Soft.yaml"),
    ):
        path = os.path.join(fragment_dir, "Policies", "Client Registry Sync", rel)
        if os.path.isfile(path):
            text = data_read(path)
            if LOCAL_APIM_URL_PREFIX not in text:
                problems.append(f"{rel} sem URL Remote Host {LOCAL_APIM_URL_PREFIX}")
            if "CLIENT.REGISTRY.LOCAL.APIM.URL" in text:
                problems.append(f"{rel} nao deve usar envSettings APIM local")
        else:
            problems.append(f"{rel} ausente")
    rh = os.path.join(
        fragment_dir,
        "Environment Configuration",
        "Service",
        "local-apimanager.yaml",
    )
    if not os.path.isfile(rh):
        problems.append("local-apimanager.yaml ausente")
    elif "localhost:8075" not in data_read(rh):
        problems.append("local-apimanager.yaml sem address localhost:8075")

    alert_glob = os.path.join(
        fragment_dir, "Server Settings", "Portal Alerts", "**", "*.yaml"
    )
    alert_files = [
        p
        for p in glob.glob(alert_glob, recursive=True)
        if not os.path.basename(p).startswith("_")
    ]
    if len(alert_files) != EXPECTED_PORTAL_ALERTS:
        problems.append(
            f"esperados {EXPECTED_PORTAL_ALERTS} Portal Alerts YAML, encontrados {len(alert_files)}"
        )

    if problems:
        fail(problems)
    log(f"      OK (estrutura, anti-loop, {EXPECTED_PORTAL_ALERTS} alerts)")


def check_yaml_fragment_descriptor(fragment_yaml: str) -> None:
    log("[yaml] META-INF/_fragment.yaml")
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        log("      AVISO: PyYAML nao instalado — parse YAML ignorado (estrutura ja verificada)")
        with open(fragment_yaml, "r", encoding="utf-8") as fh:
            raw = fh.read()
        for path in REQUIRED_ADD_OR_REPLACE:
            if path not in raw:
                fail([f"addOrReplace ausente em _fragment.yaml: {path}"])
        log("      OK (presenca textual de addOrReplace)")
        return

    with open(fragment_yaml, "r", encoding="utf-8") as fh:
        doc = yaml_mod.safe_load(fh)
    if not isinstance(doc, dict):
        fail(["_fragment.yaml invalido"])
    add_or_replace = doc.get("addOrReplace") or []
    missing = [p for p in REQUIRED_ADD_OR_REPLACE if p not in add_or_replace]
    if missing:
        fail([f"addOrReplace incompleto: {', '.join(missing)}"])
    flags = doc.get("flags") or []
    if "EXPORT_TYPES" in flags:
        fail(["flags contem EXPORT_TYPES (evitar no export final)"])
    log("      OK (addOrReplace, sem EXPORT_TYPES)")


def validate_yaml_offline(fragment_dir: str) -> None:
    check_yaml_fragment_structure(fragment_dir)
    if os.path.isfile(FRAGMENT_YAML):
        check_yaml_fragment_descriptor(FRAGMENT_YAML)


# ---------------------------------------------------------------------------
# Axway — online
# ---------------------------------------------------------------------------


def validate_yaml_axway(yamles: str, fragment_dir: str) -> None:
    log("[yaml] yamles validate (Axway)")
    uri = "yaml:file:" + fragment_dir.replace("\\", "/")
    if not uri.endswith("/"):
        uri += "/"
    # yamles expects path relative to cwd=PKG_ROOT with .\fragment on Windows docs
    rel = os.path.relpath(fragment_dir, PKG_ROOT).replace("\\", "/")
    uri = "yaml:file:./" + rel
    rc = run_cmd([yamles, "validate", "-s", uri], cwd=PKG_ROOT)
    if rc != 0:
        fail(["yamles validate falhou"])
    log("      OK")


def validate_xml_axway(jython: str, xml_path: str, gateway_home: str) -> None:
    log("[xml] import dry-run Blank FED (Axway/jython)")
    env = {"AXWAY_GATEWAY_HOME": gateway_home}
    rc = run_cmd(
        [jython, VALIDATE_XML_PY, "--xml", xml_path],
        cwd=PKG_ROOT,
        env=env,
    )
    if rc != 0:
        fail(["validate-xml-fragment.py falhou"])
    log("      OK")


def regenerate_xml(jython: str, gateway_home: str) -> None:
    log("[gen] yaml-frag-to-xml.py (Federated)")
    env = {"AXWAY_GATEWAY_HOME": gateway_home}
    rc = run_cmd([jython, YAML_TO_XML_PY], cwd=PKG_ROOT, env=env)
    if rc != 0:
        fail(["yaml-frag-to-xml.py falhou"])
    log("      OK")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Valida fragmento Client Registry Sync (YAML + XML), cross-platform."
    )
    p.add_argument("--yaml-only", action="store_true", help="Validar so YAML")
    p.add_argument("--xml-only", action="store_true", help="Validar so XML")
    p.add_argument(
        "--gateway-home",
        metavar="PATH",
        help="Raiz Axway (default: AXWAY_GATEWAY_HOME ou C:\\Axway-7.7.20260530)",
    )
    p.add_argument(
        "--regenerate-xml",
        action="store_true",
        help="Regenerar XML via yaml-frag-to-xml.py antes de validar (requer Axway)",
    )
    p.add_argument(
        "--strict",
        action="store_true",
        help="Falhar se Axway nao estiver disponivel (util em CI com gateway)",
    )
    p.add_argument(
        "--xml",
        default=FRAGMENT_XML,
        help="Caminho do fragment XML (default: fragment-xml/client-registry-sync-fragment.xml)",
    )
    p.add_argument(
        "--fragment",
        default=FRAGMENT_DIR,
        help="Caminho da pasta fragment YAML (default: fragment/)",
    )
    return p.parse_args(list(argv))


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    do_yaml = not args.xml_only
    do_xml = not args.yaml_only
    gateway_home = detect_gateway_home(args.gateway_home)
    tools = find_axway_tools(gateway_home) if gateway_home else None
    failed = False

    log("========================================")
    log(" Client Registry Sync — validacao")
    if gateway_home:
        log(f" Axway: {gateway_home}")
        log(f" Build: {get_axway_version(gateway_home)}")
    else:
        log(" Axway: (nao detectado — so checks offline)")
    log("========================================")

    if args.strict and not tools:
        log("\nERRO: --strict exige Axway instalado (AXWAY_GATEWAY_HOME ou --gateway-home)")
        return 1

    try:
        if args.regenerate_xml:
            if not tools:
                fail(["--regenerate-xml requer Axway (yamles/jython)"])
            yamles, jython, _ = tools
            regenerate_xml(jython, gateway_home)

        if do_yaml:
            validate_yaml_offline(args.fragment)
            if tools:
                validate_yaml_axway(tools[0], args.fragment)
            elif not args.strict:
                log("[yaml] Axway ausente — yamles validate ignorado (checks estaticos OK)")

        if do_xml:
            validate_xml_offline(args.xml)
            if tools:
                validate_xml_axway(tools[1], args.xml, gateway_home)
            elif not args.strict:
                log("[xml] Axway ausente — import dry-run ignorado (checks estaticos OK)")

    except ValidationError as exc:
        log("\nValidation FAILED: " + str(exc))
        failed = True
    except Exception as exc:
        log("\nValidation FAILED: " + str(exc))
        failed = True

    log("\n========================================")
    if failed:
        log(" RESULTADO: FALHOU")
        log("========================================")
        return 1

    mode = []
    if do_yaml:
        mode.append("YAML")
    if do_xml:
        mode.append("XML")
    axway_note = " + Axway" if tools else " (offline)"
    log(f" RESULTADO: OK ({' + '.join(mode)}{axway_note})")
    log("========================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
