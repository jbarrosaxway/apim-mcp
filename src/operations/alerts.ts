/**
 * @module src/operations/alerts
 * @description This module contains the operations (tools) for managing alert
 * configurations on the Axway API Gateway. Supports listing and updating which event types
 * should generate an alert.
 */

import { AxwayApi } from "../api.js";

/**
 * Tool to list the configuration of all alert triggers.
 *
 * This function does not list alerts that have already fired; it lists the configuration that
 * defines whether an event type (e.g. 'CircuitBreakerHalfOpen') is enabled
 * to generate an alert or not.
 *
 * @param api AxwayApi class instance.
 * @returns An object containing the alert configuration list and an explanatory summary.
 */
export async function listAlerts(api: AxwayApi) {
  try {
    const alertSettings = await api.listAlerts();
    const formattedSettings = Object.entries(alertSettings).map(([key, value]) => {
      return {
        event: key,
        isEnabled: value
      };
    });

    return {
      alertConfiguration: formattedSettings,
      summary: "This tool lists the configuration that defines which events will trigger an alert. It does not list alerts that have already fired.",
      relatedTools: [
        {
          tool_name: 'update_alert_settings',
          description: 'Enable or disable one or more alert triggers.',
          parameters: [
            { name: 'settings', value: '{"ServiceBody": true, "CertAboutToExpire": false}' }
          ]
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing alert configurations:`, error);
    throw error;
  }
}

/**
 * Tool to update the alert trigger configuration.
 *
 * @param api AxwayApi class instance.
 * @param settings A JSON object where each key is an alert event name
 *                 and the value is a boolean (`true` to enable, `false` to disable).
 *                 Example: `{"ServiceBody": true, "CertAboutToExpire": false}`
 * @returns An object confirming the update and showing the new configuration.
 */
export async function updateAlertSettings(api: AxwayApi, settings: any) {
  try {
    const updatedSettings = await api.updateAlertSettings(settings);
    const formattedSettings = Object.entries(updatedSettings).map(([key, value]) => {
      return {
        event: key,
        isEnabled: value
      };
    });
    return {
      message: "Alert settings updated successfully.",
      alertConfiguration: formattedSettings,
      relatedTools: [
        {
          tool_name: 'list_alerts',
          description: 'Verify the updated configuration of all alerts.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error updating alert configurations:`, error);
    throw error;
  }
} 