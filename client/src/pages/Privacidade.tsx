import LegalLayout from "@/components/LegalLayout";

// Política de Privacidade — descreve o tratamento REAL de dados do sistema
// (conferido contra drizzle/schema.ts, _core/storage.ts e routers/geo.ts).
// Ao mudar o que o sistema coleta ou para onde envia, ATUALIZE esta página.
export default function Privacidade() {
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      atualizadoEm="21 de julho de 2026"
    >
      <p>
        Esta política explica como o <strong>Frapto Transp</strong> trata dados
        pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº
        13.709/2018 — LGPD).
      </p>

      <h2>1. Quem é o controlador dos dados</h2>
      <p>
        O Frapto Transp é um software de gestão de frota contratado por empresas
        de transporte. Nessa relação:
      </p>
      <ul>
        <li>
          <strong>A empresa contratante é a CONTROLADORA</strong> dos dados de
          seus motoristas, veículos e operações. É ela quem decide quais dados
          inserir, para qual finalidade e por quanto tempo mantê-los.
        </li>
        <li>
          <strong>A Frapto Tech é a OPERADORA</strong>, tratando esses dados em
          nome da contratante e segundo suas instruções.
        </li>
      </ul>
      <p>
        Se você é motorista e quer saber por que sua localização é registrada,
        fale primeiro com a empresa em que trabalha — é ela quem define isso.
      </p>

      <h2>2. Dados que coletamos</h2>

      <h3>2.1. De quem contrata (gestor)</h3>
      <ul>
        <li>
          Nome, e-mail e senha (armazenada apenas como hash bcrypt, nunca em
          texto)
        </li>
        <li>Nome da empresa</li>
        <li>Dados de assinatura e cobrança, processados pela Stripe</li>
        <li>Data e hora do último acesso</li>
      </ul>

      <h3>2.2. Dos motoristas cadastrados</h3>
      <ul>
        <li>Nome, CPF, número e categoria da CNH, e validade da CNH</li>
        <li>Telefone, e-mail e endereço, quando informados</li>
        <li>Data de admissão e observações registradas pela empresa</li>
        <li>Usuário e senha de acesso ao aplicativo do motorista</li>
      </ul>

      <h3>2.3. Localização (o ponto mais sensível)</h3>
      <p>
        Quando uma viagem está <strong>em andamento</strong>, o aplicativo do
        motorista registra periodicamente{" "}
        <strong>latitude, longitude, velocidade e horário</strong> do aparelho.
      </p>
      <ul>
        <li>
          A coleta ocorre{" "}
          <strong>somente enquanto a viagem está em andamento</strong>. Ao
          concluir ou cancelar a viagem, o registro cessa.
        </li>
        <li>
          A coleta{" "}
          <strong>continua com o aplicativo fechado ou em segundo plano</strong>
          , por meio de um serviço do Android. Isso é necessário para que o
          rastreamento não pare quando o motorista usa outro aplicativo, como um
          navegador de rotas.
        </li>
        <li>
          O aplicativo exibe um aviso de consentimento no primeiro acesso e
          mantém uma notificação enquanto o rastreamento está ativo.
        </li>
        <li>
          A posição é vinculada à viagem e ao veículo, e fica visível para os
          gestores da empresa contratante.
        </li>
      </ul>

      <h3>2.4. Operação e documentos</h3>
      <ul>
        <li>
          Veículos: placa, marca, modelo, ano, quilometragem, manutenções e
          vencimentos
        </li>
        <li>Viagens: origem, destino, datas, carga, distância e valores</li>
        <li>Financeiro: despesas, receitas e status de pagamento</li>
        <li>
          Documentos enviados (CNH, CRLV, notas e outros), armazenados na
          Cloudflare R2
        </li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>
          Prestar o serviço contratado: gestão de frota, viagens e financeiro
        </li>
        <li>Autenticar usuários e manter a segurança das contas</li>
        <li>Alertar sobre vencimentos de CNH, CRLV, seguro e manutenções</li>
        <li>Processar a assinatura do serviço</li>
        <li>Cumprir obrigações legais e regulatórias</li>
      </ul>
      <p>
        <strong>Não vendemos dados pessoais</strong> e não os usamos para
        publicidade ou perfilamento comercial.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Usamos os seguintes serviços de terceiros, cada um com finalidade
        específica:
      </p>
      <ul>
        <li>
          <strong>Railway</strong> — hospedagem da aplicação
        </li>
        <li>
          <strong>TiDB Cloud</strong> — banco de dados
        </li>
        <li>
          <strong>Cloudflare R2</strong> — armazenamento dos documentos enviados
        </li>
        <li>
          <strong>Stripe</strong> — processamento de pagamentos da assinatura
        </li>
        <li>
          <strong>OpenStreetMap (Nominatim), OSRM e OpenRouteService</strong> —
          conversão de endereços em coordenadas e cálculo de rotas. Recebem os
          endereços de origem e destino da viagem.
        </li>
        <li>
          <strong>Provedor de IA</strong> (Anthropic, OpenAI ou compatível) —
          apenas se a empresa contratante ativar o assistente. Nesse caso, dados
          da frota consultados durante a conversa são enviados ao provedor
          escolhido pela contratante.
        </li>
      </ul>

      <h2>5. Transferência internacional</h2>
      <p>
        Nossos servidores e banco de dados estão hospedados{" "}
        <strong>fora do Brasil</strong>, atualmente em infraestrutura nos
        Estados Unidos. Ao usar o serviço, os dados descritos acima são
        transferidos e armazenados nesse ambiente, com as proteções técnicas
        descritas no item 7.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          Dados operacionais e de localização: enquanto a assinatura estiver
          ativa, ou até que a empresa contratante os exclua.
        </li>
        <li>
          Após o encerramento da assinatura, os dados podem ser mantidos por até{" "}
          <strong>90 dias</strong> para permitir reativação, e depois excluídos
          mediante solicitação.
        </li>
        <li>
          Registros exigidos por lei (fiscais e contábeis) são mantidos pelo
          prazo legal aplicável.
        </li>
      </ul>

      <h2>7. Segurança</h2>
      <ul>
        <li>Todo o tráfego é criptografado em trânsito (HTTPS/TLS)</li>
        <li>Senhas são armazenadas apenas como hash bcrypt</li>
        <li>
          Isolamento entre empresas: cada consulta é restrita à organização do
          usuário autenticado, validada no servidor
        </li>
        <li>
          Motoristas têm acesso restrito às próprias viagens e{" "}
          <strong>não visualizam valores financeiros</strong>
        </li>
        <li>Limite de tentativas de login e revogação de sessões</li>
      </ul>
      <p>
        Nenhum sistema é totalmente imune a incidentes. Em caso de incidente de
        segurança relevante, comunicaremos as empresas afetadas e a ANPD
        conforme a LGPD.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        A LGPD garante a você: confirmação de tratamento, acesso, correção,
        anonimização, portabilidade, informação sobre compartilhamento,
        revogação de consentimento e eliminação dos dados.
      </p>
      <p>
        <strong>Motoristas:</strong> como a controladora é a empresa em que você
        trabalha, encaminhe seu pedido a ela. Se preferir, escreva para nós e
        repassaremos à contratante.
      </p>

      <h2>9. Contato</h2>
      <p>
        Dúvidas ou solicitações sobre dados pessoais:{" "}
        <a href="mailto:fraptotech@gmail.com">fraptotech@gmail.com</a>
      </p>

      <h2>10. Alterações</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão comunicadas
        pelo e-mail cadastrado ou por aviso dentro do sistema. A data da última
        atualização consta no topo desta página.
      </p>
    </LegalLayout>
  );
}
