{
  description = "kb — harness de dev + engine da base de conhecimento (CLI do gregio-marketplace)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        node = pkgs.nodejs_22;

        # A versão é a do engine — o flake mora na raiz, mas quem versiona o CLI é o
        # package.json dele.
        enginePkg = builtins.fromJSON (builtins.readFile ./cli/kb/package.json);

        kb = pkgs.stdenvNoCC.mkDerivation {
          pname = "kb";
          version = enginePkg.version or "0.3.0";
          src = self;
          nativeBuildInputs = [ pkgs.makeWrapper ];

          # Projeto zero-deps (só Node nativo) — nada de npm install.
          dontConfigure = true;
          dontBuild = true;

          # O repo é o marketplace inteiro, mas o pacote é só o CLI: `packages/` são
          # plugins do Claude Code, não entram — exceto as rules, que o `kb rules`
          # materializa nos repos e precisa achar fora do checkout.
          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/kb $out/bin
            cp -r cli/kb/bin cli/kb/src cli/kb/templates cli/kb/package.json $out/share/kb/
            cp -r packages/gregio-cc-rules/rules $out/share/kb/rules

            # `graphify` e `claude` vêm do ambiente do usuário (PATH herdado);
            # garantimos node + git para o engine (vault new / aggregator usam git).
            #
            # KB_RULES_DIR com --set-default: instalado via Nix o engine mora no store,
            # onde a busca relativa por `packages/gregio-cc-rules/rules` não existe;
            # ainda assim o usuário pode apontar para um checkout próprio exportando a
            # variável.
            makeWrapper ${node}/bin/node $out/bin/kb \
              --add-flags "$out/share/kb/bin/kb.js" \
              --set-default KB_RULES_DIR "$out/share/kb/rules" \
              --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
            runHook postInstall
          '';

          meta = {
            description = "Harness de dev (doctor/status/map/rules/guard) + engine da base de conhecimento pessoal (vaults + grafo central)";
            mainProgram = "kb";
          };
        };
      in
      {
        packages.default = kb;
        packages.kb = kb;

        apps.default = {
          type = "app";
          program = "${kb}/bin/kb";
        };

        devShells.default = pkgs.mkShell {
          packages = [ node pkgs.git ];
        };
      });
}
