# 10 — Parecer técnico final

[Índice](README.md) · [Registro completo](09-NAO-CONFORMIDADES.md) · [Resultados de verificação](08-TESTES-E-VALIDACOES.md)

## Classificação e escopo

**Aprovada com ressalvas para demonstração controlada da PoC com dados sintéticos.**

A aplicação importa planilhas, preserva RAW com IDs de linha, cria coleção higienizada, constrói chamadas locais estruturadas e apresenta sumário/ABSA com evidências. O código tem controles de formato, estado e erros coerentes com esse escopo. A exportação estática foi produzida e servida sem backend Next.

**Não há evidência suficiente para aprovar uso institucional com dados pessoais ou afirmar conformidade integral com a LGPD, anonimização completa ou acurácia semântica.** Essa delimitação não implica que existe backend oculto ou vazamento comprovado; implica que controles locais e testes estruturais não demonstram tais garantias.

## Evidência principal

- 63 testes executados com sucesso, lint sem diagnóstico, TypeScript aprovado.
- Build inicial no ambiente restrito falhou ao interpretar saída de subprocesso; mesmo código passou fora desse isolamento. Não foi aplicada correção para obter o segundo resultado.
- `out/` respondeu HTTP 200 para HTML e oito assets. Rotas estáticas: `/` e `/_not-found`.
- Frontend atual abriu no navegador; modelo local apareceu; analisar estava desabilitado sem arquivo; nenhum erro/warning de console capturado no estado inicial.
- Serviço Ollama atual, metadados e CORS responderam. **Generate real e fluxo completo de interface não foram repetidos nesta auditoria**; há registro histórico separado.
- Audit completo apontou cinco entradas altas da mesma cadeia de lint; audit omitindo dev apontou zero.
- Sondagens reproduziram falha Unicode no dicionário e pré-checagem incompleta de thinking, além dos limites do shape e validação semântica.
- 38 arquivos preexistentes permaneceram idênticos pelos hashes; apenas estes documentos foram adicionados.

## Contagem e gravidade

| Crítica | Alta | Média | Baixa | Total |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 1 | 7 | 3 | **11** |

Natureza: oito fatos confirmados, uma suspeita fundamentada e duas melhorias opcionais. A única alta é a dependência transitiva vulnerável da ferramenta de lint (`AUD-01`); impacto no artefato de navegador não foi demonstrado. Ausência de crítico identificado não é prova de ausência de vulnerabilidade crítica desconhecida.

## Aderência e funcionalidades pendentes

Arquitetura sem persistência de aplicação, parsing local, IDs, schema exato, payload local e projeção ABSA estão implementados. Backend, banco e APIs próprias **não são pendências**: são incompatíveis com os contratos disponíveis.

Pendências relevantes:

1. Dicionário precisa reconhecer equivalência Unicode sem alterar RAW.
2. Pré-checagem precisa demonstrar que o modelo selecionado admite `think:false`, incluindo versões sem metadados explícitos.
3. Contratos e mensagem de descarte precisam corresponder aos limites reais.
4. Modelo e ambiente experimental precisam ser identificados de forma reproduzível.
5. Interações React, capacidade e qualidade semântica precisam de validação proporcional ao uso pretendido.

Sumário por lote, limite de tamanho, mistura de respostas docentes/discentes e aceitação de saída vazia são comportamentos explícitos ou permitidos no estado atual. Não se devem chamar automaticamente de bugs ou mudar sem acordo sobre finalidade e contrato.

## Qualidade, débito e riscos

Há boa separação entre transformação de dados, transporte e apresentação, tipos estritos e testes negativos úteis. Não foram identificados ciclos locais, código morto claro, dependências diretas sem função ou necessidade de framework adicional. A página concentra coordenação; JSX denso e configuração exportada por componente são pequenos débitos de manutenção, sem justificar reescrita.

