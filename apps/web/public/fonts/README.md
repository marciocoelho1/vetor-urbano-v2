# Fontes da versão visual 02

Desde a escolha da proposta 6 em 14/10/2026, Manrope é usada nos títulos, textos e controles da interface principal. Newsreader permanece nas alternativas da galeria; seus arquivos e licenças foram preservados. Manrope foi escolhida após o responsável aprovar uma alternativa gratuita semelhante à Mori, sem integração futura para a fonte proprietária.

Arquivos WOFF2 congelados em 11/10/2026 a partir da distribuição oficial Google Fonts; subconjuntos Latin e Latin Extended, com pesos variáveis 400–700. Latin inclui os caracteres portugueses usuais; Latin Extended amplia a cobertura. Não foram alterados os arquivos das fontes. Os arquivos TTF intermediários não integram o repositório.

| Família | Arquivos | Origem oficial | Licença local |
|---|---|---|---|
| Newsreader | `newsreader-latin.woff2`, `newsreader-latin-ext.woff2` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/newsreader) / Production Type | [newsreader-OFL.txt](newsreader-OFL.txt) |
| Manrope | `manrope-latin.woff2`, `manrope-latin-ext.woff2` | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope) / Manrope Project Authors | [manrope-OFL.txt](manrope-OFL.txt) |

URL dos arquivos utilizados:

- Newsreader Latin: `https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK4397yjA.woff2`
- Newsreader Latin Extended: `https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK439DyjJBG.woff2`
- Manrope Latin: `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2`
- Manrope Latin Extended: `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggmxSuXd.woff2`

As licenças SIL Open Font License 1.1 acompanham os arquivos. A aplicação serve as fontes localmente e usa Georgia/Segoe UI como alternativas caso uma fonte não carregue. Não há chamadas a Google Fonts em tempo de uso nem arquivos de Mori.

## Fonte incorporada no PDF — 17/10/2026

`manrope-pdf-regular.ttf` deriva exclusivamente do `manrope-latin.woff2` acima, com peso estático 400; os WOFF2 originais permanecem inalterados. Mesma autoria (Manrope Project Authors), origem Google Fonts congelada em 11/10/2026 e licença [SIL OFL 1.1](manrope-OFL.txt), que permite modificação/incorporação. Não houve nova fonte externa, requisição a serviços de fontes ou alteração de licença.

Derivação reproduzível: `scripts/prepare-pdf-font.py` com FontTools 4.67.0 e Brotli 1.2.0 (ferramentas de preparação, sem dependência Python no aplicativo). Converte WOFF2 para TTF e instancia wght=400. O PDF incorpora um subconjunto e mantém letras separadas para extração. A biblioteca falhava em glifos compostos WOFF2 (`fi`, `:`, `;`); conversão TTF do mesmo arquivo corrigiu o caso, inclusive sem mudar o eixo variável, antes da escolha do peso estático. [Relato primário da limitação do recorte WOFF2](https://github.com/Hopding/pdf-lib/issues/1396).

Limite: subconjunto Latin, sem cobertura universal de alfabetos/emoji. Caracteres não representáveis geram erro visível, sem substituir silenciosamente os textos nem baixar arquivo parcial. A apresentação da aplicação continua usando os WOFF2 existentes.
