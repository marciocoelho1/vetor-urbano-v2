# Mecanismos de catálogo adaptados

Instalados em 12/10/2026 por HyperFrames 0.8.150, origem configurada `https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry`. Os HTMLs deste diretório preservam a consulta dos sources. Não são montados no filme nem carregados em execução; alguns exemplos contêm fontes e conteúdo externos que não fazem parte da peça.

| Item consultado/instalado | Adaptação efetivamente usada em `index.html` |
|---|---|
| `caption-editorial-emphasis` | Sistema dual-font, blocos com palavras de ênfase e hierarchy de linhas; Manrope/Newsreader locais, texto brasileiro e máscaras com alturas para Newsreader. Todos os captions genéricos, sombras, fit com canvas e transcrição foram substituídos pela copy curta do plano. |
| `ui-3d-reveal` | Mecânica de perspectiva estática e superfície cujo wrapper realiza poses de inclinação/rotação/afastamento. O mundo autoral tem uma cartografia única; interface Figma, molduras e glow foram removidos. Os trechos de câmera foram combinados em três tweens sequenciais no mesmo wrapper. |
| `arc-motion-path` | Viagem seekable pelo MotionPathPlugin, arquivo local 3.15.0. Um único círculo segue paths autorais que conectam sublinhado, mergulho e assinatura. UI/chips de exemplo não foram incorporados. |
| `marker-highlight` | Medição única por `getTotalLength()`, `strokeDasharray` e keyframes diretos de `strokeDashoffset`, inclusive retirada do traço. Stroke verde limpo; sem grunge/boil ou amarelo de marcador. |
| `logo-brand-close` | Wordmark monumental, assentamento escalonado e tagline legível, seguido de hold totalmente estático. Letras são agrupadas nas palavras Vetor/Urbano. Sem ponto artificial, URL, CTA, glow ou overshoot. Marca SVG exata da aplicação reaproveitada. |

Lacunas: topologia urbana abstrata sem contornos reais e alinhamento determinístico dos 21 pontos. A busca `abstract map paths` retornou bases territoriais incompatíveis; desenho SVG autoral foi necessário. O movimento dos pontos usa destinos calculados uma única vez a partir do array local, sem dados externos. Não foram enviadas mensagens de feedback externo.

Regras de craft aplicadas: `waterfall-entry` (entradas mascaradas e peso distinto), `svg-path-draw`, `3d-camera-flight` (poses diretamente nas propriedades GSAP, sem `onUpdate`), `spring-pop-entrance` (pontos em `power3.out`, sem bounce). Uma timeline raiz pausada; clips têm lifecycle do framework; não há timers/autoplay/eventos visuais.

O mundo e o vetor atravessam cenas; a composição permanece monolítica para conservar identidade e a direção contínua. Os oito avisos `nested_structure_needs_subcomposition` do lint são sugestões de organização em arquivos, aceitas conscientemente após revisão. Os grupos possuem IDs, faixas e tracks próprios. Os pontos são uma única camada SVG irmã da superfície dentro do mesmo mundo; seu alinhamento se conclui em 9,08 s e permanece visível quando a superfície desaparece, até a cobertura escura. A assinatura entra no host em 11,9 s e recebe wordmark desde 11,98 s; todo movimento termina em 13,31 s, mantendo 1,69 s de hold final.
