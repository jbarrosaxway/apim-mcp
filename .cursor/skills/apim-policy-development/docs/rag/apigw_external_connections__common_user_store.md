---
title: "Configure authentication repositories"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_external_connections/common_user_store/index.html
scrapedAt: 2026-08-21T20:45:39.185Z
---

18 minute read

API Gateway supports a wide range of common authentication schemes, including SSL, XML signatures, WS-Security Username tokens, and HTTP authentication. With SSL, the client authenticates to API Gateway using a client certificate. With XML signatures, the client is authenticated by validating the signature contained within the XML message. However, when API Gateway attempts to authenticate a client using a user name and password (for example, WS-Security Username tokens or HTTP authentication), it must compare the user name and password presented by the client to those stored in the authentication repository.

The authentication repository acts as a repository for users. Users serve many roles in API Gateway. For example, clients whose user name and password combinations are stored in the authentication repository can authenticate to API Gateway using that user name and password combination.

The authentication repository can be maintained in API Gateway’s local configuration store, in an LDAP directory, or in a range of third-party Identity Management products and services. When a user has been successfully authenticated against one of these repositories, API Gateway can use any one of that user’s stored attributes (for example, distinguished name (DName), email address, user name) to authorize that same user in a subsequent authorization filter.

For example, this credential mapping is useful in cases where your client-base uses user name and password combinations for authentication (authentication attributes), but their access rights must be looked up in an authorization server using the client’s DName (authorization attribute). In this way, the client possesses a single virtual identity within API Gateway. The client can use one identity for authentication, and another for authorization, yet API Gateway sees both identities as representing the same client.

You can add a new repository under the Environment Configuration > External Connections node in Policy Studio node tree. Right-click the appropriate node (for example, Database Repositories), and select Add a new Repository. Similarly, you can edit an existing repository. Right-click the repository node (for example, the default Local User Store), and select Edit Repository. You can reuse the repositories added under the External Connections node in multiple filters.

## Database repositories

API Gateway can store its authentication repository in an external database. This option makes sense if your organization already has a silo of user profiles stored in the database and you do not want to duplicate this store within API Gateway’s local configuration storage.

To authenticate users against a database repository, right-click Database Repositories, and select Add a new Repository. Complete the following fields on the Authentication Repository dialog:

Repository Name: Enter an appropriate name for the database in the Repository Name field.

Database: There are two basic configuration items required to retrieve a user’s profile from the database:

- Database Location: To configure connection details for the database, click Add, and complete the Database Connection dialog. For details on configuring the fields on this dialog, see Configure database connections. To edit or remove previously configured database connections, select them from the drop-down list and click Edit or Delete.

- Database Query: Database Query retrieves the profile of a specific user from the database to enable API Gateway to authenticate the user. after a successful authentication, you can select an attribute of this user to use for the authorization filter later in the policy. Database Query can be an SQL statement, stored procedure, or function call. For details on how to configure Database Query, see Configure database queries.

Format Password Received From Client: If the user sends up a clear-text password to API Gateway, but that user’s password is stored in a hashed format in the database, API Gateway must hash the password before performing the authentication step.

- Hash Client Password: Depending on whether you wish to hash the user’s submitted password, select the appropriate option.

- Hash Format: If you have selected to hash the client’s password, you must specify the format of the hashed password. The most typical formats have been listed, but you can also enter another format. Formats should be entered in terms of message attribute selectors. The following formats are available from the Hash Format list. ${authentication.subject.id}:${authentication.subject.realm}:${authentication.subject.password} ${authentication.subject.password} Copy The first option combines the username, authentication realm, and password respectively. This combination is then hashed. The second option simply creates a hash of the user’s password.

- Hash Algorithm: Select either MD5 or SHA1 as the digest algorithm to use when creating the hash.

Query Result Processing: You can use these options to provide API Gateway with some meta information about the result Database Query returns. You can identify the name of the database table column or row that contains the user’s password, as well as the name of the column or row that contains the attribute that is to be used for the authorization filter.

