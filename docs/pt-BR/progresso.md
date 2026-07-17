# Relatório de Progresso — Axway MCP Server

Languages: [English](../en/progress.md) | [Português (Brasil)](progresso.md)

Este documento detalha o progresso da implementação das ferramentas para o `axway-mcp`, com base nas especificações OpenAPI `api-gateway-swagger.json` e `api-manager-V_1_4-oas3.json`.

Os nomes das tools seguem a convenção Axway MCP `axway_apim_<resource>_<action>`.

---

## Funcionalidades Implementadas

As seguintes funcionalidades já foram implementadas e estão disponíveis como ferramentas no servidor.

### API Gateway (Admin Node Manager)

*   **Topology API**
    *   `axway_apim_topology_list`: Lista a topologia do API Gateway.
*   **Monitoring API**
    *   `axway_apim_instancetraffic_get`: Obtém métricas de tráfego para uma instância específica.
    *   `axway_apim_servicetraffic_get`: Obtém métricas de tráfego para um serviço específico em uma instância.

### API Manager

*   **Organizations**
    *   `axway_apim_organization_list`: Lista todas as organizações.
    *   `axway_apim_organization_get`: Obtém uma organização específica por ID.
    *   `axway_apim_organization_create`: Cria uma nova organização.
    *   `axway_apim_organization_update`: Atualiza uma organização existente.
    *   `axway_apim_organization_delete`: Deleta uma organização.
*   **Users**
    *   `axway_apim_user_list`: Lista todos os usuários.
    *   `axway_apim_user_get`: Obtém um usuário específico por ID.
    *   `axway_apim_user_create`: Cria um novo usuário.
    *   `axway_apim_user_update`: Atualiza um usuário existente.
    *   `axway_apim_user_delete`: Deleta um usuário.
*   **Applications**
    *   `axway_apim_application_list`: Lista todas as aplicações.
    *   `axway_apim_application_get`: Obtém uma aplicação específica por ID.
    *   `axway_apim_apikey_get`: Lista as chaves de API para uma aplicação.
    *   `axway_apim_apikey_create`: Cria uma nova chave de API para uma aplicação.
    *   `axway_apim_oauth_get`: Lista as credenciais OAuth para uma aplicação.
    *   `axway_apim_oauth_create`: Cria uma nova credencial OAuth para uma aplicação.
    *   `axway_apim_permission_get`: Obtém as permissões (ACL) para uma aplicação.
*   **API Proxies (Frontend APIs)**
    *   `axway_apim_proxy_list`: Lista todos os proxies de API.
    *   `axway_apim_proxy_get`: Obtém um proxy de API específico por ID.
    *   `axway_apim_proxy_create`: Cria um novo proxy de API.
    *   `axway_apim_proxy_update`: Atualiza um proxy de API existente.
    *   `axway_apim_proxy_delete`: Deleta um proxy de API.
*   **API Repository (Backend APIs)**
    *   `axway_apim_backend_list`: Lista todas as APIs de backend.
    *   `axway_apim_backend_submit`: Importa uma API de backend a partir de uma URL.
    *   `axway_apim_backend_delete`: Deleta uma API de backend.
*   **API Access**
    *   `axway_apim_access_list`: Lista o acesso à API para uma aplicação.
    *   `axway_apim_access_update`: Concede acesso a uma API para uma aplicação.
    *   `axway_apim_access_delete`: Revoga o acesso de uma aplicação a uma API.

---

## Funcionalidades Pendentes

Abaixo está uma lista de grupos de funcionalidades que ainda precisam ser implementados, com base na análise dos arquivos Swagger.

### API Gateway (Admin Node Manager)

*   **AMA API**: Gerenciamento de filas e tópicos.
*   **Admin Users API**: Gerenciamento de usuários administradores.
*   **Configuration API**: Gerenciamento de configurações.
*   **Deployment API**: Deploy de configurações.
*   **Web Service Discovery**: Descoberta de Web Services.
*   **Domain Audit API**: Auditoria de domínio.
*   **Management API**: Gerenciamento geral.
*   **Role Based Access Control (RBAC)**: Gerenciamento de papéis e permissões.
*   **Analytics**: Acesso a dados de analytics.
*   **KPS API**: Gerenciamento de Key Property Stores.

### API Manager

*   **Alerts**: Gerenciamento de alertas.
*   **API Catalog**: Gerenciamento do catálogo de APIs.
*   **Quotas**: Gerenciamento de cotas de aplicação.
*   **Metrics**: Métricas de API (além do que já foi implementado).
*   **Application Requests**: Gerenciamento de solicitações de novas aplicações.
*   **API Access Requests**: Gerenciamento de solicitações de acesso a APIs.
*   **Security Profiles**: Gerenciamento de perfis de segurança.
*   **Policies**: Gerenciamento de políticas.

A implementação continuará seguindo a ordem lógica dos grupos de funcionalidades ou conforme priorizado.
