# -*- coding: utf-8 -*-
"""
Regenerate Client Registry Sync XML fragment via Federated Entity Store.

Why: ExportEngine on YamlEntityStore writes realizedTypes as YAML CDATA,
which Policy Studio rejects with: Unable to upgrade the import file.

Flow:
  1) Open YAML fragment
  2) Import entities into BlankConfiguration Federated FED (via ExportEngine XML mid-step OR graft)
  3) Re-export from Federated store -> proper XML types
"""
from __future__ import print_function
import argparse
import os
import shutil
import sys
import tempfile
from java.io import File, FileOutputStream, ByteArrayOutputStream, FileInputStream
from java.util import ArrayList
from java.lang import Throwable
from esapi import EntityStoreAPI
from com.axway.gw.es.yaml.features import StoreFeatures
from com.vordel.es import EntityStore
from com.vordel.es.xes import ExportEngine

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
DEFAULT_GATEWAY_HOME = r"C:\Axway-7.7.20260530"

YAML_FRAG = os.path.join(PKG_ROOT, "fragment")
OUT_XML = os.path.join(PKG_ROOT, "fragment-xml", "client-registry-sync-fragment.xml")
BLANK_TPL = None  # set from gateway home in parse_args / main
TMP_XML = None  # mid export from YAML (may be YAML-types); used only for import into FED


def detect_gateway_home(explicit):
    if explicit:
        return os.path.normpath(explicit)
    env = os.environ.get("AXWAY_GATEWAY_HOME")
    if env and os.path.isdir(env):
        return os.path.normpath(env)
    if os.path.isdir(DEFAULT_GATEWAY_HOME):
        return DEFAULT_GATEWAY_HOME
    return None


def blank_template_path(gateway_home):
    return os.path.join(
        gateway_home,
        "apigateway",
        "system",
        "conf",
        "templates",
        "BlankConfiguration-VordelGateway",
    )


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Regenerate Client Registry Sync XML via Federated Entity Store."
    )
    p.add_argument(
        "--fragment",
        default=YAML_FRAG,
        help="YAML fragment directory (default: fragment/)",
    )
    p.add_argument(
        "--xml-output",
        default=OUT_XML,
        help="Output XML path (default: fragment-xml/client-registry-sync-fragment.xml)",
    )
    p.add_argument(
        "--gateway-home",
        metavar="PATH",
        help="Axway install root (default: AXWAY_GATEWAY_HOME or built-in default)",
    )
    return p.parse_args(argv or sys.argv[1:])


def strip_encrypted_passwords(xml_path):
    """Remove encrypted secret fvals AND Auth BasicProfile entities.

    Policy Studio ImportXmlWizardAction uses ChangeEncryptedFields.getEncryptedEntities.
    BasicProfile declares httpAuthPass as encrypted cardinality=1; even when the fval is
    omitted, the store materializes an empty encrypted field and triggers
    NO_VERIFIABLE_KEY_IN_IMPORT ("No Passphrase Details") because the fragment has no
    ESConfiguration.passphraseTest.
    """
    import re
    with open(xml_path, "r") as f:
        data = f.read()
    # Drop BasicProfile entities entirely.
    data2, n_prof = re.subn(
        r'<entity[^>]*type="BasicProfile">[\s\S]*?</entity>\r?\n?',
        "",
        data,
    )
    patterns = [
        r'\t*<fval name="httpAuthPass"><value>[^<]*</value></fval>\r?\n',
        r'\t*<fval name="password"><value>[^<]*</value></fval>\r?\n',
        r'\t*<fval name="passphrase"><value>[^<]*</value></fval>\r?\n',
        r'\t*<fval name="passphraseTest"><value>[^<]*</value></fval>\r?\n',
    ]
    n = 0
    for pat in patterns:
        data2, c = re.subn(pat, "", data2)
        n += c
    # Remove AuthProfilesGroup ONLY from <exportRoots> (not from profile references).
    def _scrub_export_roots(m):
        block = m.group(0)
        block2, _ = re.subn(
            r"\t*<key type='AuthProfilesGroup'>\s*"
            r"<id field='name' value='Auth Profiles'/>\s*"
            r"</key>\r?\n?",
            "",
            block,
        )
        return block2

    data2, n_root = re.subn(
        r"<exportRoots>[\s\S]*?</exportRoots>",
        _scrub_export_roots,
        data2,
        count=1,
    )
    with open(xml_path, "w") as f:
        f.write(data2)
    print("stripped BasicProfile entities:", n_prof, "encrypted fvals:", n, "auth exportRoot scrub:", n_root)


