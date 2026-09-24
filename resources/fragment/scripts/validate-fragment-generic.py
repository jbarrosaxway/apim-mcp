#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador genérico de pacotes YAML fragment (Axway Policy Studio).

Camadas:
  Tier 0 (sempre): parse YAML/XML, estrutura mínima do fragment
  Tier 1 (com Axway): yamles validate quando gatewayHome disponível

Rejeita anti-padrões Groovy/MIME genéricos (alinhados à skill apim-policy-development):
  - ContentType(String,String) → usar ContentType(Authority.MIME, …)
  - Body.create(ct, true) → Body.create(null, ct, ByteArrayContentSource)
  - HeaderSet.getHeaderValues → getHeaders
  - com.vordel.trace.Tracker → Trace / TraceFilter
  - Body.create / content.body em scripts "Build * Request" quando o padrão
    preferido é atributo JSON + Set Message

Bootstrap do MCP copia este ficheiro como scripts/validate-fragment.py
quando o upload não inclui scripts próprios.

Após corrigir um anti-padrão: actualizar também SKILL.md, reference.md,
playbook e mcp-guidance.
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
DEFAULT_FRAGMENT_DIR = os.path.join(PKG_ROOT, "fragment")
DEFAULT_FRAGMENT_YAML = os.path.join(DEFAULT_FRAGMENT_DIR, "META-INF", "_fragment.yaml")

# Container apimgr-base; fallback Windows dev
DEFAULT_GATEWAY_HOME_LINUX = "/opt/Axway"
DEFAULT_GATEWAY_HOME_WIN = r"C:\Axway-7.7.20260530"

# Passphrase vazia no import PS 7.7 (ver skill apim-policy-development)
EXPECTED_PASSPHRASE_TEST = "aHR0cDsvL3d3dy52b3JkZWwuY29t"
EXPECTED_HTTP_AUTH_PLACEHOLDER = "Y2hhbmdlbWU="
GROOVY_FILE_RE = re.compile(r"\{\{file\s+\"([^\"]+\.groovy)\"\s*\}\}")


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
    for candidate in (DEFAULT_GATEWAY_HOME_LINUX, DEFAULT_GATEWAY_HOME_WIN):
        if os.path.isdir(candidate):
            return candidate
    return None


def find_axway_tools(gateway_home: str) -> Optional[Tuple[str, str]]:
    """Return (yamles, jython) or None."""
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
            return yamles, jython
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


def _try_import_yaml():
    try:
        import yaml  # type: ignore

        return yaml
    except ImportError:
        return None


def check_yaml_fragment_structure(fragment_dir: str) -> None:
    log("[yaml] Estrutura mínima do fragment (import PS 7.7)")
    problems: List[str] = []
    if not os.path.isdir(fragment_dir):
        fail([f"fragment dir não encontrado: {fragment_dir}"])

    fragment_yaml = os.path.join(fragment_dir, "META-INF", "_fragment.yaml")
    if not os.path.isfile(fragment_yaml):
        problems.append("META-INF/_fragment.yaml ausente")

    root_parent = os.path.join(fragment_dir, "_parent.yaml")
    if not os.path.isfile(root_parent):
        problems.append("fragment/_parent.yaml ausente (Root)")
    else:
        yaml_mod = _try_import_yaml()
        if yaml_mod:
            with open(root_parent, "r", encoding="utf-8") as fh:
                doc = yaml_mod.safe_load(fh)
            if not isinstance(doc, dict) or doc.get("type") != "Root":
                problems.append("fragment/_parent.yaml deve ter type: Root")

    types_dir = os.path.join(fragment_dir, "META-INF", "types")
    if not os.path.isdir(types_dir):
        problems.append(
            "META-INF/types ausente (Could not load YAML Entity Store) — "
            "usar policies/_shared/scripts/link-meta-inf-types.ps1; não commitar junction"
        )

    for sys_name in (
        "Filter Categories.yaml",
        "Policy Categories.yaml",
        "Entity Store Configuration.yaml",
    ):
        sys_path = os.path.join(fragment_dir, "System", sys_name)
        if not os.path.isfile(sys_path):
            problems.append(f"System/{sys_name} ausente")

    if problems:
        fail(problems)
    log("      OK (Root, System/*, META-INF/_fragment.yaml, types)")


