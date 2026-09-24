---
title: "Set up API Gateway OAuth server"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_oauth/gw_server/index.html
scrapedAt: 2026-08-21T20:46:27.399Z
---

3 minute read

##### Note

## Deploy OAuth services

To set up API Gateway as an OAuth authorization server and OAuth resource server, you must deploy the OAuth services. Perform the following steps:

1. Open Policy Studio and open or create a new project.

2. Select File > Configure OAuth.

3. If you do not have any Cassandra hosts configured, you must add a Cassandra host before you can continue: Enter a name for the Cassandra server (for example, local_cassandra) Enter the host name of the Cassandra host (for example, localhost) Enter the port of the Cassandra host (for example, 9042)

4. Click Next.

5. Select all or authzserver as the OAuth deployment type. all – Deploys the OAuth 2.0 services listener and supporting policies, and the OAuth client demo. This deploys the OAuth server components on port 8089 and deploys the client demo on port 8088. This option does not register the sample client applications in the Client Application Registry. You must import them manually as detailed in Import sample client applications. authzserver – Select this option to deploy the OAuth server components only.

6. Click Finish.

7. Click Deploy in the toolbar to deploy the updated configuration to API Gateway.

##### Note

## Enable OAuth endpoints

To enable the OAuth management endpoints on your API Gateway, perform the following steps:

1. In the Policy Studio tree, select Environment Configuration > Listeners > API Gateway > OAuth 2.0 Services > Ports.

2. Right-click the OAuth 2.0 Interface in the panel on the right, and select Edit.

3. Select Enable Interface in the dialog.

4. Click the Deploy button in the toolbar.

5. Enter a description and click Finish.

##### Note

The API Gateway provides the following endpoints used to manage OAuth 2.0 client applications:

| Description | URL |

| --- | --- |

| Authorization Endpoint (REST API) | https://HOST:8089/api/oauth/authorize |

| Token Endpoint (REST API) | https://HOST:8089/api/oauth/token |

| Token Info Endpoint (REST API) | https://HOST:8089/api/oauth/tokeninfo |

| Revoke Endpoint (REST API) | https://HOST:8089/api/oauth/revoke |

| Client Application Registry (HTML Interface) | https://HOST:8089 |

| Client Application Registry (REST API) | https://HOST:8089/api/kps/ClientApplicationRegistry |



In this table, HOST refers to the machine on which API Gateway is installed.

##### On this page

- Deploy OAuth services

- Enable OAuth endpoints
