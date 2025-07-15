/**
 * Remove recursivamente chaves de um objeto ou itens de um array que sejam nulos,
 * indefinidos, uma string vazia ou um array/objeto vazio.
 *
 * Esta função é útil para limpar dados de payloads antes de enviá-los para uma API,
 * garantindo que apenas valores significativos sejam transmitidos.
 *
 * - Para objetos, ela itera sobre cada chave e remove aquelas cujo valor, após a limpeza, se torna "vazio".
 * - Para arrays, ela primeiro limpa cada item e, em seguida, filtra quaisquer itens que resultem em um valor "vazio".
 *
 * @param data O objeto ou array a ser limpo.
 * @returns Os dados limpos. Se a limpeza resultar em um objeto ou array vazio, é isso que será retornado. Retorna o valor original se não for um objeto ou array.
 */
export function removeEmptyValues(data: any): any {
  // Para valores que não são objetos (como strings, números, booleanos), retorna-os como estão.
  // `null` é tecnicamente do tipo 'object', então a verificação `data === null` é importante.
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // Se for um array, limpa cada item recursivamente e depois filtra os "vazios".
  if (Array.isArray(data)) {
    return data
      .map(item => removeEmptyValues(item)) // 1. Limpa cada item do array.
      .filter(item => { // 2. Remove os itens que se tornaram "vazios".
        if (item === null || item === undefined || item === '') return false;
        if (Array.isArray(item) && item.length === 0) return false;
        // Garante que um objeto limpo, mas agora vazio, também seja removido do array.
        if (typeof item === 'object' && Object.keys(item).length === 0) return false;
        return true;
      });
  }

  // Se for um objeto, constrói um novo objeto apenas com as chaves que têm valores significativos.
  const newObj: { [key: string]: any } = {};
  for (const key of Object.keys(data)) {
    const cleanedValue = removeEmptyValues(data[key]); // Limpa o valor da chave.

    // Condições para ignorar a chave se o valor limpo for "vazio".
    if (cleanedValue === null || cleanedValue === undefined || cleanedValue === '') {
      continue;
    }
    if (Array.isArray(cleanedValue) && cleanedValue.length === 0) {
      continue;
    }
    // Garante que a chave seja removida se o seu valor for um objeto que se tornou vazio após a limpeza.
    if (typeof cleanedValue === 'object' && cleanedValue !== null && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) {
      continue;
    }

    newObj[key] = cleanedValue;
  }
  return newObj;
} 