# -*- coding: utf-8 -*-
"""
Valida o fragmento XML Client Registry Sync.

Estratégia (não existe yamles validate para XML):
  1) Parse XML (entityStoreData)
  2) Import dry-run num FED template BlankConfiguration do Gateway
  3) Confirma entidades-chave (policies, alerts, listener, remotes)

Uso:
  C:\\Axway-7.7.20260530\\apigateway\\Win32\\bin\\jython.bat ^
    policies\\client-registry-sync\\scripts\\validate-xml-fragment.py

  Opcional:
    --xml  caminho\\do\\fragment.xml
    --fed  caminho\\para\\configs.xml  (FED destino de teste; default = template Blank)
"""
from __future__ import print_function
import os
import sys
import shutil
import tempfile
from java.io import File, FileInputStream
from java.lang import Throwable
from esapi import EntityStoreAPI
from com.vordel.es.xes import XMLParser

DEFAULT_XML = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "fragment-xml", "client-registry-sync-fragment.xml")
def _default_gateway_home():
    return os.environ.get("AXWAY_GATEWAY_HOME", r"C:\Axway-7.7.20260530")


def _blank_tpl():
    return os.path.join(
        _default_gateway_home(),
        "apigateway",
        "system",
        "conf",
        "templates",
        "BlankConfiguration-VordelGateway",
    )

REQUIRED_NAMES = (
    "Client Registry Sync",
    "On Create Organization",
    "On Delete Organization",
    "On Enable Organization",
    "On Disable Organization",
    "Upsert Organization",
    "Update Organization Status",
    "Update Application Status",
    "Update Credential",
    "Delete Organization",
    "Path Delegator",
    "Create Organization",
    "Delete Organization",
    "local-apimanager",
    "Client Registry Sync Services",
    "Call Target Sync Endpoint",
    "Guard Sync Send",
    "Mark Sync Seen",
    "Client Registry Sync Seen",
)


def fed_url(configs_xml):
    p = File(configs_xml).getAbsolutePath().replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p
    return "federated:file:" + p


def parse_args(argv):
    xml = os.path.normpath(DEFAULT_XML)
    fed = None
    i = 0
    while i < len(argv):
        if argv[i] == "--xml" and i + 1 < len(argv):
            xml = argv[i + 1]
            i += 2
        elif argv[i] == "--fed" and i + 1 < len(argv):
            fed = argv[i + 1]
            i += 2
        else:
            i += 1
    return xml, fed


def check_xml_static_rules(xml_path):
  """Regras aprendidas do ImportXmlWizardAction / ImportUpgrader (Policy Studio 7.7)."""
  import re
  print("[2/4] Regras estaticas (PS import)")
  with open(xml_path, "r") as f:
    data = f.read()
  problems = []
  if "superType:" in data:
    problems.append("realizedTypes em YAML (superType:) — regenerar via yaml-frag-to-xml.py")
  if re.search(r'<entity[^>]*type="BasicProfile"', data):
    problems.append("entidade BasicProfile no fragmento (usar strip / sem passwords)")
  if "passphraseTest" in data:
    problems.append("campo passphraseTest presente (No Passphrase Details no PS)")
  if re.search(r'<fval name="httpAuthPass"><value>[^<]+</value></fval>', data):
    problems.append("httpAuthPass com valor encriptado")
  head = data[:8000]
  if "<entityType" in head and "<realizedTypes>" not in head:
    problems.append("entityType fora de realizedTypes no cabecalho")
  if problems:
    raise Exception("Regras estaticas falharam: " + "; ".join(problems))
  print("      OK (sem YAML pollution / BasicProfile / passphrase)")


def check_xml_well_formed(xml_path):
    print("[1/4] Parse XML:", xml_path)
    if not os.path.isfile(xml_path):
        raise IOError("XML nao encontrado: " + xml_path)
    size = os.path.getsize(xml_path)
    print("      size=%d bytes" % size)
    if size < 1000:
        raise Exception("XML demasiado pequeno")
    # SAX parse — falha se XML invalido (ex. & sem escape)
    from javax.xml.parsers import SAXParserFactory
    from org.xml.sax.helpers import DefaultHandler
    factory = SAXParserFactory.newInstance()
    factory.setNamespaceAware(True)
    parser = factory.newSAXParser()
    fis = FileInputStream(xml_path)
    try:
        parser.parse(fis, DefaultHandler())
    finally:
        fis.close()
    print("      OK well-formed")


def prepare_fed(fed_configs):
    if fed_configs:
        if not os.path.isfile(fed_configs):
            raise IOError("FED configs.xml não encontrado: " + fed_configs)
        return fed_configs, None
    blank_tpl = _blank_tpl()
    if not os.path.isdir(blank_tpl):
        raise IOError("Template BlankConfiguration não encontrado: " + blank_tpl)
    tmp = tempfile.mkdtemp(prefix="crs-xml-validate-")
    for name in os.listdir(blank_tpl):
        src = os.path.join(blank_tpl, name)
        dst = os.path.join(tmp, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    cfg = os.path.join(tmp, "configs.xml")
    print("[3/4] FED de teste (Blank):", cfg)
    return cfg, tmp


def import_and_check(xml_path, configs_xml):
    print("[4/4] Import + lookup entidades-chave")
    api = EntityStoreAPI.create(fed_url(configs_xml), "")
    try:
        api.importConf(xml_path)
        found = {}
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
                    name = e.getStringValue("name")
                except:
                    continue
                if name in REQUIRED_NAMES:
                    found[name] = e.getType().getName()
        missing = [n for n in REQUIRED_NAMES if n not in found]
        print("      encontrados: %d / %d" % (len(found), len(set(REQUIRED_NAMES))))
        for n in sorted(found):
            print("        +", found[n], n)
        if missing:
            raise Exception("Faltam entidades: " + ", ".join(missing))
        print("Validation successful.")
    finally:
        api.close()


def main(argv):
    xml, fed = parse_args(argv)
    tmp = None
    try:
        check_xml_well_formed(xml)
        check_xml_static_rules(xml)
        configs, tmp = prepare_fed(fed)
        import_and_check(xml, configs)
        return 0
    except Throwable, e:
        print("Validation FAILED:", e)
        return 1
    except Exception, e:
        print("Validation FAILED:", e)
        return 1
    finally:
        if tmp and os.path.isdir(tmp):
            try:
                shutil.rmtree(tmp)
            except:
                pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