def _is_under_meta_inf_types(fragment_dir: str, path: str) -> bool:
    """META-INF/types é junction para o catálogo Axway — não varrer (MAX_PATH no Windows)."""
    types_root = os.path.normcase(os.path.join(os.path.abspath(fragment_dir), "META-INF", "types"))
    abspath = os.path.normcase(os.path.abspath(path))
    return abspath == types_root or abspath.startswith(types_root + os.sep)


def _iter_fragment_yamls(fragment_dir: str):
    pattern = os.path.join(fragment_dir, "**", "*.yaml")
    for yaml_path in glob.glob(pattern, recursive=True):
        if _is_under_meta_inf_types(fragment_dir, yaml_path):
            continue
        yield yaml_path


def check_yaml_files_parseable(fragment_dir: str) -> None:
    log("[yaml] Parse de ficheiros YAML")
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        log("      AVISO: PyYAML não instalado — parse YAML ignorado")
        return

    problems: List[str] = []
    files = sorted(_iter_fragment_yamls(fragment_dir))
    if not files:
        problems.append("nenhum ficheiro .yaml em fragment/")
    for yaml_path in files:
        rel = os.path.relpath(yaml_path, fragment_dir)
        try:
            with open(yaml_path, "r", encoding="utf-8") as fh:
                yaml_mod.safe_load(fh)
        except Exception as exc:
            problems.append(f"YAML inválido {rel}: {exc}")
    if problems:
        fail(problems)
    log(f"      OK ({len(files)} ficheiros YAML parseáveis)")


def check_entity_store_passphrase(fragment_dir: str) -> None:
    log("[yaml] Entity Store Configuration / passphrase")
    es_path = os.path.join(fragment_dir, "System", "Entity Store Configuration.yaml")
    if not os.path.isfile(es_path):
        return
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        log("      AVISO: PyYAML ausente — passphrase não verificada")
        return
    with open(es_path, "r", encoding="utf-8") as fh:
        doc = yaml_mod.safe_load(fh)
    fields = (doc or {}).get("fields") or {}
    test = fields.get("passphraseTest")
    if test != EXPECTED_PASSPHRASE_TEST:
        fail(
            [
                f"passphraseTest deve ser {EXPECTED_PASSPHRASE_TEST} "
                "(import com passphrase vazia; ver skill apim-policy-development)"
            ]
        )
    log("      OK passphraseTest (passphrase vazia)")


def check_basic_profile_placeholders(fragment_dir: str) -> None:
    log("[yaml] Auth Profiles BasicProfile (httpAuthPass placeholder)")
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        return
    problems: List[str] = []
    for yaml_path in _iter_fragment_yamls(fragment_dir):
        with open(yaml_path, "r", encoding="utf-8") as fh:
            text = fh.read()
        if "type: BasicProfile" not in text and "BasicProfile" not in text:
            continue
        doc = yaml_mod.safe_load(text)
        if not isinstance(doc, dict):
            continue
        # Grupo BasicAuthGroup com children BasicProfile
        if doc.get("type") == "BasicAuthGroup":
            for child in doc.get("children") or []:
                if not isinstance(child, dict) or child.get("type") != "BasicProfile":
                    continue
                fields = child.get("fields") or {}
                pwd = fields.get("httpAuthPass")
                name = fields.get("name") or "?"
                if pwd is None:
                    problems.append(
                        f"BasicProfile '{name}' sem httpAuthPass em "
                        f"{os.path.relpath(yaml_path, fragment_dir)}"
                    )
                elif pwd != EXPECTED_HTTP_AUTH_PLACEHOLDER:
                    problems.append(
                        f"httpAuthPass deve ser placeholder {EXPECTED_HTTP_AUTH_PLACEHOLDER} "
                        f"('{name}' em {os.path.relpath(yaml_path, fragment_dir)})"
                    )
            continue
        if doc.get("type") != "BasicProfile":
            continue
        fields = doc.get("fields") or {}
        pwd = fields.get("httpAuthPass")
        if pwd is None:
            problems.append(
                f"BasicProfile sem httpAuthPass em {os.path.relpath(yaml_path, fragment_dir)}"
            )
        elif pwd != EXPECTED_HTTP_AUTH_PLACEHOLDER:
            problems.append(
                f"httpAuthPass deve ser placeholder {EXPECTED_HTTP_AUTH_PLACEHOLDER} "
                f"em {os.path.relpath(yaml_path, fragment_dir)}"
            )
    if problems:
        fail(problems)
    log("      OK (BasicProfile placeholders)")


