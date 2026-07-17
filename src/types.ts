/**
 * @module src/types
 * @description Defines custom interfaces and data types used throughout the project.
 */

/**
 * Represents a related tool that can be suggested as a logical next step
 * after a primary tool has been executed.
 *
 * For example, after using `list_users`, a `RelatedTool` could be `get_user`,
 * pre-filled with the `id` of one of the users from the list.
 */
export interface RelatedTool {
    /**
     * The name of the tool to call; must match a registered tool.
     * @example "get_user_details"
     */
    tool_name: string;
    /**
     * A user-friendly description explaining why this tool is being suggested
     * and what it will do.
     * @example "Get details for user 'jdoe'"
     */
    description: string;
    /**
     * A list of pre-filled parameters for the suggested tool.
     * The goal is to make the user's next action easier by providing the required arguments.
     */
    parameters: {
        /**
         * The parameter name; must match one of the parameters expected by `tool_name`.
         * @example "userId"
         */
        name: string;
        /**
         * The suggested value for the parameter.
         * @example "801a61be-b924-40fd-ad64-77a339a695b7"
         */
        value: string;
    }[];
}
