/**
 * @module src/api
 * @description Contains the `AxwayApi` class, a centralized wrapper for interacting
 * with the Axway API Gateway and Axway API Manager APIs.
 * It manages configuration, authentication, and execution of all API calls.
 */
import axios from "axios";
import { Buffer } from "buffer";
import * as https from "https";
import * as fs from "fs";
import FormData from "form-data";
import { promisify } from 'util';
import * as zlib from 'zlib';
const gunzip = promisify(zlib.gunzip);
/**
 * Resolves whether Axios should reject invalid TLS certificates when talking to Axway.
 *
 * Precedence:
 * 1. `AXWAY_TLS_INSECURE=true` → rejectUnauthorized=false
 * 2. `AXWAY_TLS_REJECT_UNAUTHORIZED=true|false`
 * 3. default → false (compatible with Axway installs that use a self-signed cert)
 */
function resolveAxwayTlsRejectUnauthorized() {
    const insecure = (process.env.AXWAY_TLS_INSECURE || "").toLowerCase();
    if (insecure === "true" || insecure === "1" || insecure === "yes") {
        return false;
    }
    const explicit = (process.env.AXWAY_TLS_REJECT_UNAUTHORIZED || "").toLowerCase();
    if (explicit === "true" || explicit === "1" || explicit === "yes") {
        return true;
    }
    if (explicit === "false" || explicit === "0" || explicit === "no") {
        return false;
    }
    return false;
}
/**
 * Encapsulates communication logic with Axway APIs.
 *
 * Configures two Axios instances:
 * - `apiGateway`: For the API Gateway management and monitoring API.
 * - `apiManager`: For the API Manager portal API.
 *
 * Configuration is read from environment variables.
 * The class also includes interceptors for centralized error handling.
 */
