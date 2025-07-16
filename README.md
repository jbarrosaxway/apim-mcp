# Axway APIM MCP: Um Guia para o Projeto

Bem-vindo à documentação do **Axway APIM MCP**. Este documento explica o que é um "MCP", como este projeto específico funciona, e como um modelo de linguagem (LLM) como eu o utiliza para interagir com o seu ambiente Axway API Management.

## 1. O que é um MCP? (Para Leigos)

Imagine que um Modelo de Linguagem (LLM) é um **Chef de Cozinha** genial. Ele sabe milhares de receitas e pode criar pratos incríveis, mas está "preso" dentro da cozinha. Ele não pode ir ao mercado comprar ingredientes.

O **MCP (Model-Context-Protocol)** é o sistema que permite ao Chef trabalhar.

*   **Modelo (O Chef):** É o cérebro da operação, o LLM. Ele entende os pedidos, pensa e dá as ordens.

*   **Contexto (O Cardápio de Ferramentas):** É um "cardápio" que o Chef recebe, detalhando todos os ingredientes que um **Ajudante de Cozinha** pode buscar. Por exemplo, o cardápio diz:
    *   "Posso buscar `cebolas`. Não preciso de mais informações."
    *   "Posso buscar `queijo`. Preciso que me diga o `tipo` e a `quantidade`."
    *   "Posso `verificar a temperatura do forno`."

    Neste projeto, este "cardápio" é a lista de ferramentas que eu posso usar para interagir com a Axway (`list_topology`, `search_traffic_events`, etc.).

*   **Protocolo (A Comunicação):** É a linguagem e as regras que o Chef e o Ajudante usam para se comunicar. O Chef faz um pedido estruturado ("Ajudante, traga-me 200g de queijo cheddar") e o Ajudante retorna com o ingrediente e uma confirmação ("Chef, aqui estão os 200g de queijo cheddar").

Em resumo, o **MCP é um sistema que dá "mãos e pés" a um cérebro (LLM), permitindo-lhe interagir com o mundo exterior de forma segura e estruturada através de um conjunto de ferramentas pré-definidas.**

## 2. Padrões de MCP e a Nossa Implementação

A teoria do MCP é implementada neste projeto da seguinte forma:

| Padrão MCP | Nossa Implementação (`axway-mcp`) |
| :--- | :--- |
| **Servidor MCP** | Um servidor web escrito em **Node.js** e **TypeScript** (`src/index.ts`). Ele é o nosso "Ajudante de Cozinha", que ouve os pedidos do LLM. |
| **Transporte (Protocolo)** | Usamos o **Streamable HTTP Transport**. Isto significa que a comunicação acontece via HTTP, e o servidor pode "transmitir" respostas longas, o que é ótimo para tarefas demoradas. |
| **Definição de Ferramentas (Contexto)**| Cada ferramenta disponível é definida em `src/operations/`. Cada arquivo (ex: `monitoring.ts`, `users.ts`) agrupa funcionalidades relacionadas. O arquivo `src/tools.ts` define o "cardápio": o nome de cada ferramenta, sua descrição e os parâmetros (argumentos) que ela exige. |
| **Ponte com o Mundo Real** | O arquivo `src/api.ts` contém a classe `AxwayApi`. Esta é a parte que realmente "vai ao mercado", ou seja, que sabe como fazer as chamadas de API reais para o seu Axway API Gateway e API Manager. |
| **Empacotamento** | O projeto é empacotado numa imagem **Docker**. Isto garante que o "Ajudante de Cozinha" tem sempre o seu ambiente de trabalho configurado da mesma forma, não importa onde ele é executado. Usamos um `.dockerignore` para garantir que segredos (como o arquivo `.env`) nunca entrem na imagem. |

## 3. Análise da Stack Tecnológica: Por que Node.js e TypeScript?

A escolha de uma stack tecnológica é um compromisso entre performance, ecossistema e produtividade da equipe. Esta seção oferece uma análise realista da nossa escolha (Node.js/TypeScript) em comparação com outras alternativas populares para a construção de um servidor MCP.

