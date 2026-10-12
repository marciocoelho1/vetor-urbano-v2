# Evidências da entrega — 12/10/2026

**Entrega concluída:** `renders/vetor-urbano-showreel-15s.mp4`, 4.583.660 bytes, 15,000 s, 1920 × 1080, 60 fps, 900 quadros, H.264/AAC estéreo a 48 kHz. Fontes completos em `index.html`, assets locais e trilha reproduzível em Python.

SHA-256 do MP4: `cbfb3fbc735abe166de4e5ac53df980eba9693a62312910ac4331389d1d69b34`.

SHA-256 da composição renderizada: `db2da1e244e10d0d241966f3e12dbcaa9a1b89b6d8c612ca78eeda68bf5d2658`.

## Verificações executadas

| Comando/evidência | Resultado observado |
|---|---|
| `npx hyperframes@latest upgrade --project . --check` | Pin 0.8.150 já atual; nenhuma atualização adicional do projeto. |
| `npx hyperframes doctor --json` | Node 22.23.1, FFmpeg 8.1.3, FFprobe e Chrome disponíveis. O resultado geral é `ok:false` por Docker, transcrição e geradores opcionais ausentes; esses recursos não são usados no render local. Não se declara doctor inteiramente aprovado. |
| `python3 tools/make_soundtrack.py` + FFmpeg `volumedetect` | 15 s, estéreo PCM 48 kHz; seed fixo; pico −2,6 dBFS e volume médio −19,5 dBFS, sem amostras da referência. |
| `npx hyperframes check --samples 32 --json` | `ok:true`, navegador executado; **zero erros**. Runtime, layout, motion e contraste sem warnings. Oito recomendações estruturais no lint; 17 informações sobre máscaras/entradas/saídas. |
| `index.motion.json` no check | Oito condições de aparecimento, enquadramento e continuidade verificadas em **300 amostras**, sem achados. |
| Contraste do check | 21 verificações passaram em cinco instantes. Amostragem da composição; não representa certificação de acessibilidade do vídeo. |
| Snapshots + inspeção visual | 21 quadros de abertura, holds, seams e final; primeiro/final deliberados, frases legíveis e avisos fictícios visíveis nas cenas cartográficas. Erros da primeira passagem corrigidos antes do render. |
| `npx hyperframes keyframes` + `renders/map-motion-proof.png` | Vetor e poses cartográficas registrados. O diagnóstico estático não enumera todas as entradas criadas pelo helper; os pixels de snapshots e os 300 seeks são a evidência complementar. |
| `npx hyperframes preview --background --port 3017` + `--status` + HTTP | Preview persistente ativo, HTTP 200: `http://localhost:3017/#project/showreel`. |
| `npm run render -- --workers 4` | 900 quadros; captura **BeginFrame/GPU hardware**, quatro workers; render concluído em 11,7 s. Sem fallback de captura. |
| `npm run verify:output` | Todas as sete condições passaram: duração, dimensões, FPS, 900 quadros, H.264, AAC estéreo/48 kHz e decodificação integral de áudio/vídeo sem erros. Relatórios em `renders/verification.json` e `renders/ffprobe.json`. |
| `renders/render-proof.jpg` e `renders/poster.png` | Extraídos do MP4 final e inspecionados, confirmando o resultado efetivamente codificado. |
| `bash scripts/verify.sh planning` e `git diff --check` | Verificação estrutural/documental e whitespace passaram. Nenhuma mudança na aplicação Angular; testes web/API não foram usados como evidência deste vídeo. |
| Preservação por SHA-256 | 16 arquivos existentes conferidos, incluindo alterações prévias do responsável e o MP4 antigo, sem mudanças inesperadas. `PLAN.md` recebeu apenas o registro deste incremento. |

## Ajustes resolvidos

A primeira passagem revelou sobreposição de frases na transição de abertura. As palavras novas agora entram depois da saída anterior, mantendo o vetor. O primeiro quadro passou a ter marca/ponto visíveis. Os pontos do mapa foram mantidos na mesma instância, em uma camada independente da superfície, para mostrar seu alinhamento antes da expansão escura. Filtros entram por máscara em vez de alpha no fundo/texto, evitando perda transitória de contraste. A saída da frase de benefício termina antes de cruzar a assinatura. A marca usa o SVG exato da aplicação, sem redesenho.

## Decisão e limites

Os **oito avisos `nested_structure_needs_subcomposition`** recomendam arquivos de subcomposição por grupo. São conhecidos e permanecem visíveis no relatório. A peça mantém uma única composição com grupos/trilhas porque câmera, ponto e cartografia atravessam os capítulos; isso conserva a continuidade e simplifica os seeks. O trade-off é menor independência de edição por capítulo no Studio. Nenhum aviso foi desativado e `--strict` não é declarado como aprovado.

Cartografia abstrata, 21 pontos fictícios, filtros demonstrativos e indicação de protótipo. Não há estatísticas reais, alegação de cobertura, alerta ou tempo real. A revisão visual usou quadros, transições e integridade do arquivo; não foi registrada avaliação perceptiva por público externo ou auditoria de fotossensibilidade. Sem publicação, contratação de serviço, dados reais, alteração de banco/API ou troca de provedor.

Próxima ação: assistir ao MP4 com som e alinhar eventuais refinamentos criativos. Este incremento não inicia outro marco do produto. O vídeo anterior permanece preservado, e a ausência de seus fontes finais continua documentada na auditoria anterior; o novo filme possui sua própria fonte final completa.
