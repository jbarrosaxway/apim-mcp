---
title: "Client credentials grant flow"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_oauth/oauth_flows/oauth_flows_client_credentials/index.html
scrapedAt: 2026-08-21T20:46:20.394Z
---

2 minute read

The client credentials grant type must only be used by confidential clients.

The client can request an access token using only its client credentials (or other supported means of authentication) when the client is requesting access to the protected resources under its control. The client can also request access to those of another resource owner that has been previously arranged with the authorization server (the method of which is beyond the scope of the specification).

## Request an access token

The client token request should be sent in an HTTP POSTto the token endpoint with the following parameters:

| Parameter | Description |

| --- | --- |

| grant_type | Required. Must be set to client_credentials. |

| scope | Optional. A list of scopes, delimited by space ( ) or comma (,), which indicates the scope of the authorization. A plus sign (+) is also accepted as a delimiter when submitting the request via query string parameters. |

| format | Optional. Expected return format. The default is json. Possible values are:urlencoded, json, xml |



The following is an example POST request:

```

POST /api/oauth/token HTTP/1.1
Content-Length:424
Content-Type:application/x-www-form-urlencoded; charset=UTF-8
Host:192.168.0.48:8080
Authorization:Basic czZCaGRSa3F0MzpnWDFmQmF0M2JW
grant_type=client_credentials

```

Comma (,) and space ( ) characters are treated as delimiters when specified in the scope parameter. For example, if you send the following client token request, API Gateway returns an access token containing "scope":"resource.WRITE resource.READ".

```

curl -ki https://localhost:8089/api/oauth/token --data-urlencode 'scope=resource.WRITE,resource.READ'

```

- The comma is interpreted as a space.

- The plus sign (+) delimiter is not allowed here because it is a POST request, with the scopes specified in the body of the request.

## Handle the response

The API Gateway authenticates the client against the Client Application Registry. An access token is sent back to the client on success. A refresh token is not included in this flow. An example valid response is as follows:

```

HTTP/1.1 200 OK
Cache-Control:no-store
Content-Type:application/json
Pragma:no-cache
{
    "access_token":“O91G451HZ0V83opz6udiSEjchPynd2Ss9......",
     "token_type":"Bearer",
     "expires_in":"3600"
}

```

## Run the sample client

The following Jython sample client sends a request to the authorization server using the client credentials flow:

```

INSTALL_DIR/samples/scripts/oauth/client_credentials.py

```

To run the sample, open a shell prompt at INSTALL_DIR/samples/scripts, and execute the following command:

```

run oauth/client_credentials.py

```

The script outputs the following:

```

Sending up access token request using grant_type set to client_credentials
Response from access token request:200
Parsing the json response
**********************ACCESS TOKEN RESPONSE***********************************
Access token received from authorization server OjtVvNusLg2ujy3a6IXHhavqdEPtK7qSmIj9fLl8qywPyX8bKEsjqF
Access token type received from authorization server Bearer
Access token expiry time:3599
******************************************************************************
Now we can try access the protected resource using the access token
Response from protected resource request is:200
<html>Congrats! You've hit an OAuth protected resource</html>

```

##### On this page

- Request an access token

- Handle the response

- Run the sample client
