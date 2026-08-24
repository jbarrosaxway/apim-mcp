---
title: "Configure Syslog servers"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_external_connections/common_syslog_server/index.html
scrapedAt: 2026-08-21T20:46:00.446Z
---

1 minute read

You can configure the Syslog server as a global configuration item under the Environment Configuration > External Connections node. The Syslog server is then available as a customized logging destination for an API Gateway instance.

To configure a Syslog server, right-click the Environment Configuration > External Connections > Syslog Servers node, and select Add a Syslog Server.

## Configuration

Configure the following fields in the Syslog Server settings dialog:

- Name: Enter an appropriate name for the syslog server.

- Host: Enter the host and UDP port on which the syslog daemon is running. Enter in the format of HOST_OR_IP_ADDRESS:UDP_PORT (for example, 192.0.2.0:514). Alternatively, you can enter HOST_OR_IP_ADDRESS only, and the default port of 514 is used.

- Facility: Select the syslog facility to log to (for example, local0).

##### On this page

- Configuration
