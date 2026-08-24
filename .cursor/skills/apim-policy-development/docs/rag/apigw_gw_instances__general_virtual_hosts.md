---
title: "Configure virtual hosts"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_gw_instances/general_virtual_hosts/index.html
scrapedAt: 2026-08-21T20:45:10.113Z
---

4 minute read

A virtual host is a server, or pool of servers, that can host multiple domain names (for example, company1.api.example.com and company2.api.example.com). This enables you to run more than one website, or set of REST APIs, on a single host machine (for example, 192.0.2.11). Each domain name can have its own host name, paths, APIs, and so on. For example:

```

https://company1.api.example.com:8080/api/v1/test
https://company2.api.example.com:8080/api/v2/test
https://company3.api.example.com:8080/api/v2/test

```

The API Gateway implements name-based virtual hosting, in which the client HTTP Host header is used as the routing criteria during path resolution (for example, Host company1.api.example.com). This means that you can have multiple domains running on the same hardware (IP address), while this is not apparent to the client or end user.

For example, the following URL invokes the company2.api.example.com virtual host:

```

https:/company2.api.example.com/api/v1/test

```

This results in the following message at runtime:

```

POST /api/v1/test HTTP/1.1
Host:company2.api.example.com
Content-Type:application/x-www-form-urlencoded
client_id=SampleConfidentialApp&client_secret=......

```

##### Note

## Configure virtual hosts for HTTP services

You can configure virtual hosts at the HTTP service level. This means that these settings are applied to the HTTP service and to any child resolvers. To configure a virtual host at the HTTP service level, perform the following steps:

1. In the Policy Studio tree, select an HTTP service (for example, Environment Configuration > Listeners > API Gateway > Default Services > Virtual Hosts).

2. Right-click, and select Add a Virtual Host.

3. Configure the following settings in the Virtual Host dialog: Name: Enter a unique name of the virtual host. Enabled: Select whether the virtual host processing is enabled. This is enabled by default. Hosts: Specify the list of domains that you wish to host under this HTTP service. To add a host, click Add at the bottom right, and enter the domain name (for example company1.api.example.com). You can also specify domain names using wildcards already configured in your DNS (for example *.example.com:/8080 or company3.api.example.com.*).

### Configure multiple traffic ports

If a virtual host (global default, organization level, or for a published API) is set to myhost and there are multiple traffic ports (mix of HTTP and HTTPS) configured, API Manager correctly displays https://myhost and http://myhost as base path URLs in the API Catalog. You can set myhost with multiple traffic ports, one enabled and one disabled, and the API Catalog will correctly display the base URLs.

### Configure child resolvers

When you have configured a virtual host at the HTTP service level, you can also configure the following child resolvers:

- Relative path

- Static content provider

- Static file provider

- Servlet application

To configure a child resolver, perform the following steps:

1. In the Policy Studio tree, select the Paths node under the virtual host, and right-click to add a resolver (for example, Add relative path).

2. In the Resolve path to policies dialog, click the browse button beside the Path Specific Policy field, and select a policy to run on this path.

For example, if an inbound request to /Healthcheck matches on company1.api.*, the Company1 Health Check policy is executed. Otherwise, the global Health Check policy for the HTTP service is executed (in this case, Default Services).

## Configure virtual hosts for REST APIs

When API Manager has been installed, you can also configure virtual hosts for specific REST APIs. By default, the HTTP service-level profile is used, but you can override the virtual host at the REST API level.

For example, when adding a new REST API in the New Rest API dialog, you can specify virtual hosts on the Exposure tab. In the Virtual Host field, click the browse button to select a virtual host in the dialog.

##### Tip

In addition, when editing an existing REST API, you can also specify a virtual host in the Edit Rest API dialog.

Finally, when the API has been created, you can view it in the Resolver screen for its virtual host. The following shows a simple Flickr API example:

##### On this page

- Configure virtual hosts for HTTP services Configure multiple traffic ports Configure child resolvers

- Configure virtual hosts for REST APIs