KNOWN_BAD_GROOVY_IMPORTS = (
    "com.vordel.trace.Tracker",  # não existe; usar com.vordel.trace.Trace
)

# APIs inventadas / assinaturas inválidas (validado em vordel-mime 7.7)
KNOWN_BAD_GROOVY_PATTERNS = (
    (
        'new ContentType("',
        'ContentType(String,String) inválido — usar '
        'new ContentType(ContentType.Authority.MIME, "application/json")',
    ),
    (
        "Body.create(ct, true)",
        "Body.create(ct,boolean) inválido — usar "
        "Body.create(null, ct, new ByteArrayContentSource(bytes))",
    ),
    (
        "getHeaderValues(",
        "HeaderSet.getHeaderValues(String) não existe — usar getHeaders(String)",
    ),
)


def check_groovy_file_references(fragment_dir: str) -> None:
    log("[yaml] Referências Groovy {{file ...groovy}}")
    problems: List[str] = []
    for yaml_path in _iter_fragment_yamls(fragment_dir):
        rel_yaml = os.path.relpath(yaml_path, fragment_dir)
        with open(yaml_path, "r", encoding="utf-8") as fh:
            text = fh.read()
        for match in GROOVY_FILE_RE.finditer(text):
            groovy_ref = match.group(1).replace("/", os.sep)
            groovy_path = os.path.normpath(os.path.join(os.path.dirname(yaml_path), groovy_ref))
            if not os.path.isfile(groovy_path):
                problems.append(f"groovy ausente: {groovy_ref} (referenciado em {rel_yaml})")
    # Também varrer .groovy no fragment (imports inventados)
    for groovy_path in glob.glob(os.path.join(fragment_dir, "**", "*.groovy"), recursive=True):
        if _is_under_meta_inf_types(fragment_dir, groovy_path):
            continue
        rel = os.path.relpath(groovy_path, fragment_dir)
        with open(groovy_path, "r", encoding="utf-8") as fh:
            src = fh.read()
        for bad in KNOWN_BAD_GROOVY_IMPORTS:
            if bad in src:
                problems.append(
                    f"import inventado {bad} em {rel} — "
                    "usar com.vordel.trace.Trace; env via Set Attribute ${env.*}"
                )
        for needle, hint in KNOWN_BAD_GROOVY_PATTERNS:
            if needle in src:
                problems.append(f"{hint} em {rel}")
        if "Build " in rel and "Request" in rel and rel.endswith("Scripting Language.groovy"):
            if "Body.create(" in src:
                problems.append(
                    f"{rel}: Build * Request deve preferir atributo JSON + Set Message "
                    "(não Body.create no Groovy quando Set Message está downstream)"
                )
            if 'msg.put("content.body"' in src:
                problems.append(
                    f"{rel}: não definir content.body no Groovy — usar atributo + Set Message"
                )
        elif (
            rel.endswith("Scripting Language.groovy")
            and 'msg.put("content.body"' in src
            and "http.content.headers" not in src
        ):
            problems.append(
                f"{rel}: script que define content.body para Connect to URL deve "
                "também limpar http.content.headers (ver skill apim-policy-development)"
            )
    if problems:
        fail(problems)
    log("      OK (groovy files presentes; sem imports inventados conhecidos)")