| Linguagem / Stack | Prós (Vantagens) | Contras (Desvantagens) | Veredito para este MCP |
| :--- | :--- | :--- | :--- |
| **Node.js + TypeScript (A nossa escolha)** | **Excelente para I/O:** O modelo assíncrono e não-bloqueante é perfeito para um MCP, que passa a maior parte do tempo esperando respostas de APIs. <br> **Ecossistema Gigante:** O NPM tem bibliotecas para tudo. <br> **JSON Nativo:** A manipulação de JSON é trivial e performática. <br> **Segurança de Tipos:** O TypeScript evita muitos erros comuns em projetos complexos. | **Performance em CPU:** Não é ideal para tarefas de processamento pesado (ex: cálculos matemáticos complexos), pois pode bloquear o event loop. <br> **Gestão de Concorrência:** Embora `async/await` seja ótimo, não é um verdadeiro paralelismo. | **Escolha Ideal.** O perfil do nosso projeto é 99% I/O-bound, o que anula a principal desvantagem do Node.js. A produtividade e o vasto ecossistema justificam a escolha. |
| **Python + FastAPI** | **Fácil e Rápido de Desenvolver:** A sintaxe é limpa e a produtividade é altíssima. <br> **Excelente Suporte a Async:** Frameworks modernos como FastAPI são tão eficientes quanto Node.js para tarefas de I/O. <br> **Ecossistema de IA:** A integração com ferramentas de IA e Machine Learning é a melhor do mercado. | **GIL (Global Interpreter Lock):** Limita o paralelismo real em tarefas CPU-bound. <br> **Gestão de Dependências:** Pode ser mais complexa (venv, poetry, pip). | **Competidor Muito Forte.** Seria uma escolha igualmente válida. A decisão a favor do Node.js/TypeScript foi marginal, baseada na maturidade do ecossistema para servidores web e na preferência da equipe. |
| **Go (Golang)** | **Performance Bruta:** Compilado para um binário único, é extremamente rápido. <br> **Concorrência Nativa:** Goroutines são um modelo superior para gerenciar milhares de conexões em paralelo com baixo custo. <br> **Deploy Simples:** O binário único facilita a criação de imagens Docker mínimas. | **Ecossistema Menor:** Menos bibliotecas prontas para usar em comparação com Node ou Python. <br> **Verboso:** A sintaxe, especialmente a gestão de erros, pode ser mais repetitiva. | **Exagerado (Overkill).** Embora a performance seja superior, a complexidade adicional no desenvolvimento e o ecossistema menos rico para a manipulação de APIs não compensam o ganho de velocidade, que não é o nosso principal gargalo. |
| **Java + Spring / Vert.x** | **Robustez e Escalabilidade:** Plataforma testada em batalha para aplicações empresariais de grande escala. <br> **Ecossistema Maduro:** Bibliotecas de alta qualidade para tudo. <br> **Modelos Reativos:** Frameworks como WebFlux/Vert.x oferecem I/O não-bloqueante. | **Verboso e Pesado:** Mais código para fazer a mesma coisa. O consumo de memória e o tempo de inicialização são geralmente maiores. | **Inadequado.** A complexidade e o peso da plataforma são desproporcionais para a simplicidade de um servidor MCP. A produtividade seria significativamente menor. |

---
**Conclusão da Análise:** Node.js com TypeScript representa o "ponto ótimo" para este projeto específico, equilibrando de forma ideal a **performance em tarefas de I/O**, a **produtividade do desenvolvimento** e um **ecossistema maduro** que nos permite construir de forma rápida e segura.

## 4. O Fluxo de uma Solicitação: Da Pergunta à Resposta

Vamos ver um exemplo prático de como um pedido seu é processado.

**O seu Pedido:** *"Veja as chamadas com erro no último dia."*

1.  **O Chef (LLM) Pensa:** Eu recebo o seu pedido. Analiso o "cardápio" de ferramentas que o `axway-mcp` me ofereceu. Encontro uma ferramenta chamada `search_traffic_events` que parece perfeita para a tarefa. A descrição dela diz que posso filtrar por tempo (`ago`), por campo (`searchField`) e por valor (`searchValue`).

