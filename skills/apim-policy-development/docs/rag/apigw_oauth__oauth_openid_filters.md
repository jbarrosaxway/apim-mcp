---
title: "OpenID Connect filters"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_oauth/oauth_openid_filters/index.html
scrapedAt: 2026-08-21T20:46:48.062Z
---

4 minute read

## Create an OpenID Connect ID token filter

You can use the Create ID Token filter to create an OpenID Connect ID token when API Gateway is acting as an OpenID Connect server (also known as OpenID provider or OP). It is the responsibility of the OAuth authorization server to generate an ID token. The ID token is a security token that contains claims about the authentication of an end user by an authorization server when using a client. The ID token is represented as a JSON Web Token (JWT).

To generate an ID token the following claims are required:

- iat

- iss

- exp

- sub

- aud

For more information on the required claims within an ID token, see the OpenID Connect specification.This filter enables you to specify the subject (sub), the issuer (iss), and the expiration time (exp) of the ID token. Other claims (for example, iat, exp, and aud) are handled internally. The JWT expiry in seconds is appended on to the current time to give the ID token an expiry.

This filter also enables you to specify how to sign the ID token, and to add additional claims to the ID token.

Configure the following general settings for the Create ID Token filter:

Name: Enter a suitable name for this filter.

Subject (sub): Subject identifier. A locally unique and never reassigned identifier within the issuer for the end-user, which is intended to be consumed by the client. The default value is ${authentication.subject.id}.

Issuer (iss): Issuer identifier for the issuer of the response. The default value is ${http.request.url}.

Expiration time in secs (exp): Enter the expiry time for the ID token, in seconds. The default value is 60 seconds.

Apply a signature algorithm: Select one of the following options:

- Sign ID token with private key: Select this option and click Signing Key to select a private key certificate that has been registered with the OpenID provider, and use it to sign the ID token.

- Sign using client secret: Select this option to sign the ID token using a client secret issued by the OpenID provider.

Add the following claims: Click the Add button to add additional claims. You can also Edit or Delete existing claims.

## Verify an OpenID Connect ID token filter

You can use the Verify ID Token filter to verify an OpenID Connect ID token using a JSON Web Key (JWK) set, certificate, or client secret. The ID token is a security token that contains claims about the authentication of an end user by an authorization server when using a client. The ID token is represented as a JSON Web Token (JWT).

This filter requires the message attributes openid.idtoken and oauth.client.application to be on the message whiteboard. The filter parses the ID token into a JWT header and claim and validates the signature using either a JWK set, a certificate, or a client secret. On success the filter returns true and sets the ID token (openid.idtoken) claim and subvalues on the message whiteboard.

For more information on OpenID Connect, see the OpenID Connect specification.

Configure the following general settings for the Verify ID Token filter:

Name: Enter a suitable name for this filter.

Clock Skew (seconds): Enter a number of seconds to allow for clock skew. This allows for clock skew when verifying the token’s issued at (iat) time, expiration time (exp), and not before values. The default value is 60 seconds.

Issuer (iss): Issuer identifier for the issuer of the response. The default value is ${oauth.client.application.getTokenURL().toString()}.

Verify ID Token: Select one of the following options:

- With JSON Web Key Set: Select this option to verify the ID token using a JWK set.

- With Certificate: Select this option and click Signing Key to select a private key certificate, and use it to verify the ID token.

- With Client Secret: Select this option to verify the ID token using a client secret.

Note that at execution time of this filter, the aud claim of the given OpenID connect token is additionally verified, which must match to clientId of the used OAuth-Client-Application (oauth.client.application.getClientId()).

##### On this page

- Create an OpenID Connect ID token filter

- Verify an OpenID Connect ID token filter
