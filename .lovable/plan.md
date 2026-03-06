
# Corrigir Webhook da CNH para usar o Proxy (evitar CORS)

## Problema Identificado

- O cadastro de veiculo ja funciona corretamente: envia dados via `webhook-proxy` para o n8n (`/webhook/validarcarro`), espera a resposta, e atualiza o status do veiculo (aprovado/reprovado). Os screenshots confirmam que esta funcionando.
- A verificacao de CNH tem um problema: ela chama o n8n **diretamente** pelo browser (`fetch("https://n8n.srv1153225.hstgr.cloud/webhook/cnhcheck")`), o que pode ser bloqueado por CORS no navegador. Precisa ser roteada pelo mesmo `webhook-proxy` que ja funciona para veiculos.

## Alteracoes Necessarias

### 1. Adicionar rota `cnhcheck` no webhook-proxy

**Arquivo:** `supabase/functions/webhook-proxy/index.ts`

Adicionar `"cnhcheck"` ao mapa `ALLOWED_URLS`:

```text
ALLOWED_URLS = {
  "validarcarro": "https://n8n.srv1153225.hstgr.cloud/webhook/validarcarro",
  "oli-contrato": "https://n8n.srv1153225.hstgr.cloud/webhook/oli-contrato",
  "cnhcheck": "https://n8n.srv1153225.hstgr.cloud/webhook/cnhcheck",   // NOVO
};
```

### 2. Atualizar DriverLicenseForm.tsx para usar o proxy

**Arquivo:** `src/pages/DriverLicenseForm.tsx`

Substituir o `fetch` direto (linhas ~196-215) por `supabase.functions.invoke("webhook-proxy")`, passando `_webhook_target: "cnhcheck"` no body. Isso garante que a requisicao vai pelo servidor (edge function), evitando bloqueio de CORS.

Antes:
```typescript
const webhookResponse = await fetch(
  "https://n8n.srv1153225.hstgr.cloud/webhook/cnhcheck",
  { method: "POST", headers: {...}, body: JSON.stringify({...}) }
);
```

Depois:
```typescript
const { data: webhookData, error: webhookError } = await supabase.functions.invoke(
  "webhook-proxy",
  {
    body: {
      _webhook_target: "cnhcheck",
      user_id: user.id,
      full_name: fullName,
      license_number: licenseNumber,
      category,
      cpf,
      codigo_seguranca: codigoSeguranca,
      nome_mae: nomeMae,
      front_image_url: frontUrl,
      back_image_url: backUrl,
      selfie_image_url: selfieUrl,
    },
  }
);
```

Adaptar o parsing da resposta para usar `webhookData` (que ja vem como objeto/JSON do `supabase.functions.invoke`) em vez de `response.text()`.

### 3. Resumo do que nao muda

- A UI de timer/progresso da CNH ja existe e continua funcionando
- A UI de timer/progresso do veiculo ja existe e continua funcionando
- A logica de aprovado/reprovado e atualizacao no banco ja existe em ambos os fluxos
- O envio de email de notificacao ja existe em ambos os fluxos
- Nenhuma outra pagina sera alterada

### Detalhes Tecnicos

| Item | Veiculo (ja funciona) | CNH (sera corrigido) |
|---|---|---|
| Proxy | webhook-proxy | webhook-proxy (novo) |
| Target n8n | /webhook/validarcarro | /webhook/cnhcheck |
| Timeout | 90s via AbortController | 90s (mantido) |
| Resposta | Sincrona do n8n | Sincrona do n8n |
| Status update | oli_vehicles.status | oli_driver_licenses.status |