def assert_no_encrypted_in_fragment_xml(xml_path):
    """Fail if loading the XML into a Blank FED introduces fragment-owned encrypted fields.

    We compare encrypted entities before/after import and allow only pre-existing Blank ones.
    """
    from com.vordel.store.util import ChangeEncryptedFields
    from java.util import ArrayList, HashSet

    def walk(es):
        keys = ArrayList()
        queue = [es.getRootPK()]
        seen = HashSet()
        while queue:
            pk = queue.pop(0)
            if seen.contains(pk):
                continue
            seen.add(pk)
            keys.add(pk)
            for cpk in es.listChildren(pk, None):
                queue.append(cpk)
        return keys

    def enc_names(es):
        cef = ChangeEncryptedFields(es)
        arr = cef.getEncryptedEntities(walk(es))
        out = set()
        if arr is None:
            return out
        for tfe in arr:
            e = tfe.getEntity()
            try:
                name = e.getStringValue("name")
            except Exception:
                name = "?"
            out.add((e.getType().getName(), name, tuple(tfe.getFieldNames())))
        return out

    work = tempfile.mkdtemp(prefix="crs-enc-assert-")
    try:
        cfg = copy_blank(os.path.join(work, "fed"))
        api = EntityStoreAPI.create(fed_url(cfg), "")
        before = enc_names(api.es)
        api.importConf(xml_path)
        after = enc_names(api.es)
        api.close()
        added = after - before
        # Fragment must not add BasicProfile / passphraseTest / etc.
        bad = [x for x in added if x[0] in (
            "BasicProfile", "ESConfiguration", "Certificate", "KeyPair", "User"
        ) or "passphrase" in "".join(x[2]).lower() or "httpAuthPass" in x[2]]
        print("encrypted added by fragment import:", sorted(added))
        if bad:
            raise Exception("Fragment still introduces encrypted fields: %s" % (bad,))
        print("assert_no_encrypted_in_fragment_xml: OK")
    finally:
        try:
            shutil.rmtree(work)
        except Exception:
            pass


def fed_url(configs_xml):
    p = File(configs_xml).getAbsolutePath().replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p
    return "federated:file:" + p


