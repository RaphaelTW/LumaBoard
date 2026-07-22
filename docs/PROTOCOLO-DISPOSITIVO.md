# Protocolo de display sem conta

Esta versão do LumaBoard não possui banco de dados, autenticação ou servidor de pareamento. O fluxo suportado é baseado em navegador e URL compartilhável.

## 1. Gerar o link

O painel cria uma URL no formato:

```text
https://seu-site.netlify.app/?display=1#config=BASE64URL
```

O objeto codificado contém apenas dados adequados à tela:

```json
{
  "event": {
    "id": "local-id",
    "title": "Revisão de projeto",
    "date": "2026-07-22",
    "time": "10:00"
  },
  "focus": {
    "project": "LumaBoard",
    "task": "Validar o display",
    "durationMinutes": 25,
    "remainingSeconds": 1500,
    "running": false,
    "endsAt": null
  }
}
```

O fragmento `#config` não é enviado na requisição HTTP. Ele é lido e decodificado no navegador do display.

## 2. Dados dinâmicos

Cada display resolve sua própria localização e consulta:

- Open-Meteo e BigDataCloud para clima;
- `GET /api/public/summary?lat={latitude}&lon={longitude}` para qualidade do ar, câmbio, feriado e notícias.

A rota de resumo é uma Function sem estado. Ela não identifica o display e não salva dados.

## 3. Atualização

O navegador mantém cache local e atualiza os dados em intervalos controlados. O endpoint agregador também envia `Cache-Control` para aproveitar o cache da CDN.

## 4. Compatibilidade

| Dispositivo | Situação nesta versão |
| --- | --- |
| Navegador desktop/mobile | suportado |
| Raspberry Pi em modo quiosque | suportado |
| Kindle/Kobo com navegador moderno | suporte depende do motor do navegador |
| ESP32 e-paper | requer firmware ou serviço de renderização adicional |

## 5. O que exigiria backend persistente

Pareamento por código, sincronização instantânea, telemetria, revogação de dispositivos e envio remoto de frames exigem um estado compartilhado. Essas funções foram removidas da interface em vez de serem simuladas.

## 6. Segurança

- Não coloque senhas, tokens ou dados sensíveis no link.
- Compartilhe o link somente com quem pode ver o compromisso e a tarefa codificados.
- Use HTTPS.
- Mantenha a Function com provedores fixos; não aceite proxy de URL arbitrária.
- Respeite limites e atribuições das APIs públicas.
