# OLI - n8n da caucao via Asaas

Estes arquivos criam um fluxo novo de caucao via Asaas sem alterar os workflows ja existentes.

## Arquivos

- `oli-caucao-asaas-create.json`: recebe a requisicao do front e cria a cobranca da caucao.
- `oli-caucao-asaas-callback.json`: recebe o webhook de status da Asaas e atualiza `oli_payments` no Supabase.
- `oli-caucao-asaas-release.json`: libera manualmente a garantia do escrow quando locador e plataforma aprovarem.

## Endpoints criados

- `POST /webhook/oli-caucao-asaas`
- `POST /webhook/oli-caucao-asaas-callback`
- `POST /webhook/oli-caucao-asaas-release`

## Variaveis exigidas no n8n

- `ASAAS_API_BASE_URL`
  - producao: `https://api.asaas.com/v3`
  - sandbox: `https://api-sandbox.asaas.com/v3`
- `ASAAS_CAUCAO_API_KEY`
  - chave da conta ou subconta que vai receber a caucao
- `ASAAS_WEBHOOK_TOKEN`
  - token configurado no webhook da Asaas; sera validado no header `asaas-access-token`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Pre-requisito importante

Para a retencao real da caucao acontecer, a conta usada em `ASAAS_CAUCAO_API_KEY` precisa estar com Conta Escrow habilitada no Asaas. Sem isso, a cobranca sera criada normalmente, mas o valor nao ficara travado em garantia.

Referencia oficial da Asaas:
- Introducao da Conta Escrow: `https://docs.asaas.com/docs/introducao-conta-escrow`
- Habilitacao para subcontas: `https://docs.asaas.com/docs/habilitando-a-conta-escrow-para-as-subcontas`
- Consulta da garantia: `https://docs.asaas.com/reference/recuperar-garantia-da-cobranca-na-conta-escrow`
- Liberacao manual: `https://docs.asaas.com/reference/encerrar-garantia-da-cobranca-na-conta-escrow`
- Criacao de cliente: `https://docs.asaas.com/docs/criando-um-cliente`
- Criacao de cobranca: `https://docs.asaas.com/reference/create-new-payment`
- Webhooks: `https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook`

## Payload esperado do front em `/webhook/oli-caucao-asaas`

```json
{
  "event": "deposit_escrow_requested",
  "provider": "asaas",
  "payment_type": "deposit",
  "rental_id": "uuid",
  "user_id": "uuid",
  "vehicle_id": "uuid",
  "amount": 800,
  "due_date": "2026-04-02",
  "customer": {
    "name": "Nome do locatario",
    "email": "[email protected]",
    "cpfCnpj": "12345678900",
    "phone": "11999999999"
  },
  "vehicle": {
    "title": "HB20 2024",
    "plate": "ABC1D23"
  },
  "escrow": {
    "enabled": true,
    "release_condition": "manual_after_owner_and_platform_approval",
    "release_checklist": [
      "devolucao_do_veiculo",
      "vistoria_final_aprovada",
      "aval_do_locador",
      "aval_da_plataforma_oli"
    ]
  }
}
```

## Resposta devolvida ao front

O workflow de criacao responde num formato compativel com o modal ja pronto no front:

```json
{
  "success": true,
  "provider": "asaas",
  "payment_type": "deposit",
  "status": "pending",
  "id": "pay_xxx",
  "provider_payment_id": "pay_xxx",
  "provider_customer_id": "cus_xxx",
  "external_reference": "OLI-CAUCAO-<rental_id>",
  "invoice_url": "https://www.asaas.com/i/xxx",
  "payment_link": "https://www.asaas.com/i/xxx",
  "bank_slip_url": null,
  "due_date": "2026-04-02",
  "message": "Cobranca de caucao criada na Asaas..."
}
```

## Como ligar o callback da Asaas

No painel da Asaas, configure um webhook apontando para:

- `https://SEU_N8N/webhook/oli-caucao-asaas-callback`

Eventos minimos:

- `PAYMENT_CREATED`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`
- `PAYMENT_REFUNDED`
- `PAYMENT_DELETED`

## Observacao sobre a arquitetura atual

Os workflows foram adicionados do zero e isolados. Nenhum workflow existente foi alterado.