2.  **O Chef (LLM) Ordena:** Eu formulo um pedido estruturado (uma chamada de ferramenta):
    `search_traffic_events(ago='24h', searchField='finalStatus', searchValue='Fail')`

3.  **O Ajudante (Servidor MCP) Recebe:** O nosso servidor Node.js, rodando no Docker, recebe esta chamada. Ele identifica que a ferramenta `search_traffic_events` deve ser executada.

4.  **O Ajudante (Servidor MCP) Trabalha:** O servidor chama a função correspondente em `src/operations/monitoring.ts`. Essa função, por sua vez, usa a classe `AxwayApi` de `src/api.ts` para fazer uma chamada real à API de monitoramento do seu Axway Gateway.

5.  **O Mercado (Axway) Responde:** O seu Axway Gateway retorna os dados brutos dos eventos de erro para o nosso servidor.

6.  **O Ajudante (Servidor MCP) Entrega:** O servidor pega nos dados, formata-os como uma string de **JSON compacto** (uma decisão que tomamos para economizar tokens e custos) e envia-os de volta para mim.

7.  **O Chef (LLM) Apresenta o Prato:** Eu recebo o JSON compacto. É um ingrediente bruto, não muito apresentável. A minha tarefa final é "empratar": eu analiso o JSON, extraio a informação mais importante e apresento-a a si de forma legível, como uma **tabela em Markdown**.

## 5. Entendendo os Campos Retornados

Como viu no fluxo acima, o que o servidor retorna é o "ingrediente bruto" (JSON compacto). A minha função é interpretá-lo. No entanto, alguns campos são chaves para desbloquear mais informações.

*   `correlationId`: Pense nisto como o **número de série único** de uma transação. Quase todos os eventos de tráfego têm um. Se você me pedir mais detalhes sobre um erro específico, eu uso este `correlationId` para chamar outras ferramentas, como `get_traffic_event_details` ou `get_traffic_event_trace`.

*   `instanceId`, `groupId`: São os identificadores da sua topologia. A ferramenta `list_topology` retorna-os. Se você me pedir para ver o tráfego de uma instância específica, eu primeiro uso `list_topology` para saber o `instanceId` e depois uso esse ID para chamar `get_instance_traffic`.

*   `id` (em Organizações, Aplicações, Usuários, etc.): É o identificador único de um objeto no API Manager. Funciona da mesma forma: para atualizar um usuário, primeiro preciso do seu `id`, que posso obter com `list_users`.

A lógica é sempre a mesma: **usar ferramentas mais gerais para obter IDs e, em seguida, usar esses IDs como "chaves" para ferramentas mais específicas.**

## 6. Um Mergulho Fundo no Streamable HTTP Transport

A comunicação entre o LLM e o servidor MCP precisa ser persistente para simular uma conversa. O `StreamableHttpServerTransport` consegue isto de uma forma inteligente usando **Server-Sent Events (SSE)**, e o seu funcionamento baseia-se num ciclo de vida de sessão que envolve os métodos `POST` e `GET`.

### Passo 1: Criação da Sessão (Método `POST`)

Tudo começa quando um cliente (o LLM) quer iniciar uma nova conversa.

1.  **Primeiro Contato:** O cliente envia uma solicitação `POST` para o endpoint raiz (`/`) do servidor. Esta primeira chamada pode ou não conter uma chamada de ferramenta.
2.  **Nasce uma Sessão:** Ao receber este `POST`, o servidor:
    *   Cria uma nova instância do `StreamableHTTPServerTransport`. Este objeto irá gerenciar a comunicação para esta sessão específica.
    *   Gera um `sessionId` único (um UUID).
    *   Armazena a nova instância de transporte num mapa global, usando o `sessionId` como chave (ex: `transports[sessionId] = novoTransporte`).
3.  **A Resposta:** O servidor responde a esta solicitação `POST` e, crucialmente, inclui o `sessionId` num cabeçalho da resposta (ex: `x-mcp-session-id`). A conexão HTTP é mantida aberta para que o servidor possa "empurrar" eventos (respostas de ferramentas) para o cliente via SSE.

