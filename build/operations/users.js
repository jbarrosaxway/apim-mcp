/**
 * @module src/operations/users
 * @description This module contains the operations (tools) for managing
 * full (CRUD) Users in the Axway API Manager.
 */
import { removeEmptyValues } from "../utils.js";
/**
 * Transforms the raw API user object into a cleaner, more consistent format.
 * @param user The raw user object.
 * @returns A formatted user object.
 * @internal
 */
function transformUser(user) {
    return {
        userId: user.id,
        name: user.name,
        loginName: user.loginName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEnabled: user.enabled,
        organizationId: user.organizationId,
        metadata: {
            createdAt: new Date(user.createdOn).toISOString(),
        }
    };
}
/**
 * Tool to list all users.
 * @param api AxwayApi class instance.
 * @returns An object containing the list of users.
 */
export async function listUsers(api) {
    try {
        const rawUsers = await api.listUsers();
        if (!Array.isArray(rawUsers)) {
            throw new Error("The API response for listing users was not an array as expected.");
        }
        const users = rawUsers.map(transformUser);
        return {
            count: users.length,
            users: users,
            message: `Found ${users.length} users.`,
            relatedTools: [
                ...users.map((user) => ({
                    tool_name: 'get_user',
                    description: `Get details for user '${user.name}'.`,
                    parameters: [{ name: 'id', value: user.userId }]
                })),
                {
                    tool_name: 'create_user',
                    description: 'Create a new user.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error listing users:`, error);
        throw error;
    }
}
/**
 * Tool to get details for a specific user by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the user to retrieve.
 * @returns An object containing the user details.
 */
export async function getUser(api, id) {
    try {
        const rawUser = await api.getUser(id);
        const user = transformUser(rawUser);
        return {
            user: user,
            relatedTools: [
                {
                    tool_name: 'update_user',
                    description: `Update details for user '${user.name}'.`,
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'delete_user',
                    description: `Delete user '${user.name}'.`,
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'get_organization',
                    description: `View details of the organization (ID: ${user.organizationId}) this user belongs to.`,
                    parameters: [{ name: 'id', value: user.organizationId }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting user ${id}:`, error);
        throw error;
    }
}
/**
 * Tool to create a new user.
 * @param api AxwayApi class instance.
 * @param organizationId The ID of the organization the user will belong to.
 * @param name The user's full name.
 * @param loginName The login name for the user.
 * @param role The user role (e.g. 'user' or 'admin').
 * @param email (Optional) The user contact email.
 * @param phone (Optional) The user contact phone.
 * @returns A confirmation object with the created user details.
 */
export async function createUser(api, organizationId, name, loginName, role, email, phone) {
    try {
        const newUser = await api.createUser({ organizationId, name, loginName, role, email, phone });
        return {
            message: `User '${newUser.loginName}' created successfully.`,
            user: transformUser(newUser),
            relatedTools: [
                {
                    tool_name: 'list_users',
                    description: 'View all users, including the newly created one.',
                    parameters: []
                },
                {
                    tool_name: 'get_user',
                    description: `View full details for user '${newUser.loginName}'.`,
                    parameters: [{ name: 'id', value: newUser.id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error creating user:`, error);
        throw error;
    }
}
/**
 * Tool to update an existing user. Only the provided fields will be changed.
 * @param api AxwayApi class instance.
 * @param id The ID of the user to update.
 * @param name (Optional) The new full name.
 * @param loginName (Optional) The new login name.
 * @param email (Optional) The new email.
 * @param phone (Optional) The new phone.
 * @param role (Optional) The new role ('user' or 'admin').
 * @param enabled (Optional) The new enabled state.
 * @param organizationId (Optional) The new organization ID.
 * @returns A confirmation object with the updated user details.
 */
export async function updateUser(api, id, name, loginName, email, phone, role, enabled, organizationId) {
    try {
        const payload = removeEmptyValues({ name, loginName, email, phone, role, enabled, organizationId });
        if (Object.keys(payload).length === 0) {
            return { message: "No fields provided for update. No action was taken." };
        }
        const updatedUser = await api.updateUser(id, payload);
        return {
            message: `User '${updatedUser.loginName}' updated successfully.`,
            user: transformUser(updatedUser),
            relatedTools: [
                {
                    tool_name: 'get_user',
                    description: 'View the updated user details.',
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error updating user ${id}:`, error);
        throw error;
    }
}
/**
 * Tool to delete a user by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the user to delete.
 * @returns A confirmation object for the deletion.
 */
export async function deleteUser(api, id) {
    try {
        await api.deleteUser(id);
        return {
            message: `User with ID '${id}' was deleted successfully.`,
            relatedTools: [
                {
                    tool_name: 'list_users',
                    description: 'List remaining users to confirm the deletion.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error deleting user ${id}:`, error);
        throw error;
    }
}
//# sourceMappingURL=users.js.map