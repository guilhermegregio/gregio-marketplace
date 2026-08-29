# language: pt
# Contrato do plano kb-scaffold-estacao (devflow v2).
# Congelado por `kb dev freeze` após aprovação: cenário quebrando = código errado.
# Nível: comportamento observável do CLI (saída, exit code, efeito no filesystem).

Funcionalidade: kb scaffold — bootstrap do workspace e do CLAUDE.md global
  Para que uma estação nova (NixOS ou macOS) fique pronta com um comando,
  o kb scaffold cria os diretórios do workspace e gerencia blocos marcados
  no ~/.claude/CLAUDE.md, selecionados por perfis persistidos na config do kb.

  Contexto:
    Dado que HOME e a config do kb apontam para um ambiente isolado de teste

  Cenário: primeira execução numa estação limpa
    Dado que "~/code" não existe
    E que "~/.claude/CLAUDE.md" não existe
    Quando rodo "kb scaffold --profiles backend"
    Então os diretórios "~/code", "~/code/worktrees" e "~/code/.scratchpad" existem
    E "~/code/.scratchpad/README.md" existe e diz que o conteúdo é efêmero e substitui o /tmp para agentes
    E "~/.claude/CLAUDE.md" existe contendo os blocos de perfil "all" e o bloco "backend", cada um entre marcadores "<!-- kb-scaffold:begin <bloco> v<versão> -->" e "<!-- kb-scaffold:end <bloco> -->"
    E a config do kb registra "backend" em scaffold.profiles
    E o exit code é 0

  Cenário: sem perfis salvos e sem flag, só os blocos "all" entram
    Dado que a config do kb não tem scaffold.profiles
    Quando rodo "kb scaffold"
    Então "~/.claude/CLAUDE.md" contém apenas blocos cujo template declara profiles [all]
    E nenhum bloco de perfil opcional é escrito

  Cenário: idempotência — segunda execução não escreve nada
    Dado que "kb scaffold" acabou de ser aplicado com sucesso
    Quando rodo "kb scaffold" de novo
    Então a saída informa que está tudo em dia
    E nenhum arquivo é criado ou modificado (mtime e conteúdo idênticos)
    E o exit code é 0

  Cenário: atualização de bloco preserva o texto artesanal
    Dado um "~/.claude/CLAUDE.md" com texto artesanal antes e depois de um bloco "core" na versão 1
    E que o template do bloco "core" está na versão 2
    Quando rodo "kb scaffold"
    Então o miolo do bloco "core" passa a ser o da versão 2 e o marcador diz "v2"
    E todo o texto artesanal fora dos marcadores permanece byte a byte idêntico

  Cenário: CLAUDE.md pré-existente sem nenhum marcador só ganha appends
    Dado um "~/.claude/CLAUDE.md" artesanal sem nenhum marcador kb-scaffold
    Quando rodo "kb scaffold"
    Então o conteúdo artesanal permanece intacto no início do arquivo
    E os blocos gerenciados são anexados ao fim
    E nada do texto artesanal é removido ou alterado

  Cenário: trocar perfis atualiza a config e remove só o bloco gerenciado
    Dado que scaffold.profiles é ["backend","frontend"] e os blocos correspondentes estão instalados
    Quando rodo "kb scaffold --profiles backend"
    Então a config do kb passa a registrar apenas "backend" em scaffold.profiles
    E o bloco "frontend" (com marcador) é removido do CLAUDE.md
    E blocos "all" e texto artesanal permanecem intactos

  Cenário: --dry-run relata e não escreve
    Dado que "~/code/worktrees" não existe e há um bloco desatualizado no CLAUDE.md
    Quando rodo "kb scaffold --dry-run"
    Então a saída lista o que seria criado e o que seria atualizado
    E nenhum diretório é criado e nenhum arquivo é modificado

  Cenário: --list mostra o seletor
    Dado que scaffold.profiles é ["backend"]
    Quando rodo "kb scaffold --list"
    Então vejo os perfis disponíveis (vindos do manifest dos templates), com "backend" marcado como ativo
    E vejo a versão instalada e a versão disponível de cada bloco

Funcionalidade: kb doctor — checklist de estação com correção sugerida
  O doctor diz o que falta na estação, com o comando de correção pronto
  para copiar. Ele nunca conserta nada sozinho.

  Cenário: ferramenta ausente vira ✗ com o comando de correção
    Dado que uma ferramenta do contrato (por exemplo "claude") não está no PATH
    Quando rodo "kb doctor"
    Então vejo uma linha "✗" para essa ferramenta contendo o comando de instalação sugerido
    E o exit code é 1

  Cenário: workspace incompleto sugere kb scaffold
    Dado que "~/code/.scratchpad" não existe
    Quando rodo "kb doctor"
    Então vejo uma linha "✗" para o workspace sugerindo rodar "kb scaffold"
    E o exit code é 1

  Cenário: drift de bloco do CLAUDE.md sugere kb scaffold
    Dado que um bloco ativo do "~/.claude/CLAUDE.md" está numa versão menor que a do template
    Quando rodo "kb doctor"
    Então vejo uma linha "✗" apontando o drift e sugerindo "kb scaffold"
    E o exit code é 1

  Cenário: check não aplicável à plataforma é pulado sem falhar
    Dado que um check não se aplica à plataforma atual
    Quando rodo "kb doctor"
    Então esse check aparece com "-" e o motivo
    E ele não conta para o exit code

  Cenário: doctor é read-only
    Dado qualquer estado da estação
    Quando rodo "kb doctor" duas vezes seguidas
    Então nenhum arquivo ou diretório é criado, modificado ou removido
    E as duas saídas são idênticas

  Cenário: estação completa sai limpa
    Dado que todos os checks aplicáveis passam
    Quando rodo "kb doctor"
    Então a última linha diz que está tudo certo
    E o exit code é 0