### Passo 2: A Conversa (Métodos `POST` Subsequentes)

Agora que a sessão está estabelecida, todas as chamadas de ferramentas subsequentes do LLM para o servidor são feitas via solicitações `POST` que **obrigatoriamente** incluem o `sessionId` no cabeçalho. O servidor usa este ID para encontrar o objeto de transporte correto no seu mapa e processar o pedido.

### Passo 3: Reconexão de Sessão (Método `GET`)

Este é o cenário que o código no topo desta seção resolve. Se o cliente se desconectar (ex: a rede falha, o usuário atualiza a página), ele pode continuar a mesma conversa sem perder o histórico.

1.  **Pedido de Reconexão:** O cliente envia uma solicitação `GET` para o endpoint raiz (`/`), incluindo o seu `sessionId` no cabeçalho.
2.  **Lógica do Servidor:**
    *   O servidor verifica que o método é `GET`.
    *   Ele extrai o `sessionId` do cabeçalho.
    *   Procura no seu mapa de transportes por uma sessão ativa com aquele ID.
    *   Se a sessão for encontrada, o servidor entrega o controle do pedido ao objeto de transporte existente, que reestabelece o fluxo SSE. A conversa pode continuar.
    *   Se a sessão não for encontrada (ou se nenhum `sessionId` for enviado), o servidor retorna um erro `405 Method Not Allowed`, pois o método `GET` só é permitido para reconexões.

Este mecanismo torna a comunicação robusta, eficiente e compatível com a infraestrutura web padrão, sem a necessidade de um upgrade de protocolo como o que acontece com WebSockets.

## 7. Configuração e Execução

Este projeto foi desenhado para ser executado como um contêiner Docker. A sua configuração é feita através de variáveis de ambiente no momento da execução.

### Variáveis de Ambiente Obrigatórias

A tabela abaixo detalha todas as variáveis de ambiente necessárias para que o servidor se conecte corretamente ao seu ambiente Axway.

| Variável de Ambiente | Descrição | Obrigatório | Exemplo |
| :--- | :--- | :--- | :--- |
| `AXWAY_GATEWAY_URL` | URL da API de Gestão do API Gateway. | Sim | `https://seu-gateway:8090/api` |
| `AXWAY_GATEWAY_USERNAME` | Nome de usuário para o API Gateway. | Sim | `admin` |
| `AXWAY_GATEWAY_PASSWORD` | Senha para o usuário do API Gateway. | Sim | `changeme` |
| `AXWAY_MANAGER_URL` | URL da API do Portal do API Manager. | Sim | `https://seu-manager:8075/api/portal/v1.4` |
| `AXWAY_MANAGER_USERNAME` | Nome de usuário para o API Manager. | Sim | `apiadmin` |
| `AXWAY_MANAGER_PASSWORD` | Senha para o usuário do API Manager. | Sim | `changeme` |
| `TRANSPORT_MODE` | Define o modo de transporte. Pode ser `http` (padrão) ou `stdio`. | Não | `http` |
| `TZ` | Fuso horário (IANA) para o contêiner. | Não | `America/Sao_Paulo` |

#### Exemplos de Fuso Horário (`TZ`)
*   **Américas:** `America/Sao_Paulo`, `America/New_York`, `America/Los_Angeles`
*   **Europa:** `Europe/Lisbon`, `Europe/London`, `Europe/Paris`, `Europe/Berlin`
*   **Padrão (se não for fornecido):** `UTC`

### Modos de Transporte

O servidor MCP suporta dois modos de transporte:

#### 1. Modo HTTP (Padrão)
- **Descrição:** Comunicação via HTTP com Server-Sent Events (SSE)
- **Uso:** Ideal para integração com clientes web e aplicações que precisam de múltiplas sessões
- **Ativação:** Padrão ou definindo `MCP_TRANSPORT=http`

#### 2. Modo STDIO
- **Descrição:** Comunicação direta via stdin/stdout
- **Uso:** Ideal para integração direta com LLMs locais ou ferramentas de linha de comando
- **Ativação:** Definindo `TRANSPORT_MODE=stdio` ou usando argumentos `--stdio` ou `-s`

