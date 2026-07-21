import LegalLayout from "@/components/LegalLayout";

// Termos de Serviço. Preço e regras de cobrança precisam bater com o
// Landing.tsx / Paywall.tsx e com o preço configurado na Stripe.
export default function Termos() {
  return (
    <LegalLayout titulo="Termos de Serviço" atualizadoEm="21 de julho de 2026">
      <p>
        Estes termos regem o uso do <strong>Frapto Transp</strong>, sistema de
        gestão de frota fornecido pela Frapto Tech. Ao criar uma conta, você
        declara que leu e concorda com eles.
      </p>

      <h2>1. O que é o serviço</h2>
      <p>
        O Frapto Transp é um software de gestão de transporte oferecido por
        assinatura, com cadastro de veículos, motoristas e viagens, controle de
        manutenções, gestão financeira, relatórios, envio de documentos,
        assistente de inteligência artificial e rastreamento de viagens pelo
        aplicativo do motorista.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>
          Você precisa fornecer informações verdadeiras e manter seus dados
          atualizados.
        </li>
        <li>
          Você é responsável por manter a senha em sigilo e por todas as
          atividades realizadas na sua conta.
        </li>
        <li>
          O uso é destinado a pessoas jurídicas ou profissionais autônomos do
          setor de transporte.
        </li>
      </ul>

      <h2>3. Assinatura e pagamento</h2>
      <ul>
        <li>
          O valor é de <strong>R$ 57,00 por mês</strong>, cobrado de forma
          recorrente.
        </li>
        <li>
          O pagamento é processado pela <strong>Stripe</strong>. Não armazenamos
          os dados do seu cartão.
        </li>
        <li>
          A cobrança se renova automaticamente a cada mês até que você cancele.
        </li>
        <li>
          <strong>Não há período de teste gratuito.</strong> O acesso às funções
          do sistema é liberado após a confirmação do pagamento.
        </li>
        <li>
          Em caso de falha no pagamento, o acesso pode ser suspenso até a
          regularização.
        </li>
      </ul>

      <h2>4. Cancelamento</h2>
      <p>
        Você pode cancelar quando quiser, sem multa. O acesso permanece até o
        fim do período já pago, e não há reembolso proporcional de períodos em
        curso. Para cancelar, entre em contato pelo e-mail no item 11.
      </p>

      <h2>5. Suas responsabilidades sobre os dados</h2>
      <p>
        Você é o <strong>controlador</strong> dos dados que insere no sistema —
        inclusive os dados pessoais dos seus motoristas. Isso significa que cabe
        a você:
      </p>
      <ul>
        <li>
          Ter <strong>base legal</strong> para tratar esses dados, incluindo a
          localização dos motoristas durante as viagens.
        </li>
        <li>
          <strong>Informar seus motoristas</strong> de forma clara que a
          localização deles será registrada enquanto a viagem estiver em
          andamento, inclusive com o aplicativo fechado.
        </li>
        <li>
          Usar o rastreamento apenas para{" "}
          <strong>finalidade legítima ligada ao trabalho</strong>, durante a
          jornada, e não para monitorar o motorista fora dela.
        </li>
        <li>
          Atender aos pedidos dos titulares sobre os dados que você inseriu.
        </li>
      </ul>
      <p>
        A Frapto Tech atua como <strong>operadora</strong> e trata esses dados
        conforme suas instruções. Veja a{" "}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>6. Uso aceitável</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>Usar o sistema para atividade ilícita</li>
        <li>
          Rastrear pessoas sem o conhecimento delas ou fora do contexto de
          trabalho
        </li>
        <li>
          Tentar acessar dados de outras empresas, burlar limites ou explorar
          falhas de segurança
        </li>
        <li>Compartilhar credenciais com terceiros não autorizados</li>
        <li>Revender ou sublicenciar o sistema sem autorização</li>
      </ul>
      <p>O descumprimento pode levar à suspensão ou encerramento da conta.</p>

      <h2>7. Assistente de inteligência artificial</h2>
      <p>
        Se você ativar o assistente, os dados da sua frota consultados durante a
        conversa são enviados ao provedor de IA que <strong>você</strong>{" "}
        configurar. As respostas são geradas automaticamente e{" "}
        <strong>podem conter erros</strong> — confira informações críticas antes
        de tomar decisões com base nelas.
      </p>

      <h2>8. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas não garantimos
        funcionamento ininterrupto. Pode haver indisponibilidade por manutenção,
        falha de terceiros ou causas fora do nosso controle. Recomendamos manter
        backup próprio das informações críticas.
      </p>
      <p>
        O rastreamento depende do aparelho do motorista: sinal de GPS, bateria,
        conexão de internet e permissões do sistema operacional. Falhas nesses
        fatores podem gerar lacunas no trajeto registrado.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        O serviço é fornecido no estado em que se encontra. Na máxima extensão
        permitida em lei, nossa responsabilidade total fica limitada ao valor
        pago por você nos <strong>12 meses</strong> anteriores ao fato. Não
        respondemos por lucros cessantes ou danos indiretos.
      </p>
      <p>
        Nada aqui afasta direitos que a lei brasileira garanta de forma
        imperativa.
      </p>

      <h2>10. Alterações e encerramento</h2>
      <p>
        Podemos alterar estes termos e avisaremos com antecedência razoável por
        e-mail ou dentro do sistema. Se você não concordar, pode cancelar.
        Podemos encerrar contas que violem estes termos, com aviso prévio quando
        cabível.
      </p>

      <h2>11. Contato e foro</h2>
      <p>
        Contato: <a href="mailto:fraptotech@gmail.com">fraptotech@gmail.com</a>
      </p>
      <p>
        Estes termos são regidos pelas leis brasileiras, eleito o foro do
        domicílio do contratante para dirimir controvérsias.
      </p>
    </LegalLayout>
  );
}
