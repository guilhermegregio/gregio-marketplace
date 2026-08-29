---
block: os-info
profiles: [all]
order: 10
version: 2
---

# OS Info

{{FASTFETCH}}

Este bloco é um retrato tirado quando ele foi escrito — na instalação, ou quando a
versão do bloco sobe. Ele **não** se refaz a cada `kb scaffold` (bloco na mesma versão
não é reescrito, senão o uptime da máquina viraria diff a cada execução), então trate
os números como aproximados. Para o estado de agora, rode `fastfetch -l none`.