- Password Column: Specify the name of the database table column that contains the user’s password. The contents of this column are compared to the password the user submits.

- Password Type: Depending on how the user’s password has been stored in the database, select either Clear Password or Digest Password.

- Authorization Attribute Column: When Database Query is run, all of the user’s attributes are returned. Only the user’s user name and password are used for the authentication event. In addition, you can use one of the other user’s attributes for authorization at a later stage in the policy. The additional authorization attribute must be either a user name or an X.509 DName. Enter the name of the column containing the user name or the DName here, but only if this value is required for authorization purposes.

- Authorization Attribute Format: API Gateway’s authorization filters are all based on a user name or DName. All authorization filters evaluate if a user identified by a user name or DName is allowed to access a specific resource. Select the appropriate format from the drop-down list depending on what type of user credential is stored in the database table column entered above.

## Entrust GetAccess repositories

Entrust GetAccess provides Identity Management and access control services for web resources. It centrally manages access to web applications, enabling users to benefit from a single sign-on capability when accessing the applications that they are authorized to use.

You can configure API Gateway to connect to a group of GetAccess servers in a round-robin fashion. This provides the necessary failover capability if one or more GetAccess servers are not available. When API Gateway successfully authenticates to a GetAccess server, it obtains authorization information about the end user from the GetAccess SAML PDP. The authorization details are returned in a SAML authorization assertion thatAPI Gateway then validates to determine whether the request should be allowed.

To authenticate users against an Entrust GetAccess repository, right-click Entrust GetAccess Repositories, and select Add a new Repository. Configure the following fields on the Authentication Repository dialog:

Repository Name: Enter an appropriate name for this repository.

Request: Configure the following request settings:

- URL Group: Select a URL group from the drop-down list. This group consists of a number of GetAccess Servers to which API Gateway round-robins connection attempts. To add URL groups, in the node tree, click Environment Configuration > External Connections > URL Connection Sets, right-click Entrust GetAccess URL Sets, and select Add a URL Set. For more details on adding and editing URL groups, see Configure URL groups.

- WS-Trust Attribute Field Name: Specify the field name for the Id field in the WS-Trust request. The default is Id.

Response: Configure the following response settings:

- SOAP Actor/Role: To add the SAML authorization assertion to the response message, select a SOAP actor/role to indicate the WS-Security block where the assertion is added. If you leave this field blank, the assertion is not added to the message.

- Drift Time: The specified time is used to allow for the possible difference between the time on the GetAccess SAML PDP and the time on the machine hosting API Gateway. This comes into effect when validating the SAML authorization assertion.

## Local repositories

The authentication repository can be maintained in the same database that API Gateway uses to store all its configuration information. To edit the default user store, select Local Repositories > Local User Store > Edit Repository. Alternatively, to create a new user store, select Local Repositories > Add a new Repository.

You can enter an appropriate name for the repository in the Repository Name field. The Authorization Attribute Format field enables administrators to specify whether to use the client’s X.509 Distinguished Name or User Name in subsequent authorization filters. If User Name is selected, the user name the client uses to authenticate to API Gateway is used in any configured authorization filters. If X.509 Distinguished Name is selected, the X.509 DName API Gateway has stored for that user is used for subsequent authorization.

For example, if the administrator selects User Name from the Authorization Attribute Format list, admin (the User Name field) is used for authorization. Alternatively, if the administrator selects X.509 Distinguished Name, the X.509 DName is used for authorization (for example, O=Company, OU=comp, EMAIL=emp@company.com, CN=emp).

For more information on adding and configuring users to the authentication repository, see Manage API Gateway users.

## LDAP repositories

In cases where an organization stores user profiles in an LDAP directory, it does not make sense to re-enter these profiles into the default API Gateway user store. Instead, API Gateway can leverage an existing LDAP directory by querying it for user profile data. If a user’s profile can be retrieved, and you can bind to the LDAP directory as that user, the user is authenticated.

### Authentication with LDAP

