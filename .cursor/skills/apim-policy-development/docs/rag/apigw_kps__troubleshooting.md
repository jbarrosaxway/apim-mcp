---
title: "Troubleshoot KPS error messages"
source: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_kps/troubleshooting/index.html
scrapedAt: 2026-08-21T20:47:06.422Z
---

1 minute read

## All host polls marked down

This error means that the API Gateway client cannot connect to the Cassandra server.

To resolve this issue, perform the following steps:

- Check that all ports and addresses are correct in cassandra.yaml to verify that the endpoints are what you expect.

- Enable Cassandra debug logging.

- Contact your network administrator.

For more details on Cassandra configuration, see Administer Apache Cassandra.

##### On this page

- All host polls marked down
