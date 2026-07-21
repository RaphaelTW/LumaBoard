# Protocolo de dispositivo LumaBoard

Este documento descreve o contrato recomendado para conectar ESP32, Raspberry Pi, e-readers ou navegadores ao LumaBoard.

## 1. Pareamento

O dispositivo gera um código curto, por exemplo `LUMA-4821`. O backend troca esse código por um token de leitura com escopo exclusivo para aquele dispositivo.

```http
POST /api/pair
Content-Type: application/json

{
  "code": "LUMA-4821",
  "model": "esp32-s3",
  "width": 800,
  "height": 480,
  "palette": "4-gray"
}
```

## 2. Buscar a próxima tela

```http
GET /api/display/{token}
If-None-Match: "sha256-do-frame-anterior"
```

Resposta quando a tela mudou:

```http
HTTP/1.1 200 OK
Content-Type: image/png
ETag: "sha256-do-frame"
X-Luma-Refresh-After: 900
X-Luma-Palette: 4-gray
X-Luma-Width: 800
X-Luma-Height: 480
```

Resposta sem mudanças:

```http
HTTP/1.1 304 Not Modified
X-Luma-Refresh-After: 900
```

## 3. Telemetria opcional

```http
POST /api/device/{token}/status
Content-Type: application/json

{
  "battery": 82,
  "rssi": -54,
  "firmware": "1.0.0",
  "last_frame_hash": "sha256-do-frame"
}
```

## 4. Segurança mínima

- Token diferente para cada dispositivo.
- Token somente de leitura para buscar frames.
- TLS obrigatório fora da rede local.
- Rotação e revogação de token pelo painel.
- Limite de requisições por dispositivo.
- Nunca enviar senha de Wi-Fi ou credencial de plugin na resposta do display.
- Comparar `ETag` para evitar downloads e refreshes desnecessários.

## 5. Formatos

| Dispositivo | Formato recomendado |
| --- | --- |
| ESP32 e-paper | PNG indexado, BMP 1-bit ou buffer compactado |
| Kindle/Kobo | PNG em escala de cinza |
| Navegador | HTML responsivo ou PNG |
| Raspberry Pi | PNG, WebP ou HTML em quiosque |

O renderizador deve respeitar largura, altura e paleta informadas no pareamento.
