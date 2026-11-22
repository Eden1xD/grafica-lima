# Gráfica Lima — editor de certificados

## Conteúdo
- `modelo-gl-limpo.pdf`: modelo original com os textos variáveis removidos; mantém elementos gráficos, assinatura, logomarca e QR original de fundo (o QR atualizado cobre o antigo).
- `db/001_certificate_templates.sql`: nova tabela no Neon.
- `SCHEMA_ADICIONAR_AO_FINAL_DE_src_db_schema.ts`: adicionar o bloco ao final do schema atual.
- `src/lib/certificate-template.ts`: geração de PDF com dados reais e QR.
- `src/server/actions/certificate-models.ts`: upload, edição e publicação.
- `src/app/admin/certificados/modelos/`: editor administrativo.
- `src/app/api/certificados/modelos/[id]/arquivo/route.ts`: preview PDF com autenticação.
- `src/app/api/certificados/[code]/pdf/route.ts`: substituição da rota atual, com fallback para PDF anterior.

## Instalação
1. Faça backup do projeto e do banco. Copie os arquivos `src` preservando os caminhos. **Não substitua o schema inteiro**: adicione somente o bloco de tabela fornecido.
2. Execute `db/001_certificate_templates.sql` no SQL Editor do Neon (uma vez). Ou gere a migração Drizzle equivalente.
3. Verifique as dependências: `npm install pdf-lib qrcode` e `npm install -D @types/qrcode`.
4. Execute `npm run build` e ajuste possíveis diferenças específicas do seu projeto.
5. Entre em `/admin/certificados/modelos`, envie `modelo-gl-limpo.pdf`, ajuste campos e publique.
6. Adicione um link no menu do admin para `/admin/certificados/modelos`.

## Limitações importantes
- O editor mostra o PDF de fundo e marcadores; a visualização é aproximada. Para testar a emissão, use um certificado real após publicar.
- A versão atual armazena PDF base64 no Neon, adequada para poucos modelos e PDFs pequenos. Para grande volume, migre para Blob.
- As fontes PDF padrão removem acentos no texto inserido. Para produção com acentuação perfeita, incorpore uma fonte TTF Unicode.
- O PDF original tem elementos rasterizados, inclusive o QR de exemplo; o QR novo é aplicado sobre o antigo. A assinatura do instrutor é preservada como parte da arte.
- O gerador do verso limita o conteúdo à área útil; conteúdos extensos precisam de paginação adicional.
- Alterar o modelo publicado afeta PDFs baixados novamente; para imutabilidade histórica é necessário registrar o modelo/versão por certificado.
- Este pacote não foi testado contra o repositório completo: foram fornecidos trechos do projeto, não o checkout completo.
