{
  description = "kb — engine da base de conhecimento (CLI) + arquivador de Discord";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        node = pkgs.nodejs_22;

        kb = pkgs.stdenvNoCC.mkDerivation {
          pname = "kb";
          version = "0.1.0";
          src = self;
          nativeBuildInputs = [ pkgs.makeWrapper ];

          # Projeto zero-deps (só Node nativo) — nada de npm install.
          dontConfigure = true;
          dontBuild = true;

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/kb $out/bin
            cp -r bin src templates package.json $out/share/kb/

            # `graphify` e `claude` vêm do ambiente do usuário (PATH herdado);
            # garantimos node + git para o engine (vault new / aggregator usam git).
            makeWrapper ${node}/bin/node $out/bin/kb \
              --add-flags "$out/share/kb/bin/kb.js" \
              --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.git ]}
            runHook postInstall
          '';

          meta = {
            description = "Engine da base de conhecimento pessoal (vaults + grafo central)";
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
