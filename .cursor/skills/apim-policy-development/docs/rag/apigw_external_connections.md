---
title: "Configure external connections"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_external_connections/index.html
scrapedAt: 2026-08-21T20:45:36.912Z
---

1 minute read

API Gateway can leverage your existing identity management infrastructure and avoid maintaining separate silos of user information. For example, if you already have a database full of user credentials, API Gateway can authenticate requests against this database, rather than using its own internal user store. Similarly, API Gateway can authorize users, look up user attributes, and validate certificates against third-party identity management servers.

You can add each connection to an external system as a global External Connection in Policy Studio so that it can be reused across all filters and policies. For example, if you create a policy that authenticates users against an LDAP directory and then validates an XML signature by retrieving a public key from the same LDAP directory, it makes sense to create a global external connection for that LDAP directory. You can then select the LDAP connection in both the authentication and XML signature verification filters, rather than having to reconfigure it in both filters.

---

##### Configure authentication repositories

Configure API Gateway to authenticate clients using user name and password combinations stored in an authentication repository.

##### Configure client credentials

Client credentials enable you to globally configure client authentication settings for the following authentication options:

##### Configure database connections

Configure database connections and database queries.

##### Configure ICAP servers

Configure API Gateway to connect to an ICAP server.

##### Configure Kerberos services

Configure API Gateway to act as a Kerberos service.

##### Configure LDAP directories

Configure a connection to an LDAP or LDAPS directory.

##### Configure proxy servers

Configure settings for individual proxy servers, which you can then specify at the filter level.

##### Configure RADIUS clients

Integrate API Gateway with remote systems over the RADIUS protocol.

##### Configure Sentinel servers

Configure API Gateway to send events to Axway Sentinel server.

##### Configure SMTP servers

Configure the API Gateway to use a specified SMTP server to relay messages to an email recipient.

##### Configure Syslog servers

Configure API Gateway to use a specific remote Syslog server.

##### Configure Tivoli connections

Configure API Gateway to connect to a Tivoli server.

##### Configure XKMS connections

Configure API Gateway to query an XKMS responder to determine whether a given certificate can be trusted.

##### Configure connection groups and URL groups

Configure API Gateway to connect to multiple external servers in a connection group, or multiple URLs in a URL group, on a round-robin basis.