### Como Construir e Executar

1.  **Construir a Imagem**

    A partir da raiz do projeto, execute:
    ```bash
    docker build -t axwayjbarros/apim-mcp:1.0.11 .
    ```

2.  **Executar o Contêiner**

    Este é um exemplo completo de comando para executar o servidor em modo "detached" (`-d`), com reinício automático (`--restart unless-stopped`) e com todas as variáveis de ambiente configuradas.
    
    ```bash
    # Modo HTTP (padrão)
    docker run -d \
      -p 8080:3000 \
      --restart unless-stopped \
      --name axway-mcp-server \
      -e TRANSPORT_MODE="http" \
      -e AXWAY_GATEWAY_URL="https://seu-gateway:8090/api" \
      -e AXWAY_GATEWAY_USERNAME="admin" \
      -e AXWAY_GATEWAY_PASSWORD="sua_senha_aqui" \
      -e AXWAY_MANAGER_URL="https://seu-manager:8075/api/portal/v1.4" \
      -e AXWAY_MANAGER_USERNAME="apiadmin" \
      -e AXWAY_MANAGER_PASSWORD="sua_senha_aqui" \
      -e TZ="America/Sao_Paulo" \
      axwayjbarros/apim-mcp:1.0.11
    ```

    ```bash
    # Modo STDIO (para integração direta com LLMs)
    docker run -d \
      --restart unless-stopped \
      --name axway-mcp-server-stdio \
      -e TRANSPORT_MODE="stdio" \
      -e AXWAY_GATEWAY_URL="https://seu-gateway:8090/api" \
      -e AXWAY_GATEWAY_USERNAME="admin" \
      -e AXWAY_GATEWAY_PASSWORD="sua_senha_aqui" \
      -e AXWAY_MANAGER_URL="https://seu-manager:8075/api/portal/v1.4" \
      -e AXWAY_MANAGER_USERNAME="apiadmin" \
      -e AXWAY_MANAGER_PASSWORD="sua_senha_aqui" \
      -e TZ="America/Sao_Paulo" \
      axwayjbarros/apim-mcp:1.0.11
    ```
    *   **Nota:** Se preferir, pode colocar todas as variáveis de ambiente (exceto `TZ`) num arquivo `.env` e usar a flag `--env-file .env` em vez das várias flags `-e`.

### Opção 2: Implantação com Helm (para Kubernetes)

Para ambientes Kubernetes, a implantação pode ser simplificada usando o Helm Chart incluído no projeto.

1.  **Personalizar a Configuração**

    Navegue até a pasta `helm/axway-mcp/` e edite o arquivo `values.yaml`. Preencha todas as variáveis de ambiente na seção `env:` com os seus dados, e defina a `tag` da imagem para a versão que pretende implantar (ex: `1.0.11`).

    ```yaml
    # helm/axway-mcp/values.yaml

    image:
      repository: axwayjbarros/apim-mcp
      tag: "1.0.11" # <-- Defina a tag aqui

    env:
      TZ: "America/Sao_Paulo"
      AXWAY_GATEWAY_URL: "https://seu-gateway:8090/api"
      # ... preencha o resto das variáveis
    ```

2.  **Instalar o Chart**

    A partir da raiz do projeto, execute o comando `helm install`. Pode dar um nome à sua implantação (ex: `axway-mcp-release`).

    ```bash
    # Instala o chart do diretório local
    helm install axway-mcp-release ./helm/axway-mcp
    ```

3.  **Instalar com Parâmetros via Linha de Comando**

    Como alternativa a editar o `values.yaml`, pode passar os parâmetros diretamente na linha de comando usando a flag `--set`.

    ```bash
    helm install axway-mcp-release ./helm/axway-mcp \
      --set image.tag="1.0.11" \
      --set env.AXWAY_GATEWAY_URL="https://seu-gateway:8090/api" \
      --set env.AXWAY_GATEWAY_USERNAME="admin" \
      --set env.AXWAY_GATEWAY_PASSWORD="sua_senha_aqui" \
      # ... e assim por diante para todas as outras variáveis
    ``` 
