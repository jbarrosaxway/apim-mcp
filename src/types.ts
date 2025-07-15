/**
 * @module src/types
 * @description Define as interfaces e tipos de dados customizados usados em todo o projeto.
 */

/**
 * Representa uma ferramenta relacionada que pode ser sugerida como um próximo passo lógico
 * após a execução de uma ferramenta principal.
 *
 * Por exemplo, depois de usar `list_users`, uma `RelatedTool` poderia ser `get_user`,
 * pré-preenchida com o `id` de um dos usuários da lista.
 */
export interface RelatedTool {
    /**
     * O nome da ferramenta a ser chamada, que deve corresponder a uma ferramenta registrada.
     * @example "get_user_details"
     */
    tool_name: string;
    /**
     * Uma descrição amigável explicando por que esta ferramenta está sendo sugerida
     * e o que ela fará.
     * @example "Obter detalhes para o usuário 'fulano'"
     */
    description: string;
    /**
     * Uma lista de parâmetros pré-preenchidos para a ferramenta sugerida.
     * O objetivo é facilitar a próxima ação do usuário, fornecendo os argumentos necessários.
     */
    parameters: {
        /**
         * O nome do parâmetro, que deve corresponder a um dos parâmetros esperados pela `tool_name`.
         * @example "userId"
         */
        name: string;
        /**
         * O valor sugerido para o parâmetro.
         * @example "801a61be-b924-40fd-ad64-77a339a695b7"
         */
        value: string;
    }[];
} 