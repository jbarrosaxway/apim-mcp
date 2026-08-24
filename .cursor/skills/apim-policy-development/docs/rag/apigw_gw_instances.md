---
title: "Configure API Gateway instances and listeners"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_gw_instances/index.html
scrapedAt: 2026-08-21T20:45:01.446Z
---

2 minute read

A single running instance of API Gateway enables you to configure at least two interfaces: one for public traffic, and a second for listening for and serving configuration data. The configuration interface should rarely need to be updated. However, you might need to add several HTTP interfaces. For example, an HTTP interface and an SSL-enabled HTTPS interface.

Furthermore, you can add features such as the following at the API Gateway instance level:

- Remote hosts to control connection settings to a server

- SMTP interfaces to configure email relay

- File transfer services for FTP, FTPS, and SFTP

- Policy execution schedulers to run policies at regular time intervals

- JMS listeners to listen for JMS messages

- Packet sniffers to inspect packets at the network level for logging and monitoring

- FTP pollers to retrieve files to be processed by polling a remote file server

- Directory scanners to scan messages dumped to the file system

Because API Gateway can read messages from HTTP, SMTP, FTP, JMS, or a directory, this enables it to perform protocol translation. For example, API Gateway can read a message from a JMS queue, and then route it on over HTTP to a web service. Similarly, API Gateway can read XML messages that have been put into a directory on the file system using FTP, and send them to a JMS messaging system, or route them over HTTP to a back-end system.

---

##### Configure HTTP services

Configure HTTP services groups, HTTP/S interfaces, packet sniffers, and Management services.

##### Configure relative paths

Configure relative path resolvers to invoke a policy when a request arrives on a specific path.

##### Configure remote host settings

Configure the way in which API Gateway connects to a specific external server or routing destination.

##### Configure virtual hosts

Configure virtual hosts for HTTP services or REST APIs.

##### Configure WebSocket connections

Configure API Gateway to act as a WebSocket proxy.

##### Configure SMTP services

Configure API Gateway to receive email and to act as a mail relay.

##### Configure a file transfer service

Configure API Gateway to act as a file transfer service.

##### Configure an FTP poller

Use API Gateway to poll a remote file server, to query and retrieve files to be processed.

##### Configure a directory scanner

Scan a specified directory on the file system for files containing messages.

##### Configure a POP client

Poll a POP mail server and read email messages from it.

##### Configure Amazon SQS queue listener

Configure API Gateway to poll an Amazon SQS queue.

##### Cryptographic acceleration

Configure API Gateway to use an OpenSSL engine for cryptographic acceleration.

##### Configure Cross-Origin Resource Sharing

Add a CORS profile, and configure CORS for HTTP services or relative paths.

##### Compressed content encoding

Configure input and output content encodings globally, per remote host, or per listening interface.

##### Configure HTTP Strict Transport Security

Create an HSTP profile and configure it for HTTP services.
