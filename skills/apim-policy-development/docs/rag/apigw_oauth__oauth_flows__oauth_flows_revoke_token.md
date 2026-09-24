---
title: "Revoke token flow"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_oauth/oauth_flows/oauth_flows_revoke_token/index.html
scrapedAt: 2026-08-21T20:46:23.877Z
---

2 minute read

In some cases a user might wish to revoke access given to an application. An access token can be revoked by calling the API Gateway revoke service and providing the access token to be revoked.

The endpoint for revoke token requests is as follows:

```

https://HOST:8089/api/oauth/revoke

```

The token to be revoked should be sent to the revoke token endpoint in an HTTP POST with the following parameters:

| Parameter | Description |

| --- | --- |

| token | Required. A token to be revoked (for example, 4eclEUX1N6oVIOoZBbaDTI977SV3T9KqJ3ayOvs4gqhGA4). |

| token_type_hint | Optional. A hint specifying the token type. For example, access_token or refresh_token. |



The following is an example POST request:

```

POST /api/oauth/revoke HTTP/1.1
Content-Type:application/x-www-form-urlencoded; charset=UTF-8
Host:192.168.0.48:8080
Authorization:Basic U2FtcGxlQ29uZmlkZW50aWFsQXBwOjY4MDhkNGI2LWVmMDktNGIwZC04ZjI4LT
NiMDVkYTljNDhlYw==token=4eclEUX1N6oVIOoZBbaDTI977SV3T9KqJ3ayOvs4gqhGA4
&token_type_hint=refresh_token

```

## Run the sample client

The following Jython sample client creates a token revoke request to the authorization server:

```

INSTALL_DIR/samples/scripts/oauth/revoke_token.py

```

To run the sample, open a shell prompt at INSTALL_DIR/samples/scripts, and execute the following command:

```

run oauth/revoke_token.py

```

Paste the value associated with the token in the dialog:

Select the type of token hint in the next dialog:

If you select none, no token_type_hint parameter is specified in the POST request. If you select access_token, the POST request contains token_type_hint=access_token. If you select refresh_token, the POST request contains token_type_hint=refresh_token.

When the authorization server receives the token revocation request, it first validates the client credentials and verifies whether the client is authorized to revoke the particular token based on the client identity.

##### Note

The authorization server decides whether the token is an access token or a refresh token:

- If it is an access token, this token is revoked.

- If it is a refresh token, all access tokens issued for the refresh token are invalidated, and the refresh token is revoked.

## Response codes

The following HTTP status response codes are returned:

- HTTP 200 if the token was revoked successfully or if an invalid token was submitted.

- HTTP 401 if client authentication failed.

- HTTP 403 if the client is not authorized to revoke the token.

The following is an example response:

```

Token to be revoked:3eXnUZzkODNGb9D94Qk5XhiV4W4gu9muZ56VAYoZiot4WNhIZ72D3
Revoking token...............
Response from revoke token request is:200
Successfully revoked token

```

##### On this page

- Run the sample client

- Response codes
