---
title: "Configure RADIUS clients"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_external_connections/common_radius_client/index.html
scrapedAt: 2026-08-21T20:45:53.596Z
---

2 minute read

The API Gateway provides support for integration with remote systems over the Remote Authentication Dial In User Service (RADIUS) protocol over UDP.

RADIUS is a client-server network protocol that provides centralized authentication and authorization for clients connecting to remote services. For more details, see the RADIUS specification.

To configure a client connection to a remote server over the RADIUS protocol, under the Environment Configuration > External Connections tree node in the Policy Studio, select RADIUS Clients > Add a RADIUS Client.

This topic explains how to configure the settings in the RADIUS Client dialog.

For details on how to configure a RADIUS authentication repository, see RADIUS repositories.

## Configuration

Configure the following fields in the RADIUS Client dialog:

Name: Enter an appropriate name for the RADIUS client to display in Policy Studio.

Host name: Enter the host name used by the RADIUS client.

Client port: Enter the port number used by the RADIUS client. This must be set to 0, which will make the API Gateway use a new ephemeral port each restart.

RADIUS servers: This field displays a list of configured RADIUS servers. To add a server to the list, click Add, and complete the following fields:

| Field | Description |

| --- | --- |

| Name | Name of the RADIUS server. |

| Port | Port number used by the RADIUS server. |

| Secret | Shared secret used to access the RADIUS server. |

| Response timeout (sec) | Response timeout in seconds before the connection to the server is closed. |

| Retransmit count | Number of times retransmission is attempted before the connection to the server fails. |

| Protect from the BlastRADIUS attack | Prevents the BlastRADIUS attack as described in RFC 3579, section 3.2. Enabled by default. |



##### On this page

- Configuration
