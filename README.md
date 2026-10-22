# F-3905 — Controle de Nível Concept

Módulo **one-page/PWA** com conteúdo técnico integral e simulação matemática interativa da malha do F-3905.

## O que está incluído
- `index.html` — página principal, CSS, JavaScript, conteúdo técnico integral, painel interativo e treinamento CIC;
- `assets/diagrama-f3905-original.png` — desenho enviado pelo usuário;
- `icons/icon-192.png` e `icons/icon-512.png` — ícones para instalação PWA;
- `manifest.webmanifest` — metadados e opções de instalação;
- `service-worker.js` — cache offline e atualizações.

## Publicar no GitHub Pages
1. Criar um repositório (por exemplo `F-3905-Nivel-Concept`).
2. Descompactar o ZIP e enviar **todos os arquivos da pasta** para a raiz do repositório. Não enviar somente o ZIP.
3. No repositório, abrir **Settings > Pages**, escolher publicação via branch `main` e diretório `/ (root)`.
4. Abrir a URL disponibilizada no GitHub Pages em HTTPS.
5. O botão **Instalar App** usará o convite do navegador quando disponível. Android/Chrome também pode usar `⋮ > Instalar aplicativo`; Safari/iOS usa `Compartilhar > Adicionar à Tela de Início`.

## Atualizar versão já instalada
Sempre que publicar mudanças, altere `CACHE_VERSION` em `service-worker.js` (ex. `f3905-concept-v1.0.1-20261022`), publique os arquivos modificados e abra novamente o app conectado à internet. Um banner informará a existência de versão nova, quando o service worker identificar o update. A página principal usa estratégia network-first.

## Simulação estática MIN/MAX (módulo original)
Sinais normalizados percentuais de comando, com quatro seletores `MIN(FIC, LY)` e um seletor de rastreamento `MAX(FY-250, FY-251, FY-252, FY-253)`. Valores iniciais hipotéticos. Não são vazões reais, nem modelo dinâmico do F-3905. Este primeiro simulador estático não transforma comandos em deslocamento de nível. O laboratório dinâmico V2/V3, descrito mais adiante, inclui essa evolução com parâmetros hipotéticos.

## Conferência técnica
Para aplicação na operação, conferir a configuração de LS/LIC/LY/FY/LX, as ações das válvulas, o rastreamento e as proteções nos documentos e nas telas oficiais do SDCD.


## V2.0 — Laboratório dinâmico
- Preserva integralmente os capítulos, diagrama original, simulador MIN/MAX e avaliação da V1.0.1.
- Novo painel SVG animado do F-3905, com altura de nível e cinco correntes de alimentação, além da retirada.
- Controle didático temporal com cascata LIC-151A/FIC-151, atuação de LY-151C, seletores FY MIN, CPV calculado por LX MAX, acompanhamento de tendências e testes de estabilidade.
- Perturbações: retirada, pressão de alimentação, SPs dos FICs e nível inicial; ensaios com modos manuais e falha de válvula.
- Cenários: operação normal, perda de retirada, elevação de pressão, aumento de carga, nível inicial alto e FV-252 travada.
- Os parâmetros dinâmicos são ilustrativos e não substituem configuração do sistema real.
- Os arquivos assets/dinamica.js e assets/dinamica.css devem ser enviados junto com index.html ao GitHub Pages.
- Para cache offline, atualizar sempre o valor CACHE_VERSION em service-worker.js.

## V3.0 — Refinamento de acompanhamento e diagnóstico
- Preservados os capítulos, diagramas, simulador MIN/MAX, laboratório V2 e treinamento.
- 8 cenários: 6 originais e falha de LT-151A e indicação FT-151.
- Seleção didática LT-151A/B, injeção de desvios de medição e divergência de instrumentos. O critério real de LS **não** é conhecido.
- Estabilidade exigida por 3 minutos simulados consecutivos: inventário, tendência, balanço e coerência de instrumentos.
- Tendências extras de instrumentos e de posição efetiva de FV-252.
- Cadeia viva LIC/FIC/LY/FY/LX, matriz de restrição, histórico de eventos e relatório copiável.
- Modelo de pressão-vazão usa raiz quadrada da pressão relativa como aproximação didática.
- Nenhuma sintonia, intertravamento, sentido de ação ou faixa operacional real foi inferida como dado confirmado.