When a filter is configured to authenticate a user against an LDAP repository using a user name and password combination, the flow is as follows:

1. A pooled LDAP connection to the repository selected in the LDAP Directory field is retrieved.

2. A search filter is run using the retrieved connection (for example, (&(objectClass={User})(sAMAccountName={c05vc}))). Attributes configured in the Login Authentication Attribute and Authorization Attribute fields are retrieved in this search. For example, if you select Distinguished Name from the drop-down list, the user’s DName is retrieved from the LDAP directory. This uniquely identifies the user in the LDAP directory, and is used to bind to the directory so the user’s password can be verified. The attribute specified in Login Authentication Attribute is used when you bind as any user. The value of the attribute specified in Authorization Attribute is stored in authentication.subject.id, and can be used by subsequent filters in the policy (for example, Authorization filters that authorize the authenticated user).

3. If no results are returned from the search, the user is not found in the directory. It is important that the administrator user configured on the Configure LDAP Server window has the ability to see the user that you are attempting to authenticate.

4. If multiple users are returned from the search, an attempt is made to bind to the directory using each Login Authentication Attribute value retrieved from the search, together with the password from the message.

5. If more than one user is authenticated correctly, an error is returned because you only want to authenticate a single user.

6. If no user is authenticated, an error is returned.

7. If a single user’s Login Authentication Attribute value and password binds successfully to the directory, authentication has succeeded.

8. Any successful bind is immediately closed.

### Create an LDAP repository

To create a new LDAP repository, right-click LDAP Repositories, and select Add a new Repository. The details entered on the Authentication Repository dialog depend on the type of LDAP directory that you are using. Policy Studio has default entries for some of the more common LDAP directories, which are available from the drop-down lists. However, you can also connect to alternative LDAP directories.

The following subsections demonstrate how to configure this window for typical user searches on three common LDAP servers:

- Oracle Directory Server

- Microsoft Active Directory Server

- IBM Directory Server

#### Oracle Directory Server

To configure the Authentication Repository dialog for Oracle Directory Server (formerly iPlanet and Sun Directory Server), use the following settings:

- Repository Name: Enter a suitable name for this user store.

- Directory Name: Click Add/Edit to add details of your Oracle Directory Server.

The User Search Conditions section instructs API Gateway to search the LDAP tree according to the following conditions:

- Base Criteria: Enter where API Gateway should begin searching the LDAP directory (for example, cn=Users, dc=qa, dc=vordel, dc=com).

- User Class: Enter or select the name given by the particular LDAP directory to the User class. For Oracle Directory Server, select 'inetorgperson' LDAP Class.

- User Search Attribute: The value entered depends on the type of LDAP directory to which you are connecting. When a user is stored in an LDAP directory, a number of user attributes are stored with that user. One of these attributes corresponds to the user name presented by the client for authentication. However, different LDAP directories use different names for that user attribute. For Oracle Directory Server, select cn from the drop-down list.

- Allow Blank Passwords: Select this to allow the use of blank passwords.

In the next section, you must specify the following:

- Login Authentication Attribute: In an LDAP directory tree, there must be one user attribute that uniquely distinguishes any one user from all the others. In Oracle Directory Server, the Distinguished name is referred to as the entrydn or Entry Domain Name. Select Entry Domain Name to uniquely identify the client authenticating to API Gateway.

- Authorization Attribute: When the client has been successfully authenticated, you can use any one of that user’s stored attributes in a subsequent authorization filter. In this case, you want to use the user’s Entry Domain Name (DName) for an authorization filter, so enter entrydn in the text box. However, you can enter any user attribute as long as the subsequent authorization filter supports it. The value of the LDAP attribute specified is stored in the authentication.subject.id message attribute.

- Authorization Attribute Format: Because any user attribute can be specified in the Authorization Attribute above, you must inform API Gateway of the type of this attribute. API Gateway uses this information internally in subsequent authorization filters. Select X.509 Distinguished Name from the drop-down list.

#### Microsoft Active Directory Server

