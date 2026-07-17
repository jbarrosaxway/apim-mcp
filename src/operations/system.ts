/**
 * @module src/operations/system
 * @description This module contains operations (tools) that provide information
 * about the MCP system itself, rather than interacting with the Axway environment.
 */

import { AxwayApi } from '../api.js';

/**
 * Tool to get the current timestamp and timezone of the server where MCP is running.
 * Useful for sanity-checking the system and obtaining a reliable time reference.
 *
 * @returns An object containing date/time in different formats and the IANA timezone.
 */
export async function getMcpServerTime() {
  const now = new Date();
  
  // Intl.DateTimeFormat is used to get the IANA timezone name (e.g. 'America/Sao_Paulo').
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    iso_utc: now.toISOString(),
    human_readable_local: now.toLocaleString(),
    timezone: timeZone,
    note: "This is the current time of the server where the MCP (Model Context Protocol) is running."
  };
}

/**
 * Gets the API Manager configuration.
 * This tool calls the API Manager `/config` endpoint to retrieve
 * system configuration information, including global policies,
 * security settings, session limits, etc.
 *
 * @returns Promise<any> - The full API Manager configuration
 */
export async function getManagerConfig() {
  const api = new AxwayApi();
  const config = await api.getManagerConfig();
  
  return {
    message: "API Manager configuration retrieved successfully",
    configuration: config,
    curlExample: `curl '${process.env.AXWAY_MANAGER_URL}/config?request.preventCache=${Date.now()}' \\
  --compressed \\
  -H 'Accept: application/json' \\
  -H 'X-Requested-With: XMLHttpRequest' \\
  -H 'Authorization: Basic ${Buffer.from(`${process.env.AXWAY_MANAGER_USERNAME}:${process.env.AXWAY_MANAGER_PASSWORD}`).toString('base64')}'`,
    note: "This configuration includes global policies, security settings, session limits, and other system settings."
  };
} 