export class AxwayApi {
    apiGateway;
    apiManager;
    accessToken = null; // Reserved for future use (e.g. OAuth)
    /**
     * Initializes the API client instances for Gateway and Manager.
     *
     * - Reads URLs and credentials from environment variables (e.g. `AXWAY_GATEWAY_URL`).
     * - Configures Basic authentication for both instances.
     * - TLS validation is configurable via `AXWAY_TLS_REJECT_UNAUTHORIZED` / `AXWAY_TLS_INSECURE`
     *   (default: rejectUnauthorized=false, typical for Axway self-signed certs).
     * - Adds response interceptors to standardize API error handling.
     * - Emits console warnings if required environment variables are not set.
     */
    constructor() {
        const rejectUnauthorized = resolveAxwayTlsRejectUnauthorized();
        if (!rejectUnauthorized) {
            console.warn("[AxwayApi] TLS certificate verification is DISABLED " +
                "(AXWAY_TLS_REJECT_UNAUTHORIZED=false or AXWAY_TLS_INSECURE=true). " +
                "Use only with trusted networks / Axway self-signed certs.");
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized,
        });
        // API Gateway Configuration
        const gatewayUrl = process.env.AXWAY_GATEWAY_URL;
        const gatewayUsername = process.env.AXWAY_GATEWAY_USERNAME;
        const gatewayPassword = process.env.AXWAY_GATEWAY_PASSWORD;
        // API Manager Configuration
        const managerUrl = process.env.AXWAY_MANAGER_URL;
        const managerUsername = process.env.AXWAY_MANAGER_USERNAME;
        const managerPassword = process.env.AXWAY_MANAGER_PASSWORD;
        // Check for API Gateway variables
        if (!gatewayUrl || !gatewayUsername || !gatewayPassword) {
            console.error(`Warning: Missing API Gateway environment variables. Please set AXWAY_GATEWAY_URL, AXWAY_GATEWAY_USERNAME, and AXWAY_GATEWAY_PASSWORD.`);
            this.apiGateway = axios.create(); // Dummy instance
        }
        else {
            const gatewayAuthHeader = `Basic ${Buffer.from(`${gatewayUsername}:${gatewayPassword}`).toString("base64")}`;
            this.apiGateway = axios.create({
                baseURL: gatewayUrl,
                headers: {
                    "Authorization": gatewayAuthHeader,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                httpsAgent,
            });
        }
        // Check for API Manager variables
        if (!managerUrl || !managerUsername || !managerPassword) {
            console.error(`Warning: Missing API Manager environment variables. Please set AXWAY_MANAGER_URL, AXWAY_MANAGER_USERNAME, and AXWAY_MANAGER_PASSWORD.`);
            this.apiManager = axios.create(); // Dummy instance
        }
        else {
            const managerAuthHeader = `Basic ${Buffer.from(`${managerUsername}:${managerPassword}`).toString("base64")}`;
            this.apiManager = axios.create({
                baseURL: managerUrl,
                headers: {
                    "Authorization": managerAuthHeader,
                    "Accept": "application/json",
                },
                httpsAgent,
            });
        }
        // Add interceptors for logging/error handling to both instances
        [this.apiGateway, this.apiManager].forEach(instance => {
            if (instance.defaults.baseURL) { // Only add interceptors to properly configured instances
                instance.interceptors.response.use(response => {
                    return response;
                }, error => {
                    console.error("[MCP-ERROR] API request failed.");
                    if (error.response) {
                        const errorData = error.response.data;
                        let errorMessage = `API Error (Status ${error.response.status})`;
                        if (typeof errorData === 'object' && errorData !== null) {
                            const errorDetails = errorData.errors && errorData.errors[0] ? errorData.errors[0].message : (errorData.message || JSON.stringify(errorData));
                            errorMessage += `: ${errorDetails}`;
                        }
                        else if (typeof errorData === 'string') {
                            errorMessage += `: ${errorData.substring(0, 200)}`;
                        }
                        throw new Error(errorMessage);
                    }
                    else if (error.request) {
                        throw new Error("Network Error: No response received from the Axway API. Check your connection and the API endpoint configuration.");
                    }
                    else {
                        throw new Error(`Request Error: ${error.message}. Check your request parameters and try again.`);
                    }
                });
            }
        });
    }
    async logAndRequest(instance, config) {
        const { method, url, data } = config;
        console.log(`\n[AxwayApi] REQUEST: ${method?.toUpperCase()} ${instance.defaults.baseURL}${url}`);
        if (data) {
            console.log(`[AxwayApi] Request Body: ${JSON.stringify(data, null, 2)}`);
        }
        try {
            const response = await instance.request(config);
            console.log(`[AxwayApi] RESPONSE (${response.status}): ${JSON.stringify(response.data, null, 2)}`);
            return response;
        }
        catch (error) {
            if (error.response) {
                console.error(`[AxwayApi] ERROR RESPONSE (${error.response.status}): ${JSON.stringify(error.response.data, null, 2)}`);
            }
            else {
                console.error(`[AxwayApi] ERROR: ${error.message}`);
            }
            throw error;
        }
    }
    // Example usage for a GET method
    async getGateway(path, config) {
        return this.logAndRequest(this.apiGateway, { ...config, method: 'get', url: path });
    }
    // Example usage for a POST method
    async postGateway(path, data, config) {
        return this.logAndRequest(this.apiGateway, { ...config, method: 'post', url: path, data });
    }
    // --- Topology API methods ---
    /**
     * Gets the API Gateway domain topology, including groups and instances.
     * @returns A promise that resolves to the topology data.
     */
    async listTopology() {
        const response = await this.apiGateway.get("/topology");
        return response.data;
    }
    // --- Monitoring API methods ---
    /**
     * Gets a traffic summary for a specific API Gateway instance.
     * @param instanceId The API Gateway instance ID (e.g. 'instance-1').
     * @returns A promise that resolves to the traffic summary metrics.
     */
    async getInstanceTraffic(instanceId) {
        const response = await this.apiGateway.get(`/router/service/${instanceId}/api/monitoring/summary`);
        return response.data;
    }
    /**
     * Gets traffic metrics for a specific service on an API Gateway instance.
     * @param instanceId The instance ID.
     * @param serviceName The service name (e.g. 'Default Services').
     * @returns A promise that resolves to the service metrics.
     */
    async getServiceTraffic(instanceId, serviceName) {
        const encodedServiceName = encodeURIComponent(serviceName);
        const path = `/router/service/${instanceId}/api/monitoring/metrics/summary?metricGroupType=Service&name=${encodedServiceName}`;
        const response = await this.apiGateway.get(path);
        return response.data;
    }
    /**
     * Gets a metrics timeline for a specific instance.
     * @param instanceId The instance ID.
     * @param timeline The time window for the timeline (e.g. '10m', '1h').
     * @param metricTypes The metric types to retrieve (e.g. ['successes', 'failures']).
     * @returns A promise that resolves to the timeline data.
     */
    async getInstanceMetricsTimeline(instanceId, timeline, metricTypes) {
        const params = new URLSearchParams();
        params.append('timeline', timeline);
        metricTypes.forEach(metric => {
            params.append('metricType', metric);
        });
        const path = `/router/service/${instanceId}/api/monitoring/metrics/timeline?${params.toString()}`;
        const response = await this.apiGateway.get(path);
        return response.data;
    }
    /**
     * Searches for traffic events (transactions) on an instance.
     * @param instanceId The instance ID.
     * @param params A `URLSearchParams` object containing the search filters.
     * @returns A promise that resolves to the list of matching traffic events.
     */
    async searchTrafficEvents(instanceId, params) {
        const path = `/router/service/${instanceId}/ops/search?${params.toString()}`;
        const response = await this.apiGateway.get(path);
        return response.data;
    }
    /**
     * Gets details for a specific traffic event.
     * @param instanceId The instance ID.
     * @param protocol The transaction protocol (e.g. 'http').
     * @param correlationId The transaction correlation ID.
     * @param leg The transaction "leg" (segment), usually 0.
     * @param params Additional parameters, such as `includeHeaders`.
     * @returns A promise that resolves to the transaction details.
     */
    async getTrafficEventDetails(instanceId, protocol, correlationId, leg, params) {
        const path = `/router/service/${instanceId}/ops/${protocol}/${correlationId}/${leg}/getinfo?${params.toString()}`;
        const response = await this.apiGateway.get(path);
        return response.data;
    }
    /**
     * Gets the payload of a transaction.
     * @param instanceId The instance ID.
     * @param correlationId The transaction correlation ID.
     * @param leg The transaction "leg".
     * @param direction Payload direction ('received' from client, 'sent' to client).
     * @returns A promise that resolves to the payload content as text.
     */
    async getTrafficEventPayload(instanceId, correlationId, leg, direction) {
        const path = `/router/service/${instanceId}/ops/stream/${correlationId}/${leg}/${direction}`;
        const response = await this.apiGateway.get(path, { responseType: 'text' });
        return response.data;
    }
    /**
     * Gets trace data for a transaction.
     * @param instanceId The instance ID.
     * @param correlationId The transaction correlation ID.
     * @param params Additional parameters, such as `includeSentData`.
     * @returns A promise that resolves to the trace data.
     */
    async getTrafficEventTrace(instanceId, correlationId, params) {
        const path = `/router/service/${instanceId}/ops/trace/${correlationId}?${params.toString()}`;
        const response = await this.apiGateway.get(path);
        return response.data;
    }
    // --- API Manager methods (Organizations) ---
    /**
     * Lists all organizations in the API Manager.
     * @returns A promise that resolves to the list of organizations.
     */
    async listOrganizations() {
        const response = await this.apiManager.get('/organizations');
        return response.data;
    }
    /**
     * Gets a specific organization by ID.
     * @param id The organization ID.
     * @returns A promise that resolves to the organization data.
     */
    async getOrganization(id) {
        const response = await this.apiManager.get(`/organizations/${id}`);
        return response.data;
    }
    /**
     * Creates a new organization.
     * @param organizationData An object containing the new organization data (name, description, etc.).
     * @returns A promise that resolves to the created organization data.
     */
    async createOrganization(organizationData) {
        const response = await this.apiManager.post('/organizations', organizationData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Updates an existing organization.
     * @param id The ID of the organization to update.
     * @param organizationData An object with the fields to update.
     * @returns A promise that resolves to the updated organization data.
     */
    async updateOrganization(id, organizationData) {
        const response = await this.apiManager.put(`/organizations/${id}`, organizationData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Deletes an organization by ID.
     * @param id The ID of the organization to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteOrganization(id) {
        const response = await this.apiManager.delete(`/organizations/${id}`);
        return response.data;
    }
    // --- API Manager methods (Users) ---
    /**
     * Lists all users.
     * @returns A promise that resolves to the list of users.
     */
    async listUsers() {
        const response = await this.apiManager.get('/users');
        return response.data;
    }
    /**
     * Gets a specific user by ID.
     * @param id The user ID.
     * @returns A promise that resolves to the user data.
     */
    async getUser(id) {
        const response = await this.apiManager.get(`/users/${id}`);
        return response.data;
    }
    /**
     * Creates a new user.
     * @param userData An object containing the new user data.
     * @returns A promise that resolves to the created user data.
     */
    async createUser(userData) {
        const response = await this.apiManager.post('/users', userData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Updates an existing user.
     * @param id The ID of the user to update.
     * @param userData An object with the fields to update.
     * @returns A promise that resolves to the updated user data.
     */
    async updateUser(id, userData) {
        const response = await this.apiManager.put(`/users/${id}`, userData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Deletes a user by ID.
     * @param id The ID of the user to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteUser(id) {
        const response = await this.apiManager.delete(`/users/${id}`);
        return response.data;
    }
    // --- API Manager methods (Applications) ---
    /**
     * Lists all applications visible to the authenticated user.
     * @returns A promise that resolves to the list of applications.
     */
    async listApplications() {
        const response = await this.apiManager.get('/applications');
        return response.data;
    }
    /**
     * Gets a specific application by ID.
     * @param id The application ID.
     * @returns A promise that resolves to the application data.
     */
    async getApplication(id) {
        const response = await this.apiManager.get(`/applications/${id}`);
        return response.data;
    }
    /**
     * Gets the API keys associated with an application.
     * @param id The application ID.
     * @returns A promise that resolves to the list of API keys.
     */
    async getApiKeysForApplication(id) {
        const response = await this.apiManager.get(`/applications/${id}/apikeys`);
        return response.data;
    }
    /**
     * Gets the OAuth credentials associated with an application.
     * @param id The application ID.
     * @returns A promise that resolves to the OAuth credentials.
     */
    async getOAuthCredentialsForApplication(id) {
        const response = await this.apiManager.get(`/applications/${id}/oauth`);
        return response.data;
    }
    /**
     * Creates a new API key for an application.
     * @param appId The application ID.
     * @param apiKeyData Data for the new API key (e.g. secret, 'enabled' state).
     * @returns A promise that resolves to the created API key data.
     */
    async createApiKey(appId, apiKeyData) {
        const response = await this.apiManager.post(`/applications/${appId}/apikeys`, apiKeyData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Creates a new OAuth credential (client ID and secret) for an application.
     * @param appId The application ID.
     * @param credentialData Data for the new credential (e.g. redirect URIs).
     * @returns A promise that resolves to the created credential.
     */
    async createOAuthCredential(appId, credentialData) {
        const response = await this.apiManager.post(`/applications/${appId}/oauth`, credentialData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Gets the permission list (ACL) for an application.
     * @param id The application ID.
     * @returns A promise that resolves to the list of permissions.
     */
    async getPermissionsForApplication(id) {
        const response = await this.apiManager.get(`/applications/${id}/permissions`);
        return response.data;
    }
    // --- API Manager methods (API Proxies) ---
    /**
     * Lists all API proxies (frontend APIs).
     * @returns A promise that resolves to the list of proxies.
     */
    async listApiProxies() {
        const response = await this.apiManager.get('/proxies');
        return response.data;
    }
    /**
     * Gets a specific API proxy by ID.
     * @param id The proxy ID.
     * @returns A promise that resolves to the proxy data.
     */
    async getApiProxy(id) {
        const response = await this.apiManager.get(`/proxies/${id}`);
        return response.data;
    }
    /**
     * Creates a new API proxy.
     * @param proxyData Data for the new proxy (name, path, backend API ID, etc.).
     * @returns A promise that resolves to the created proxy data.
     */
    async createApiProxy(proxyData) {
        const response = await this.apiManager.post('/proxies', proxyData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Updates an existing API proxy.
     * @param id The ID of the proxy to update.
     * @param proxyData An object with the fields to update.
     * @returns A promise that resolves to the updated proxy data.
     */
    async updateApiProxy(id, proxyData) {
        const response = await this.apiManager.put(`/proxies/${id}`, proxyData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Deletes an API proxy by ID.
     * @param id The ID of the proxy to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteApiProxy(id) {
        const response = await this.apiManager.delete(`/proxies/${id}`);
        return response.data;
    }
    /**
     * Publishes an API proxy, making it available for consumption.
     * @param id The ID of the API to publish.
     * @returns A promise that resolves when the API is published.
     */
    async publishApi(id) {
        const response = await this.apiManager.post(`/proxies/${id}/publish`, new URLSearchParams(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        return response.data;
    }
    /**
     * Unpublishes an API proxy, making it unavailable.
     * @param id The ID of the API to unpublish.
     * @returns A promise that resolves when the API is unpublished.
     */
    async unpublishApi(id) {
        const response = await this.apiManager.post(`/proxies/${id}/unpublish`, new URLSearchParams(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        return response.data;
    }
    /**
     * Marks an API proxy as deprecated.
     * @param id The ID of the API to mark as deprecated.
     * @returns A promise that resolves when the API is marked as deprecated.
     */
    async deprecateApi(id) {
        const payload = { "state": "deprecated" };
        const response = await this.apiManager.post(`/proxies/${id}/state`, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
    }
    // --- API Manager methods (Backend API Repository) ---
    /**
     * Lists all backend APIs in the repository.
     * @returns A promise that resolves to the list of backend APIs.
     */
    async listBackendApis() {
        const response = await this.apiManager.get('/apirepo');
        return response.data;
    }
    /**
     * Imports a backend API from a URL (e.g. Swagger/OpenAPI).
     * @param url The API definition URL.
     * @param organizationId The ID of the organization that will own the API.
     * @param name An optional custom name for the backend API.
     * @returns A promise that resolves to the imported API data.
     */
    async importBackendApiFromUrl(url, organizationId, name) {
        const form = new FormData();
        form.append('type', 'url');
        form.append('url', url);
        form.append('organizationId', organizationId);
        if (name) {
            form.append('name', name);
        }
        const response = await this.apiManager.post('/apirepo/import', form, { headers: form.getHeaders() });
        return response.data;
    }
    /**
     * Imports a backend API from a local file.
     * @param filePath Path to the API definition file (e.g. swagger.json).
     * @param organizationId The ID of the organization that will own the API.
     * @param name An optional custom name for the backend API.
     * @returns A promise that resolves to the imported API data.
     */
    async importBackendApiFromFile(filePath, organizationId, name) {
        const form = new FormData();
        form.append('type', 'file');
        form.append('file', fs.createReadStream(filePath));
        form.append('organizationId', organizationId);
        if (name) {
            form.append('name', name);
        }
        const response = await this.apiManager.post('/apirepo/import', form, { headers: form.getHeaders() });
        return response.data;
    }
    /**
     * Deletes a backend API from the repository.
     * @param id The ID of the backend API to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteBackendApi(id) {
        const response = await this.apiManager.delete(`/apirepo/${id}`);
        return response.data;
    }
    // --- API Manager methods (Access Control) ---
    /**
     * Lists all frontend APIs that an application has access to.
     * @param applicationId The application ID.
     * @returns A promise that resolves to the list of APIs with access.
     */
    async listApiAccess(applicationId) {
        const response = await this.apiManager.get(`/applications/${applicationId}/apis`);
        return response.data;
    }
    /**
     * Grants an application access to a frontend API.
     * @param applicationId The application ID.
     * @param apiId The frontend API proxy ID to grant access to.
     * @returns A promise that resolves when access is granted.
     */
    async grantApiAccess(applicationId, apiId) {
        const payload = {
            apiId: apiId,
            enabled: true,
        };
        const response = await this.apiManager.post(`/applications/${applicationId}/apis`, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
    }
    /**
     * Revokes an application's access to a frontend API.
     * @param applicationId The application ID.
     * @param apiId The API proxy ID from which access will be revoked.
     * @returns A promise that resolves when access is revoked.
     */
    async revokeApiAccess(applicationId, apiId) {
        const response = await this.apiManager.delete(`/applications/${applicationId}/apis/${apiId}`);
        return response.data;
    }
    // --- Other methods ---
    /**
     * Lists the configuration of which events trigger alerts.
     * @returns A promise that resolves to the alert configuration.
     */
    async listAlerts() {
        const response = await this.apiGateway.get('/alerts');
        return response.data;
    }
    /**
     * Updates the alert trigger configuration.
     * @param settings An object where keys are alert names and values are booleans.
     * @returns A promise that resolves when the configuration is updated.
     */
    async updateAlertSettings(settings) {
        const response = await this.apiGateway.put('/alerts', settings, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Gets application quotas (system or custom).
     * @param applicationId The application ID.
     * @returns A promise that resolves to the application quota configuration.
     */
    async getApplicationQuotas(applicationId) {
        const response = await this.apiManager.get(`/quotas/applications/${applicationId}`);
        return response.data;
    }
    /**
     * Updates quotas for a specific application.
     * @param applicationId The application ID.
     * @param quotaData The quota object to apply.
     * @returns A promise that resolves when the quotas are updated.
     */
    async updateApplicationQuotas(applicationId, quotaData) {
        const response = await this.apiManager.put(`/quotas/applications/${applicationId}`, quotaData, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    /**
     * Gets a summary report for application or API metrics.
     * @param params Parameters to filter the metrics report.
     * @returns A promise that resolves to the report data.
     */
    async getMetrics({ type, level, from, to, client, service, method, organization, reportsubtype }) {
        const params = new URLSearchParams({
            type,
            level: level.toString(),
            from,
            to,
        });
        if (reportsubtype)
            params.append('reportsubtype', reportsubtype);
        if (client)
            client.forEach((c) => params.append('client', c));
        if (service)
            service.forEach((s) => params.append('service', s));
        if (method)
            params.append('method', method);
        if (organization)
            params.append('organization', organization);
        const path = `/reports?${params.toString()}`;
        const response = await this.apiManager.get(path);
        return response.data;
    }
    /**
     * Gets the API Manager configuration.
     * This operation calls the API Manager `/config` endpoint to retrieve
     * system configuration information, including global policies,
     * security settings, session limits, etc.
     *
     * @returns Promise<any> - The full API Manager configuration
     */
    async getManagerConfig() {
        try {
            const timestamp = Date.now();
            const params = new URLSearchParams();
            params.append('request.preventCache', timestamp.toString());
            const response = await this.logAndRequest(this.apiManager, {
                method: 'GET',
                url: `/config?${params.toString()}`,
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            // Return only the response data, not the full response object
            return response.data;
        }
        catch (error) {
            console.error('Error getting API Manager configuration:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=api.js.map