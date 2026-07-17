# Progress Report — Axway MCP Server

Languages: [English](progress.md) | [Português (Brasil)](../pt-BR/progresso.md)

This document details the implementation progress of tools for `axway-mcp`, based on the OpenAPI specs `api-gateway-swagger.json` and `api-manager-V_1_4-oas3.json`.

Tool names follow the Axway MCP convention `axway_apim_<resource>_<action>`.

---

## Implemented features

The following features are implemented and available as tools on the server.

### API Gateway (Admin Node Manager)

*   **Topology API**
    *   `axway_apim_topology_list`: Lists the API Gateway topology.
*   **Monitoring API**
    *   `axway_apim_instancetraffic_get`: Gets traffic metrics for a specific instance.
    *   `axway_apim_servicetraffic_get`: Gets traffic metrics for a specific service on an instance.

### API Manager

*   **Organizations**
    *   `axway_apim_organization_list`: Lists all organizations.
    *   `axway_apim_organization_get`: Gets a specific organization by ID.
    *   `axway_apim_organization_create`: Creates a new organization.
    *   `axway_apim_organization_update`: Updates an existing organization.
    *   `axway_apim_organization_delete`: Deletes an organization.
*   **Users**
    *   `axway_apim_user_list`: Lists all users.
    *   `axway_apim_user_get`: Gets a specific user by ID.
    *   `axway_apim_user_create`: Creates a new user.
    *   `axway_apim_user_update`: Updates an existing user.
    *   `axway_apim_user_delete`: Deletes a user.
*   **Applications**
    *   `axway_apim_application_list`: Lists all applications.
    *   `axway_apim_application_get`: Gets a specific application by ID.
    *   `axway_apim_apikey_get`: Lists API keys for an application.
    *   `axway_apim_apikey_create`: Creates a new API key for an application.
    *   `axway_apim_oauth_get`: Lists OAuth credentials for an application.
    *   `axway_apim_oauth_create`: Creates a new OAuth credential for an application.
    *   `axway_apim_permission_get`: Gets permissions (ACL) for an application.
*   **API Proxies (Frontend APIs)**
    *   `axway_apim_proxy_list`: Lists all API proxies.
    *   `axway_apim_proxy_get`: Gets a specific API proxy by ID.
    *   `axway_apim_proxy_create`: Creates a new API proxy.
    *   `axway_apim_proxy_update`: Updates an existing API proxy.
    *   `axway_apim_proxy_delete`: Deletes an API proxy.
*   **API Repository (Backend APIs)**
    *   `axway_apim_backend_list`: Lists all backend APIs.
    *   `axway_apim_backend_submit`: Imports a backend API from a URL.
    *   `axway_apim_backend_delete`: Deletes a backend API.
*   **API Access**
    *   `axway_apim_access_list`: Lists API access for an application.
    *   `axway_apim_access_update`: Grants API access to an application.
    *   `axway_apim_access_delete`: Revokes an application's access to an API.

---

## Pending features

Below is a list of feature groups that still need to be implemented, based on analysis of the Swagger files.

### API Gateway (Admin Node Manager)

*   **AMA API**: Queue and topic management.
*   **Admin Users API**: Administrator user management.
*   **Configuration API**: Configuration management.
*   **Deployment API**: Configuration deployment.
*   **Web Service Discovery**: Web Service discovery.
*   **Domain Audit API**: Domain audit.
*   **Management API**: General management.
*   **Role Based Access Control (RBAC)**: Role and permission management.
*   **Analytics**: Analytics data access.
*   **KPS API**: Key Property Store management.

### API Manager

*   **Alerts**: Alert management.
*   **API Catalog**: API catalog management.
*   **Quotas**: Application quota management.
*   **Metrics**: API metrics (beyond what is already implemented).
*   **Application Requests**: New application request management.
*   **API Access Requests**: API access request management.
*   **Security Profiles**: Security profile management.
*   **Policies**: Policy management.

Implementation will continue following the logical order of feature groups or as prioritized.