This subsection describes how to configure the Authentication Repository dialog for Microsoft Active Directory Server. The values enter here differ from those entered when interfacing to the Oracle Directory Server:

- Repository Name: Enter a suitable name for this search.

- LDAP Directory: Click Add/Edit to add details of your Active Directory Server.

The User Search Conditions instruct API Gateway to search the LDAP tree according to certain criteria. The values specified are different from those selected for Oracle Directory Server, because MS Active Directory Server uses different attributes and classes to Oracle Directory Server:

- Base Criteria: The base criteria specify the base object under which to search for the user’s profile (for example, cn=Users, dc=qa, dc=vordel, dc=com).

- User Class: In Active Directory Server, the user class is called User, so select 'User' LDAP Class.

- User Search Attribute: This specifies the name of the user attribute whose value corresponds to the user name entered by the client during a successful authentication process. With Active Directory Server, this attribute is called givenName, which represents the name of the user. Enter givenName in this field.

- Login Authentication Attribute: Enter the name of the user attribute that uniquely identifies the user in the LDAP directory. This attribute is the DName and is called distinguishedName in Active Directory Server. Select Distinguished Name from the drop-down list to uniquely identify the user. API Gateway authenticates the user name and password presented by the client against the values stored for the user identified in this field.

- Authorization Attribute: When the client has been successfully authenticated, API Gateway can use any of that user’s stored attributes in subsequent authorization filters. Because most authorization filters require a DName, enter Distinguished Name in the text box. However, any user attribute could be entered here, as long as the subsequent authorization filter supports it.

- Authorization Attribute Format: API Gateway needs to know the format of the Authorization Attribute. Select X.509 Distinguished Name from the drop-down list.

#### IBM Directory Server

The configuration details for IBM Directory Server provide an example of a directory server that does not return a full DName as the result of a standard LDAP user search. Instead, it returns a contextualized DName, which is relative to the specified Base Criteria. In such cases, API Gateway can build up the full DName by combining the Base Criteria and the returned name. The following example shows how this works in practice.

If C=IE is specified as the Base Criteria, the IBM Directory Server returns CN=niall, OU=Dev, instead of the full DName, which is C=IE, CN=niall, OU=Dev. To enable API Gateway to do this, leave the Login Authentication Attribute field blank. API Gateway then automatically concatenates the specified Base Criteria (C=IE) with the contextualized DName returned from the directory server (CN=niall, OU=Dev) to obtain the fully qualified DName (C=IE, CN=niall, OU=Dev).

You can also leave the Authorization Attribute field blank to enable API Gateway to automatically use the fully qualified DName for subsequent authorization filters. You should select X.509 Distinguished Name from the Authorization Attribute Format drop-down list.

## Oracle Access Manager repositories

You can authorize an authenticated user for a particular resource against an Oracle Access Manager (OAM) repository. After successful authentication, OAM issues a Single Sign On (SSO) token, which can then be used instead of the user name and password.

To authenticate users against an OAM repository, right-click Oracle Access Manager Repositories, and select Add a new Repository. Configure the following fields on the Authentication Repository dialog:

- Repository Name: Enter an appropriate name for this repository.