def copy_blank(dest_dir):
    if os.path.isdir(dest_dir):
        shutil.rmtree(dest_dir)
    os.makedirs(dest_dir)
    for name in os.listdir(BLANK_TPL):
        src = os.path.join(BLANK_TPL, name)
        dst = os.path.join(dest_dir, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    return os.path.join(dest_dir, "configs.xml")


def export_yaml_to_temp_xml(yaml_api, path):
    pks = ArrayList()
    for pk in yaml_api.es.listChildren(yaml_api.es.getRootPK(), None):
        e = yaml_api.es.getEntity(pk)
        if e.getType().getName() == "ESConfiguration":
            continue
        pks.add(pk)
    flags = (EntityStore.EXPORT_ENTITIES
             | EntityStore.EXPORT_PORTABLE_ESPKS
             | EntityStore.EXPORT_TRUNKS)
    eng = ExportEngine(yaml_api.es)
    bos = ByteArrayOutputStream()
    eng.exportContents(bos, pks, flags)
    fos = FileOutputStream(path)
    bos.writeTo(fos)
    fos.close()
    print("mid XML from YAML:", path, "bytes", bos.size())
    return path


def find_named(api, type_name, name):
    queue = [api.es.getRootPK()]
    seen = set()
    while queue:
        pk = queue.pop(0)
        if pk in seen:
            continue
        seen.add(pk)
        for cpk in api.es.listChildren(pk, None):
            e = api.es.getEntity(cpk)
            queue.append(cpk)
            try:
                n = e.getStringValue("name")
            except:
                continue
            if e.getType().getName() == type_name and n == name:
                return e
    return None


def main(argv=None):
    global YAML_FRAG, OUT_XML, BLANK_TPL
    args = parse_args(argv)
    YAML_FRAG = os.path.normpath(args.fragment)
    OUT_XML = os.path.normpath(args.xml_output)
    gateway_home = detect_gateway_home(args.gateway_home)
    if not gateway_home:
        print("ERRO: --gateway-home ou AXWAY_GATEWAY_HOME obrigatorio", file=sys.stderr)
        return 1
    BLANK_TPL = blank_template_path(gateway_home)
    if not os.path.isdir(BLANK_TPL):
        print("ERRO: Blank FED template nao encontrado:", BLANK_TPL, file=sys.stderr)
        return 1

    work = tempfile.mkdtemp(prefix="crs-fed-export-")
    mid_xml = os.path.join(work, "from-yaml.xml")
    fed_dir = os.path.join(work, "blank-fed")
    try:
        print("1) Open YAML fragment")
        yprops = StoreFeatures.builder().enableValidationAllowInvalidRef().build().asProperties()
        yaml_api = EntityStoreAPI.create("yaml:file:" + YAML_FRAG, "", yprops)

        print("2) Export mid XML (for Federated import)")
        export_yaml_to_temp_xml(yaml_api, mid_xml)
        yaml_api.close()

        print("3) Import mid XML into Blank Federated FED")
        cfg = copy_blank(fed_dir)
        fed_api = EntityStoreAPI.create(fed_url(cfg), "")
        fed_api.importConf(mid_xml)

        # Collect trunks that we care about (now native Federated entities)
        export_pks = ArrayList()
        markers = [
            ("CircuitContainer", "Client Registry Sync"),
            ("HTTP", "Client Registry Sync Services"),
            # Peer URL vem de envSettings.props (${env.CLIENT.REGISTRY.SYNC.PEER.URL})
            # APIM local usa RemoteHost local-apimanager (alias na URL + Addresses).
            ("RemoteHost", "local-apimanager"),
            ("PortalCallbackGroup", "Portal Alerts"),
            # Anti-loop A↔B: Local Cache com TTL (Is Cached? / Cache Attribute).
            ("Cache", "Client Registry Sync Seen"),
            # NÃO exportar AuthProfilesGroup / BasicProfile: httpAuthPass encrypted
            # materializa-se vazio e o Policy Studio mostra "No Passphrase Details".
        ]
        for t, n in markers:
            e = find_named(fed_api, t, n)
            if e is None:
                print("WARN missing after import:", t, n)
                continue
            print("export trunk:", t, n)
            export_pks.add(e.getPK())

        print("4) Re-export from Federated -> Policy Studio compatible XML")
        # Sem EXPORT_TYPES: o projeto XML destino ja tem os types.
        # EXPORT_TYPES no Blank despeja o catalogo inteiro e o ImportUpgrader
        # do Policy Studio falha com "Unable to upgrade the import file".
        flags = (EntityStore.EXPORT_ENTITIES
                 | EntityStore.EXPORT_PORTABLE_ESPKS
                 | EntityStore.EXPORT_TRUNKS)
        eng = ExportEngine(fed_api.es)
        bos = ByteArrayOutputStream()
        eng.exportContents(bos, export_pks, flags)
        File(OUT_XML).getParentFile().mkdirs()
        fos = FileOutputStream(OUT_XML)
        bos.writeTo(fos)
        fos.close()
        print("Wrote", OUT_XML, "bytes", bos.size())

        data = bos.toString("UTF-8")
        if "superType:" in data[:50000]:
            raise Exception("YAML pollution still present in fragment head")
        if "<entityType" in data[:2000]:
            print("NOTE: entityType present in head (unexpected without EXPORT_TYPES)")
        print("head metaInfo OK, no YAML types")
        fed_api.close()

        # Strip encrypted passwords / BasicProfiles so Policy Studio does not
        # show "No Passphrase Details"
        strip_encrypted_passwords(OUT_XML)
        assert_no_encrypted_in_fragment_xml(OUT_XML)
        print("DONE OK")
    finally:
        try:
            shutil.rmtree(work)
        except:
            pass


if __name__ == "__main__":
    sys.exit(main() or 0)
