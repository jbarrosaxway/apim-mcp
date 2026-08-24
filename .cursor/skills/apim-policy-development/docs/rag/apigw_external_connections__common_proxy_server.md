---
title: "Configure proxy servers"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_external_connections/common_proxy_server/index.html
scrapedAt: 2026-08-21T20:45:51.398Z
---

2 minute read

You can configure settings for individual proxy servers under the Environment Configuration > External Connections node in the Policy Studio tree, which you can then specify at the filter level (in the Connection and Connect To URL filters). When configured, the filter connects to the HTTP proxy server, which in turn routes the message on to the destination server named in the request URI.

##### Note

## Configuration

To configure a proxy server under the Environment Configuration > External Connections tree node, right-click the Proxy Servers node, and select Add a Proxy Server. You can configure the following settings in the dialog:

| Proxy Server Setting | Description |

| --- | --- |

| Name | Unique name or alias for these proxy server settings. |

| Host | Host name or IP address of the proxy server. |

| Port | Port number on which to connect to the proxy server. |

| Username | Optional user name when connecting to the proxy server. |

| Password | Optional password when connecting to the proxy server. |

| Scheme | Specifies whether the proxy server uses the HTTP or HTTPS transport. Defaults to HTTP. |



These proxy server settings are different from the global proxy settings in the Preferences dialog in Policy Studio, which apply only when downloading WSDL, XSD, and XSLT files from Policy Studio. For more details, see Proxy settings.

##### On this page

- Configuration
