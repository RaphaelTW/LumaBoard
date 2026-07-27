import { LegalPage } from "../legal-page";
export default function PrivacyPage() { return <LegalPage title="Aviso de Privacidade" updated="27 de julho de 2026">
  <h2>1. Modelo local-first</h2><p>As informações pessoais criadas no LumaBoard ficam, em regra, no armazenamento do navegador. O projeto não mantém cadastro central de usuários.</p>
  <h2>2. Informações armazenadas localmente</h2><p>Podem ser salvos agenda, tarefas, temas, layouts, favoritos, histórico de notificações, cache de APIs, consentimentos e configurações da PWA.</p>
  <h2>3. Serviços externos</h2><p>Ao usar clima, localização, notícias, música e outras integrações, o navegador ou as Functions sem estado podem enviar dados técnicos como endereço IP, coordenadas escolhidas e parâmetros de busca aos provedores descritos no README.</p>
  <h2>4. Publicidade e estatísticas</h2><p>Não há publicidade nem análise comportamental externa na v1.8.3. Uma futura ativação exigirá atualização deste aviso e nova oportunidade de escolha antes do carregamento de tecnologias opcionais.</p>
  <h2>5. Retenção e exclusão</h2><p>Dados locais permanecem até serem apagados pelo usuário, pelo navegador ou por restauração do aplicativo. O LumaBoard oferece backup, limpeza de cache e restauração de configurações.</p>
  <h2>6. Direitos e escolhas</h2><p>O usuário pode consultar, exportar e apagar os dados locais pelo próprio aplicativo. Preferências opcionais podem ser revistas pelo botão Privacidade.</p>
  <h2>7. Segurança</h2><p>O projeto limita tamanho de importações, valida backups e isola dados corrompidos, mas nenhum sistema é isento de riscos. Evite armazenar informações altamente sensíveis.</p>
</LegalPage>; }