def check_fragment_directive_overlap(fragment_yaml: str) -> None:
    log("[yaml] _fragment.yaml addIfAbsent vs addOrReplace")
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        return
    with open(fragment_yaml, "r", encoding="utf-8") as fh:
        doc = yaml_mod.safe_load(fh)
    if not isinstance(doc, dict):
        return
    absent = set(doc.get("addIfAbsent") or [])
    replace = set(doc.get("addOrReplace") or [])
    overlap = absent & replace
    if overlap:
        fail(
            [
                "Override and addition directive sets cannot overlap: "
                + ", ".join(sorted(overlap))
            ]
        )
    log("      OK (sem overlap addIfAbsent/addOrReplace)")


def check_yaml_fragment_descriptor(fragment_yaml: str) -> None:
    log("[yaml] META-INF/_fragment.yaml")
    yaml_mod = _try_import_yaml()
    if yaml_mod is None:
        log("      OK (presença confirmada; PyYAML ausente)")
        return

    with open(fragment_yaml, "r", encoding="utf-8") as fh:
        doc = yaml_mod.safe_load(fh)
    if not isinstance(doc, dict):
        fail(["_fragment.yaml inválido (esperado mapping)"])
    flags = doc.get("flags") or []
    if "EXPORT_TYPES" in flags:
        fail(["flags contém EXPORT_TYPES (evitar no export final)"])
    log("      OK (descriptor válido)")


def validate_yaml_offline(fragment_dir: str) -> None:
    check_yaml_fragment_structure(fragment_dir)
    fragment_yaml = os.path.join(fragment_dir, "META-INF", "_fragment.yaml")
    if os.path.isfile(fragment_yaml):
        check_yaml_fragment_descriptor(fragment_yaml)
        check_fragment_directive_overlap(fragment_yaml)
    check_entity_store_passphrase(fragment_dir)
    check_basic_profile_placeholders(fragment_dir)
    check_groovy_file_references(fragment_dir)
    check_yaml_files_parseable(fragment_dir)


def check_xml_well_formed(xml_path: str) -> None:
    log("[xml] Parse well-formed: " + xml_path)
    if not os.path.isfile(xml_path):
        fail([f"XML não encontrado: {xml_path}"])
    size = os.path.getsize(xml_path)
    log(f"      size={size} bytes")
    if size < 100:
        fail(["XML demasiado pequeno"])
    try:
        ET.parse(xml_path)
    except ET.ParseError as exc:
        fail([f"XML mal formado: {exc}"])
    log("      OK well-formed")


def check_xml_static_rules(xml_path: str) -> None:
    log("[xml] Regras estáticas genéricas (Policy Studio import)")
    with open(xml_path, "r", encoding="utf-8") as fh:
        data = fh.read()
    problems: List[str] = []
    if "superType:" in data:
        problems.append(
            "realizedTypes em YAML (superType:) — regenerar via yaml-frag-to-xml.py"
        )
    has_bp = bool(re.search(r'<entity[^>]*type="BasicProfile"', data))
    has_ptest = "passphraseTest" in data
    if has_bp and not has_ptest:
        problems.append(
            "BasicProfile sem passphraseTest (No Passphrase Details)"
        )
    if re.search(r'<fval name="httpAuthPass"><value>\s*</value></fval>', data):
        problems.append("httpAuthPass vazio (usar placeholder Y2hhbmdlbWU=)")
    if problems:
        fail(problems)
    log("      OK (Auth+passphraseTest=%s)" % ("sim" if has_bp and has_ptest else "n/a"))


def validate_xml_offline(xml_path: str) -> None:
    check_xml_well_formed(xml_path)
    check_xml_static_rules(xml_path)


