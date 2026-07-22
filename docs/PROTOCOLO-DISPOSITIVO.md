# Protocolo de display sem conta

O LumaBoard 1.3 não possui banco de dados, autenticação ou servidor de pareamento. O fluxo suportado usa navegador, `localStorage`, Functions sem estado e uma URL compartilhável.

## 1. Gerar o link

O painel cria uma URL no formato:

```text
https://seu-site.netlify.app/?display=1#config=BASE64URL
```

O objeto codificado contém apenas o próximo compromisso e a sessão de foco. O fragmento `#config` não é enviado na requisição HTTP; ele é lido pelo navegador do display.

## 2. Dados dinâmicos

Cada display resolve sua própria localização e consulta:

- Open-Meteo e BigDataCloud para clima;
- `GET /api/public/summary?lat={latitude}&lon={longitude}&city={cidade}&state={UF}&tz={fuso}` para os cartões automáticos;
- `GET /api/public/search?type={tipo}&q={consulta}` somente quando o usuário faz uma pesquisa.

As duas rotas são Functions sem estado. Elas não identificam o display, não criam sessão e não salvam dados.

## 3. Atualização e fallback

O navegador salva o último clima, o último resumo e as últimas pesquisas no `localStorage`. O endpoint agregador usa cache HTTP e devolve resultados parciais quando apenas uma fonte falha.

## 4. Localização

O usuário pode:

1. permitir a localização da máquina;
2. usar a localização aproximada por IP;
3. pesquisar uma cidade e aplicá-la ao painel;
4. voltar a usar a localização da máquina.

A localização manual permanece naquele navegador até ser substituída.

## 5. Compatibilidade

| Dispositivo | Situação |
| --- | --- |
| Navegador desktop/mobile | suportado |
| Raspberry Pi em modo quiosque | suportado |
| Kindle/Kobo com navegador moderno | depende do motor do navegador |
| ESP32 e-paper | requer firmware ou serviço de renderização adicional |

## 6. O que exigiria backend persistente

Pareamento por código, sincronização instantânea, telemetria, revogação de dispositivos e envio remoto de frames exigem estado compartilhado. Essas funções não são simuladas.

## 7. Segurança

- Não coloque senhas, tokens ou dados sensíveis no link.
- Compartilhe o link somente com quem pode ver o compromisso e a tarefa.
- Use HTTPS.
- Mantenha as Functions com provedores fixos.
- Não transforme a rota de pesquisa em proxy de URL arbitrária.
- Respeite limites, licenças e atribuições das APIs públicas.
