---
title: "API Gateway OAuth 2.0 authentication flows"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_oauth/oauth_flows/index.html
scrapedAt: 2026-08-21T20:46:12.729Z
---

1 minute read

API Gateway can use the OAuth 2.0 protocol for authentication and authorization. API Gateway can act as an OAuth 2.0 authorization server and supports several OAuth 2.0 flows that cover common web server, JavaScript, device, installed application, and server-to-server scenarios.

API Gateway includes sample Jython scripts for all supported OAuth flows. For example, to run a sample script for the implicit grant flow:

```

cd INSTALL_DIR/samples/scripts/oauth
sh run.sh oauth/implicit_grant.py

```

In addition to the following flows, API Gateway also supports:

- Refresh token flow – After the client application has been authorized for access, it can use a refresh token to get a new access token. This is only done after the consumer already has received an access token using the authorization code grant or resource owner password credentials flow.

- SAML assertion flow – The OAuth 2.0 Access Token using SAML Assertion filter enables an OAuth client to request an access token using a SAML assertion. This flow is used when a client wishes to utilize an existing trust relationship, expressed through the semantics of the SAML assertion, without a direct user approval step at the authorization server.

---

##### Authorization code grant (or web server) flow

The authorization code or web server flow is suitable for clients that can interact with the end-user’s user-agent (typically a web browser), and that can receive incoming requests from the authorization server (can act as an HTTP server).

##### Implicit grant (or user agent) flow

The implicit grant (user agent) authentication flow is used by client applications (consumers) residing on the user’s device.

##### Resource owner password credentials flow

The resource owner password credentials grant type is suitable in cases where the resource owner has a trust relationship with the client (for example, the device operating system or a highly privileged application).

##### Client credentials grant flow

This user name and password flow is used when the client application needs to directly access its own resources on the resource server. Only the client application’s credentials are used in this flow. The resource owner’s credentials are not required.

##### JWT flow

This flow is similar to OAuth 2.0 client credentials. In the OAuth 2.0 JWT flow, the client application is assumed to be a confidential client that can store the client application’s private key.

##### Revoke token flow

A revoke token request causes the removal of the client application permissions associated with the particular token to access the end-user’s protected resources.

##### Token information service flow

Use the token information service to validate that an access token was issued by the API Gateway.
