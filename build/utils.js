/**
 * Recursively removes keys from an object or items from an array that are null,
 * undefined, an empty string, or an empty array/object.
 *
 * Useful for cleaning payload data before sending it to an API,
 * ensuring only meaningful values are transmitted.
 *
 * - For objects, iterates each key and removes those whose value becomes "empty" after cleaning.
 * - For arrays, first cleans each item, then filters out any items that result in an "empty" value.
 *
 * @param data The object or array to clean.
 * @returns The cleaned data. If cleaning results in an empty object or array, that empty value is returned.
 *          Returns the original value if it is not an object or array.
 */
export function removeEmptyValues(data) {
    // For non-object values (strings, numbers, booleans), return as-is.
    // `null` is technically typeof 'object', so the `data === null` check matters.
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    // If it is an array, clean each item recursively, then filter out "empty" ones.
    if (Array.isArray(data)) {
        return data
            .map(item => removeEmptyValues(item)) // 1. Clean each array item.
            .filter(item => {
            if (item === null || item === undefined || item === '')
                return false;
            if (Array.isArray(item) && item.length === 0)
                return false;
            // Ensure a cleaned-but-now-empty object is also removed from the array.
            if (typeof item === 'object' && Object.keys(item).length === 0)
                return false;
            return true;
        });
    }
    // If it is an object, build a new object with only keys that have meaningful values.
    const newObj = {};
    for (const key of Object.keys(data)) {
        const cleanedValue = removeEmptyValues(data[key]); // Clean the key's value.
        // Skip the key if the cleaned value is "empty".
        if (cleanedValue === null || cleanedValue === undefined || cleanedValue === '') {
            continue;
        }
        if (Array.isArray(cleanedValue) && cleanedValue.length === 0) {
            continue;
        }
        // Remove the key if its value is an object that became empty after cleaning.
        if (typeof cleanedValue === 'object' && cleanedValue !== null && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) {
            continue;
        }
        newObj[key] = cleanedValue;
    }
    return newObj;
}
//# sourceMappingURL=utils.js.map