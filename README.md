# LumaBoard

> Painéis ambientes local-first, sem conta obrigatória, sem chave de API e sem banco de dados.

[![Next.js](https://img.shields.io/badge/Next.js-16-151713?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-151713?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-35513A?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Netlify](https://img.shields.io/badge/Netlify-ready-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-3D6545)](LICENSE)

O **LumaBoard 1.3** monta e exibe conteúdo para navegadores, e-readers, Raspberry Pi e futuras telas e-paper. Agenda, Pomodoro, playlists, fontes, pesquisas, localização escolhida e preferências ficam no `localStorage` do navegador. O servidor não mantém sessão e não grava SQLite, JSON ou banco.

## Princípio de custo

A arquitetura foi desenhada para não exigir assinatura de banco, autenticação, OAuth ou compra de chave de API:

- dados pessoais e configurações ficam no `localStorage`;
- respostas válidas das APIs também ficam em cache local;
- as rotas do Next.js funcionam como Netlify Functions **sem estado**;
- as Functions aceitam apenas provedores definidos no código;
- consultas mais pesadas são feitas somente quando o usuário envia o formulário;
- respostas públicas recebem `Cache-Control` para aproveitar a CDN;
- se uma fonte falhar, as outras continuam sendo exibidas e o navegador usa o último cache válido.

Isso evita um serviço persistente pago, mas não torna hospedagem e APIs ilimitadas. O plano gratuito do Netlify e cada provedor possuem cotas e termos próprios. Aumente o intervalo de atualização se o projeto receber muito tráfego.

## Executar localmente

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Validação:

```bash
npm test
npm run lint
npm run build
```

## Funcionalidades reais

- localização pela máquina, por IP aproximado ou por cidade pesquisada;
- clima atual, previsão horária e alerta de chuva;
- agenda local com inclusão e exclusão de compromissos;
- Pomodoro funcional, tarefa atual e duração configurável;
- qualidade do ar, câmbio, feriados, notícias, Selic, IPCA e dados do IBGE;
- terremotos mundiais e distância do evento mais próximo;
- altitude, vazão de rios, condição marítima e horários solares;
- livro e artigo em destaque, além da programação de TV disponível;
- pesquisa sob demanda de cidades, livros, Wikipédia, séries e alimentos;
- Biblioteca para ativar ou ocultar fontes opcionais;
- Estúdio, playlists e perfis de display persistidos localmente;
- modo display em tela cheia e link compartilhável no fragmento `#config`;
- backup e restauração em JSON de todas as chaves gerenciadas;
- tema claro e noturno;
- atualização configurável entre 5 e 60 minutos.

## APIs e serviços usados

Todas as integrações abaixo funcionam sem chave de acesso na configuração atual. Elas continuam sujeitas aos termos, limites, disponibilidade e atribuições de seus mantenedores.

### Navegador

| Recurso | Serviço | Uso no projeto | Persistência |
| --- | --- | --- | --- |
| Coordenadas da máquina | [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API) | localização com permissão do navegador | `lumaboard-location-v1` |
| Localização aproximada/reversa | [BigDataCloud Reverse Geocode Client](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | cidade, estado e país quando necessário | `lumaboard-location-v1` |
| Clima e alerta de chuva | [Open-Meteo Forecast](https://open-meteo.com/en/docs) | condição atual, mínima, máxima e precipitação horária | `lumaboard-weather-v1` |

### Resumo automático: `/api/public/summary`

| Cartão | API pública | Dados utilizados |
| --- | --- | --- |
| Qualidade do ar | [Open-Meteo Air Quality / CAMS](https://open-meteo.com/en/docs/air-quality-api) | AQI europeu e PM2.5 |
| Câmbio | [Frankfurter](https://frankfurter.dev/) | USD/BRL e EUR/BRL |
| Feriados | [BrasilAPI](https://brasilapi.com.br/docs) | próximo feriado nacional |
| Notícias | [Hacker News API](https://github.com/HackerNews/API) | histórias em destaque |
| Economia | [Banco Central do Brasil — SGS](https://dadosabertos.bcb.gov.br/) | Selic, série 1178, e IPCA, série 433 |
| Município | [IBGE Localidades](https://servicodados.ibge.gov.br/api/docs/localidades) | código, município, UF e regiões |
| População | [IBGE Agregados v3](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3) | estimativa populacional do município |
| Terremotos | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | eventos das últimas 24 horas |
| Altitude | [Open-Meteo Elevation](https://open-meteo.com/en/docs/elevation-api) | elevação das coordenadas |
| Rios | [Open-Meteo Flood](https://open-meteo.com/en/docs/flood-api) | vazão modelada e máxima prevista |
| Mar | [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) | ondas, temperatura do mar e corrente |
| Sol e Lua | [Sunrise-Sunset.org API v2](https://sunrise-sunset.org/api) | nascer/pôr do sol e duração do dia |
| Livro | [Open Library](https://openlibrary.org/developers/api) | sugestão rotativa de livro |
| Artigo | [Wikimedia REST API](https://www.mediawiki.org/wiki/Wikimedia_REST_API) | resultado rotativo da Wikipédia em português |
| TV e streaming | [TVmaze API](https://www.tvmaze.com/api) | programação disponível para o Brasil |

### Consultas sob demanda: `/api/public/search`

| Tipo | Fontes | Comportamento |
| --- | --- | --- |
| `location` | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api), com [OpenStreetMap Nominatim](https://nominatim.org/release-docs/latest/api/Search/) apenas como fallback | pesquisa somente ao enviar; permite aplicar a cidade ao painel |
| `book` | [Open Library](https://openlibrary.org/developers/api) | busca por título, autor ou assunto |
| `wikipedia` | [Wikimedia REST API](https://www.mediawiki.org/wiki/Wikimedia_REST_API) | busca de páginas em português |
| `tv` | [TVmaze API](https://www.tvmaze.com/api) | busca de séries e metadados |
| `food` | [Open Food Facts API v3.6](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/) | leitura de produto por código de barras |

O Nominatim só é consultado quando o Open-Meteo Geocoding não encontra resultados. A busca acontece apenas após o envio do formulário, passa por cache, identifica a aplicação e exibe atribuição ao OpenStreetMap; não existe autocomplete a cada tecla. O Open Food Facts usa a API v3.6 somente para leitura, com `User-Agent`, e a Open Library também é usada em baixo volume e por ação do usuário.

## Functions sem estado

### Resumo

```http
GET /api/public/summary?lat=-23.5505&lon=-46.6333&city=São%20Paulo&state=SP&tz=America/Sao_Paulo
```

A rota executa as fontes em paralelo com `Promise.allSettled`. Uma falha não invalida todo o resumo. O JSON inclui `warnings` com os provedores temporariamente indisponíveis.

### Pesquisa

```http
GET /api/public/search?type=location&q=Curitiba
GET /api/public/search?type=book&q=design
GET /api/public/search?type=wikipedia&q=computação
GET /api/public/search?type=tv&q=dark
GET /api/public/search?type=food&q=7891000100103
```

Os tipos são uma allowlist. A rota não aceita URL externa arbitrária e, portanto, não funciona como proxy aberto.

## Cache e `localStorage`

| Chave | Conteúdo |
| --- | --- |
| `lumaboard-agenda` | compromissos locais |
| `lumaboard-focus` | projeto, tarefa e estado do Pomodoro |
| `lumaboard-public-data-v2` | último resumo válido das APIs públicas |
| `lumaboard-public-explorer-v1` | últimas consultas e resultados sob demanda |
| `lumaboard-refresh-minutes` | intervalo automático das fontes |
| `lumaboard-location-v1` | última localização automática ou manual |
| `lumaboard-weather-v1` | último clima válido |
| `lumaboard-studio` | rascunho do Estúdio |
| `lumaboard-playlist` | playlist local |
| `lumaboard-devices` | perfis locais de display |
| `lumaboard-plugins` | fontes opcionais visíveis |
| `lumaboard-rules` | alerta de chuva e histórico |

A versão 1.3 reconhece a seleção padrão da versão 1.2 e ativa as novas fontes sem apagar os demais dados. A chave antiga `lumaboard-public-data-v1` permanece na lista de backup para permitir migração e pode ser removida manualmente depois.

O `localStorage` pertence ao navegador e à origem do site. Limpar os dados do site apaga as configurações. Navegadores diferentes não sincronizam automaticamente; use **Automação → Exportar JSON** para transportar os dados.

## Publicar no Netlify

| Campo | Valor |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node.js | `22.13.0` ou superior |
| Variáveis de ambiente | nenhuma obrigatória |
| Banco de dados | nenhum |

O adaptador do Netlify para Next.js publica os Route Handlers como Functions. Não configure SQLite, arquivo JSON gravável, Netlify Database ou serviço externo para esta versão.

O plano Free atual do Netlify é gratuito e possui limite mensal rígido. Se a cota acabar, o projeto pode ser pausado até o próximo ciclo. Use o cache de 15 minutos, mantenha as pesquisas sob demanda e acompanhe **Usage & billing** no painel do Netlify.

## Compartilhar um display sem banco

Use **Gerar link do display**. O LumaBoard cria:

```text
/?display=1#config=...
```

O fragmento após `#` é processado no navegador e não é enviado ao servidor. O aparelho que abrir o link consulta seu próprio clima e as APIs públicas. Não coloque senhas, tokens ou informações sensíveis nesse link.

Sincronização contínua, revogação remota, telemetria real e envio de frames a um ESP32 exigiriam estado compartilhado e não fazem parte desta arquitetura gratuita.

## Arquitetura

```mermaid
flowchart TD
    Browser["Next.js + React"] --> Local[("localStorage")]
    Browser --> Geo["Geolocation + BigDataCloud"]
    Browser --> Weather["Open-Meteo Forecast"]
    Browser --> Summary["/api/public/summary"]
    Browser --> Search["/api/public/search"]
    Summary --> PublicAPIs["APIs públicas allowlisted"]
    Search --> SearchAPIs["Consultas públicas allowlisted"]
    Summary --> CDN["Cache HTTP / CDN"]
    Search --> CDN
    Browser --> Display["Modo display / link #config"]
```

| Parte | Arquivo | Responsabilidade |
| --- | --- | --- |
| Shell | `app/LumaBoardApp.tsx` | navegação, prévia e cartões públicos |
| Dados locais | `app/local-widgets.ts` | agenda e temporizador persistentes |
| Clima | `app/weather.ts` | localização, previsão, local manual e cache |
| Resumo público | `app/public-data.ts` | cliente, validação, atualização e fallback local |
| Pesquisas | `app/public-explorer.tsx` | consultas sob demanda e aplicação de local |
| Function de resumo | `app/api/public/summary/route.ts` | agregação paralela sem estado |
| Function de pesquisa | `app/api/public/search/route.ts` | pesquisa allowlisted sem estado |
| Módulos | `app/modules.tsx` | Estúdio, playlists, displays, Biblioteca e automação |
| Backup | `app/storage.ts` | chaves gerenciadas, migração, exportação e importação |
| Visual | `app/globals.css` | temas e responsividade |

## Privacidade

Nenhuma conta, senha ou chave de API é solicitada. Coordenadas, cidade e termos pesquisados são enviados somente aos serviços necessários para responder à ação do usuário. O código da Function não grava essas requisições. Provedores externos e a plataforma de hospedagem podem manter logs conforme suas próprias políticas.

Para apagar os dados locais, limpe os dados do site no navegador. Para transportar as configurações, exporte o backup JSON.

## Licença e atribuições

O LumaBoard é distribuído sob a [Licença MIT](LICENSE). Dados e marcas externas permanecem sujeitos às licenças dos respectivos provedores. Preserve os links de atribuição exibidos na interface, especialmente OpenStreetMap, Open-Meteo/CAMS/DWD, Sunrise-Sunset.org, Open Food Facts, Open Library, Wikimedia e TVmaze.