def validate_yaml_axway(yamles: str, fragment_dir: str, pkg_root: str) -> None:
    log("[yaml] yamles validate (Axway Tier 1)")
    rel = os.path.relpath(fragment_dir, pkg_root).replace("\\", "/")
    uri = "yaml:file:./" + rel
    if not uri.endswith("/"):
        uri += "/"
    rc = run_cmd([yamles, "validate", "-s", uri], cwd=pkg_root)
    if rc != 0:
        fail(["yamles validate falhou"])
    log("      OK")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Valida pacote YAML fragment genérico (Tier 0 offline + Tier 1 yamles)."
    )
    p.add_argument("--yaml-only", action="store_true", help="Validar só YAML")
    p.add_argument("--xml-only", action="store_true", help="Validar só XML")
    p.add_argument(
        "--gateway-home",
        metavar="PATH",
        help="Raiz Axway (default: AXWAY_GATEWAY_HOME ou /opt/Axway)",
    )
    p.add_argument(
        "--regenerate-xml",
        action="store_true",
        help="Não suportado no validador genérico (requer yaml-frag-to-xml.py do pacote)",
    )
    p.add_argument(
        "--strict",
        action="store_true",
        help="Falhar se Axway não estiver disponível",
    )
    p.add_argument(
        "--xml",
        default=os.path.join(PKG_ROOT, "fragment-xml", "fragment.xml"),
        help="Caminho do fragment XML (opcional; ignorado se ausente exceto com --xml-only)",
    )
    p.add_argument(
        "--fragment",
        default=DEFAULT_FRAGMENT_DIR,
        help="Caminho da pasta fragment YAML (default: fragment/)",
    )
    return p.parse_args(list(argv))


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    do_yaml = not args.xml_only
    do_xml = not args.yaml_only
    pkg_root = os.path.normpath(
        os.path.commonpath([args.fragment, args.xml if os.path.dirname(args.xml) else PKG_ROOT])
    )
    # Package root = parent of fragment/ when --fragment points at fragment dir
    if os.path.basename(args.fragment.rstrip(os.sep)) == "fragment":
        pkg_root = os.path.dirname(os.path.normpath(args.fragment))
    elif os.path.isfile(os.path.join(os.path.dirname(args.fragment), "fragment", "META-INF", "_fragment.yaml")):
        pkg_root = os.path.dirname(args.fragment)

    gateway_home = detect_gateway_home(args.gateway_home)
    tools = find_axway_tools(gateway_home) if gateway_home else None
    failed = False
    xml_exists = os.path.isfile(args.xml)

    log("========================================")
    log(" Fragment YAML — validação genérica")
    if gateway_home:
        log(f" Axway: {gateway_home}")
        log(f" Build: {get_axway_version(gateway_home)}")
    else:
        log(" Axway: (não detectado — Tier 0 offline)")
    log("========================================")

    if args.regenerate_xml:
        log("\nERRO: --regenerate-xml requer scripts/ do pacote (yaml-frag-to-xml.py)")
        return 1

    if args.strict and not tools:
        log("\nERRO: --strict exige Axway instalado (AXWAY_GATEWAY_HOME ou --gateway-home)")
        return 1

    if do_xml and args.xml_only and not xml_exists:
        log(f"\nERRO: XML não encontrado: {args.xml}")
        return 1

    try:
        if do_yaml:
            validate_yaml_offline(args.fragment)
            if tools:
                validate_yaml_axway(tools[0], args.fragment, pkg_root)
            elif not args.strict:
                log("[yaml] Axway ausente — yamles validate ignorado (Tier 0 OK)")

        if do_xml:
            if xml_exists:
                validate_xml_offline(args.xml)
                log("[xml] import dry-run ignorado (validador genérico; use script do pacote)")
            elif not args.xml_only:
                log(f"[xml] {args.xml} ausente — validação XML ignorada (YAML-only upload)")
            elif not args.strict:
                log("[xml] Axway ausente — checks offline ignorados")

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
    if do_xml and xml_exists:
        mode.append("XML")
    axway_note = " + Axway" if tools else " (offline)"
    log(f" RESULTADO: OK ({' + '.join(mode) or 'estrutura'}{axway_note})")
    log("========================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