- Resource Request: Configure the following settings for the resource request: Resource Type: Enter the type of the resource for which you are requesting access. For example, for access to a Web-based URL, enter http. Resource Name: Enter the name of the resource for which the user is requesting access. By default, this field is set to //hostname${http.request.uri}, which contains the original path requested by the client. Operation: In most access management products, users are authorized for a limited set of actions on the requested resource. For example, users with management roles may be permitted to write (HTTP POST) to a certain web service, but users with junior roles might only have read access (HTTP GET) to the same service. Use this field to specify the operation to which you want to grant the user access on the specified resource. By default, this is set to the http.request.verb message attribute, which contains the HTTP verb used by the client to send the message to API Gateway (for example, HTTP POST). Include query string: Select whether the query string parameters are used by the OAM server to determine the policy that protects this resource. This setting is optional if the policies configured do not rely on the query string parameters. Client location: If the client location must be passed to OAM for it to make its decision, you can enter a valid DNS name or IP address to specify this location. Optional Parameters: You can add optional additional parameters to be used in the authentication decision. The available optional parameters include the following: ip:IP address, in dotted decimal notation, of the client accessing the resource. operation: Operation attempted on the resource (for HTTP resources, one of GET, POST, PUT, HEAD, DELETE, TRACE, OPTIONS, CONNECT, or OTHER). resource: The requested resource identifier (for HTTP resources, the full URL). targethost: The host (host:port) to which resource request is sent. One or more of these optional parameters may be required by certain authentication schemes, modules, or plugins configured in the OAM server. To determine which parameters to add, see your OAM server configuration and documentation. Single Sign On: Configure the following settings for single sign on: Create SSO Token: Select whether to create an SSO token. This is selected by default. Store SSO Token in User Attribute: Enter the name of the message attribute that contains the user’s SSO token. This attribute is populated when authenticating to OAM using the HTTP Basic or HTTP Digest filter. By default, the SSO token is stored in the oracle.sso.token message attribute. Add SSO Token to User Attributes: Select whether to add the SSO Token to user message attributes. This is selected by default.

- OAM Access Server SDK Directory: Enter the path to your OAM Access Server SDK directory. For more details on the OAM Access Server SDK, see your OAM documentation.

## Oracle Entitlements Server 10g repositories

You can authenticate and authorize a user for a particular resource against an Oracle Entitlements Server (OES) 10g repository.

For example, API Gateway can extract credentials from the message sent by the client, and delegate authentication to OES 10g. When the client has been authenticated, API Gateway queries OES 10g to see if the client is permitted to access the web service resource. When authentication and authorization have passed, the message is trusted and forwarded to the target web service.

To authenticate and authorize users against an OES 10g repository, right-click Oracle Entitlements Server 10g Repositories, and select Add a new Repository. Configure the following fields on the Authentication Repository dialog:

- Repository Name: Enter an appropriate name for this repository.

- Oracle SSM Settings: Click Configure to launch the Oracle Security Service Module Settings dialog. For details on configuring these settings, see Configure Oracle Security Service Module settings (10g).

## RADIUS repositories

You can configure API Gateway to authenticate users in a Remote Authentication Dial In User Service (RADIUS) repository. RADIUS is a client-server network protocol that provides centralized authentication and authorization for clients connecting to remote services.

To authenticate users against a RADIUS repository, perform the following steps:

1. Right-click RADIUS Repositories, and select Add a new Repository.

2. In the Authentication Repository dialog, enter the RADIUS Repository Name.

3. On the Client tab, select the RADIUS clients that you wish to authenticate to the repository. For details on how to add clients to this list, see Configure RADIUS clients.

4. On the Attributes tab, click Add to add a RADIUS attribute. This is a name-value pair used to determine how access is granted. Examples include User-Name, User-Password, NAS-IP-Address, or NAS-Port).

5. In the RADIUS Attributes dialog, enter a Name for the attribute (for example, User-Name). You can select standard RADIUS attributes from the drop-down list, or enter a custom attribute.

6. Enter a Value for the attribute, and click OK.

7. Click OK in the Authentication Repository dialog when you have finished adding attributes.

## Tivoli repositories

API Gateway can integrate with Tivoli Access Manager to authenticate users. To authenticate users against a Tivoli repository, right-click Tivoli Repositories, and select Add a new Repository.

For more details on how to configure API Gateway to communicate with a Tivoli server, see the API Gateway Authentication and Authorization Integration Guide.

##### On this page

- Database repositories

- Entrust GetAccess repositories

- Local repositories

- LDAP repositories Authentication with LDAP Create an LDAP repository Oracle Directory Server Microsoft Active Directory Server IBM Directory Server

- Oracle Access Manager repositories

- Oracle Entitlements Server 10g repositories

- RADIUS repositories

- Tivoli repositories
