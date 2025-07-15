# Relatório de Progresso - Axway MCP Server

Este documento detalha o progresso da implementação das ferramentas para o `axway-mcp`, com base nas especificações OpenAPI `api-gateway-swagger.json` e `api-manager-V_1_4-oas3.json`.

---

## Funcionalidades Implementadas

As seguintes funcionalidades já foram implementadas e estão disponíveis como ferramentas no servidor.

### API Gateway (Admin Node Manager)

*   **Topology API**
    *   `list_topology`: Lista a topologia do API Gateway.
*   **Monitoring API**
    *   `get_instance_traffic`: Obtém métricas de tráfego para uma instância específica.
    *   `get_service_traffic`: Obtém métricas de tráfego para um serviço específico em uma instância.

### API Manager

*   **Organizations**
    *   `list_organizations`: Lista todas as organizações.
    *   `get_organization`: Obtém uma organização específica por ID.
    *   `create_organization`: Cria uma nova organização.
    *   `update_organization`: Atualiza uma organização existente.
    *   `delete_organization`: Deleta uma organização.
*   **Users**
    *   `list_users`: Lista todos os usuários.
    *   `get_user`: Obtém um usuário específico por ID.
    *   `create_user`: Cria um novo usuário.
    *   `update_user`: Atualiza um usuário existente.
    *   `delete_user`: Deleta um usuário.
*   **Applications**
    *   `list_applications`: Lista todas as aplicações.
    *   `get_application`: Obtém uma aplicação específica por ID.
    *   `get_api_keys_for_application`: Lista as chaves de API para uma aplicação.
    *   `create_api_key`: Cria uma nova chave de API para uma aplicação.
    *   `get_oauth_credentials_for_application`: Lista as credenciais OAuth para uma aplicação.
    *   `create_oauth_credential`: Cria uma nova credencial OAuth para uma aplicação.
    *   `get_permissions_for_application`: Obtém as permissões (ACL) para uma aplicação.
*   **API Proxies (Frontend APIs)**
    *   `list_api_proxies`: Lista todos os proxies de API.
    *   `get_api_proxy`: Obtém um proxy de API específico por ID.
    *   `create_api_proxy`: Cria um novo proxy de API.
    *   `update_api_proxy`: Atualiza um proxy de API existente.
    *   `delete_api_proxy`: Deleta um proxy de API.
*   **API Repository (Backend APIs)**
    *   `list_backend_apis`: Lista todas as APIs de backend.
    *   `import_backend_api_from_url`: Importa uma API de backend a partir de uma URL.
    *   `delete_backend_api`: Deleta uma API de backend.
*   **API Access**
    *   `list_api_access`: Lista o acesso à API para uma aplicação.
    *   `grant_api_access`: Concede acesso a uma API para uma aplicação.
    *   `revoke_api_access`: Revoga o acesso de uma aplicação a uma API.

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