Principais riscos: identificadores não mascarados apesar da expectativa, validade estrutural confundida com factualidade, experimento com tag mutável, recursos síncronos sem orçamento demonstrado e regressões de UI fora da suíte.

Sem Git, a rastreabilidade histórica não é verificável. O manifesto identifica conteúdo, mas não substitui commit, diff ou autoria.

## Plano de correção priorizado

| Prioridade | Ação concreta | Achados | Condição de conclusão |
| --- | --- | --- | --- |
| 1 — Antes de dados pessoais | Corrigir correspondência canônica e explicitar alcance do mascaramento | AUD-02, AUD-04 | Regressões Unicode e preservação de RAW aprovadas; documentação coerente |
| 1 — Antes de experimento | Definir política de suporte a thinking e congelar modelo/versões/parâmetros | AUD-03, AUD-05 | Metadados verificados e teste real sintético com registro reprodutível |
| 1 — Manutenção de segurança | Resolver ou mitigar formalmente cadeia vulnerável sem downgrade cego | AUD-01 | Audit reavaliado, lint/tipos/testes/build íntegros; risco residual explicitado |
| 2 — Confiança operacional | Adicionar poucos E2E críticos e corpus anotado com revisão humana | AUD-07, AUD-04 | Critérios de acurácia/cobertura acordados e resultados documentados |
| 2 — Capacidade | Medir custo de leitura, dicionário e renderização; ajustar limites conforme dados | AUD-06 | Orçamentos testados em hardware alvo e erro seguro nos excessos |
| 2 — Reprodutibilidade | Recuperar versionamento e verificar instalação limpa em cópia autorizada | AUD-08, AUD-09 | Commit baseline conhecido, runtime fixado, `npm ci` reproduzível |
| 3 — Clareza | Alinhar descarte e decidir autenticação do formato de arquivo | AUD-10, AUD-11 | Comportamento/UI/testes correspondem à regra escolhida |

Essas ações são propostas; **não foram implementadas nesta etapa documental**. Não há autorização implícita aqui para alterar schema, criar banco ou instalar novas bibliotecas.

## Decisões que exigem avaliação humana

- População e finalidade: incluir comentários de docentes e discentes no mesmo conjunto? É necessário separar disciplinas? Os requisitos atuais não resolvem essas perguntas.
- Qualidade: qual métrica/limiar define sumário e ABSA aceitáveis? Quais casos exigem recusa ou revisão?
- Contrato: resultado vazio é válido como sucesso operacional ou deve receber outro estado? A alteração deve respeitar a fonte normativa Zod aprovada.
- Privacidade: quais identificadores são esperados e qual revisão prévia é suficiente? Quem pode consultar RAW na estação?
- Reprodutibilidade: qual modelo/digest/quantização ficará fixo no experimento? Tag local não basta.
- Operação: volume máximo e browsers/hardware suportados; política de origem CORS/serviço local e de descarte.

## Critérios para ampliar a aprovação

Para demonstração sintética, manter os limites explícitos e ambiente local. Para ampliar o uso, resolver os defeitos funcionais prioritários, reconciliar as garantias documentais, avaliar o aviso de dependência, demonstrar fluxo integral e congelar ambiente/corpus/critério de aceitação. A validação institucional de privacidade deve ser feita pelo responsável competente, além desta auditoria técnica.

Não se exige, sem requisito, suporte a múltiplos usuários, nuvem, autenticação, persistência ou uma arquitetura distribuída.

## Entrega, preservação e versionamento

Foram criados **11 Markdown** em `docs/auditoria/`, listados no [índice](README.md), sem alterações em fonte, dependências ou contratos preexistentes. Builds atualizaram somente artefatos gerados.

`git status`, `git rev-parse HEAD` e `git log` não encontraram repositório. **Nenhum commit foi criado; nenhum push foi feito.** Inicializar outro repositório não recuperaria o histórico e não foi usado para contornar essa limitação. A identidade alternativa do snapshot consta no documento 08.
