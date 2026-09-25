// Textos institucionais (termos, privacidade, cancelamento, contato).
// PRIMEIRA VERSÃO, redigida a partir do funcionamento real da plataforma — deve ser revisada
// por um advogado antes de ser considerada definitiva.
//
// ⚠️ Preencha os dados da empresa abaixo (aparecem no rodapé e em todas as páginas legais).

export const COMPANY = {
  marca: "GN Coleciona",
  razaoSocial: "FDN Design", // confirmar a razão social completa conforme o CNPJ
  cnpj: "54942672/0001-45",
  endereco: "Rua dos Jaborandis, 206 - CEP 92412-480 - Bairro Igara, Canoas/RS",
  email: "contato@fdndesign.com.br",
  site: "www.gncoleciona.com.br",
  foro: "Canoas/RS",
};

export const LEGAL_UPDATED = "25 de setembro de 2026";

export interface LegalSection {
  h: string;
  p?: string[];
  ul?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string[];
  sections: LegalSection[];
}

const C = COMPANY;

export function termosDeUso(trialDays: number, graceDays: number): LegalDoc {
  return {
    title: "Termos de uso",
    intro: [
      `Estes Termos regulam o uso da ${C.marca} (${C.site}), plataforma operada por ${C.razaoSocial}, inscrita no CNPJ ${C.cnpj}, com sede em ${C.endereco}. Ao criar uma conta ou usar a plataforma, você declara que leu e concorda com estes Termos e com a Política de Privacidade.`,
    ],
    sections: [
      {
        h: "1. O que é a GN Coleciona",
        p: [
          "A GN Coleciona é uma ferramenta para colecionadores de figurinhas. Ela oferece: (a) a Coleção, gratuita, para registrar as figurinhas que você tem, as repetidas e as que faltam; e (b) a Loja, por assinatura, que transforma as suas figurinhas repetidas em um catálogo público com preços definidos por você, no qual compradores montam pedidos que são enviados ao seu WhatsApp.",
          "A GN Coleciona é apenas uma vitrine tecnológica: não compra, não vende, não recebe pagamentos das vendas entre usuários, não faz entregas e não é parte das negociações entre lojistas e compradores.",
        ],
      },
      {
        h: "2. Definições",
        ul: [
          "Usuário: qualquer pessoa com conta na plataforma.",
          "Lojista: usuário com assinatura ativa (ou em teste) que publica uma Loja.",
          "Comprador: pessoa que monta e envia um pedido pela Loja de um Lojista, com ou sem conta.",
          "Pedido: a lista de figurinhas escolhidas pelo Comprador e enviada ao Lojista pelo WhatsApp.",
        ],
      },
      {
        h: "3. Cadastro e conta",
        ul: [
          "Para usar a Coleção é preciso criar uma conta com nome completo, e-mail, WhatsApp e senha. As informações devem ser verdadeiras e mantidas atualizadas.",
          "Menores de 18 anos só podem usar a plataforma com autorização e acompanhamento de pais ou responsáveis. A contratação da assinatura da Loja é permitida apenas a maiores de 18 anos.",
          "Você é responsável por manter sua senha em sigilo e por toda atividade realizada na sua conta.",
        ],
      },
      {
        h: "4. Plano Coleção (gratuito)",
        p: [
          "O registro da coleção é gratuito e por tempo indeterminado. Podemos evoluir, alterar ou descontinuar funcionalidades gratuitas, preservando, sempre que possível, os dados já registrados.",
        ],
      },
      {
        h: "5. Assinatura da Loja",
        ul: [
          `Preço: o valor vigente é o exibido na página de assinatura no momento da contratação, cobrado mensalmente em reais no cartão de crédito.`,
          `Teste grátis: na primeira assinatura de cada conta, há ${trialDays} dias gratuitos. O cartão é cadastrado no início do teste; se você cancelar antes do fim do teste, nada é cobrado. Se não cancelar, a primeira mensalidade é cobrada automaticamente ao fim do teste.`,
          "Renovação automática: a assinatura é renovada a cada mês, no mesmo cartão, até que você a cancele.",
          "Pagamentos: são processados pela Stripe, parceira de pagamentos. A GN Coleciona não armazena os dados do seu cartão.",
          "Reajuste: alterações de preço serão comunicadas com pelo menos 30 dias de antecedência e valerão a partir da renovação seguinte ao aviso.",
          `Falta de pagamento: se uma cobrança for recusada, novas tentativas serão feitas automaticamente e a Loja permanece disponível por um período de carência de ${graceDays} dias. Encerrada a carência sem pagamento, a Loja é suspensa e os pedidos ainda pendentes são cancelados (os registros permanecem salvos). A Loja volta ao ar com a regularização do pagamento.`,
          "Cancelamento e reembolso seguem a Política de Cancelamento e Reembolso.",
        ],
      },
      {
        h: "6. Como funcionam a Loja e os pedidos",
        ul: [
          "Ficam à venda apenas as figurinhas repetidas registradas na Coleção do Lojista que tenham preço definido.",
          "Ao adicionar figurinhas ao carrinho, elas ficam reservadas ao Comprador por alguns minutos para que ele conclua o pedido; o pedido enviado mantém a reserva por até 24 horas, aguardando a confirmação do Lojista. Os prazos exibidos na plataforma prevalecem.",
          "O pagamento e a entrega são combinados diretamente entre Comprador e Lojista, fora da plataforma. A baixa no estoque acontece quando o Lojista confirma o pedido.",
        ],
      },
      {
        h: "7. Responsabilidades do Lojista",
        ul: [
          "Ter a posse das figurinhas anunciadas, manter a Coleção atualizada e descrever corretamente o que vende.",
          "Cumprir os pedidos confirmados, combinar pagamento e entrega com transparência e responder por eventuais trocas, devoluções e reclamações dos Compradores, observando a legislação aplicável, inclusive o Código de Defesa do Consumidor quando cabível.",
          "Não anunciar itens falsificados, adulterados ou que não possa vender, e cumprir as obrigações fiscais relativas às suas vendas.",
          "Usar os dados pessoais recebidos dos Compradores exclusivamente para atender ao pedido, protegendo-os e não os compartilhando com terceiros.",
          "Garantir que tem direito de uso sobre a imagem da loja que enviar.",
        ],
      },
      {
        h: "8. Responsabilidades do Comprador",
        ul: [
          "Informar dados verdadeiros no pedido (nome, e-mail, WhatsApp e endereço).",
          "Conferir a disponibilidade das figurinhas antes de qualquer pagamento, seguindo as orientações de segurança exibidas no fechamento do pedido.",
          "Tratar diretamente com o Lojista questões sobre pagamento, entrega, trocas e devoluções.",
        ],
      },
      {
        h: "9. Limitação de responsabilidade",
        p: [
          "A GN Coleciona não é parte das vendas entre usuários e não responde pela existência, qualidade, entrega ou pagamento das figurinhas negociadas, nem por atos dos Lojistas ou Compradores.",
          "Empregamos esforços razoáveis para manter a plataforma disponível e segura, mas não garantimos funcionamento ininterrupto ou livre de erros. Na máxima extensão permitida pela lei, a responsabilidade da GN Coleciona perante o Lojista fica limitada ao valor pago por ele à plataforma nos 12 meses anteriores ao evento, ressalvados os casos de dolo ou culpa grave e os direitos irrenunciáveis do consumidor.",
        ],
      },
      {
        h: "10. Propriedade intelectual",
        p: [
          "A marca, o layout e o software da GN Coleciona pertencem a " + C.razaoSocial + ".",
          "Nomes, números, imagens e marcas das figurinhas, dos álbuns, de seleções, atletas e competições pertencem aos respectivos titulares (como Panini e FIFA). A GN Coleciona não é afiliada, patrocinada ou endossada por esses titulares, e essas referências são usadas apenas para identificar os itens colecionados. Titulares de direitos podem solicitar a remoção de conteúdo pelo nosso contato.",
        ],
      },
      {
        h: "11. Condutas proibidas",
        ul: [
          "Usar a plataforma para fraudes, golpes, cobranças indevidas ou qualquer atividade ilícita.",
          "Enviar conteúdo ofensivo, discriminatório, que viole direitos de terceiros ou que não tenha relação com colecionismo.",
          "Tentar acessar contas ou dados de outros usuários, sobrecarregar ou burlar os mecanismos de segurança da plataforma (incluindo reservas artificiais de estoque).",
        ],
      },
      {
        h: "12. Suspensão e encerramento",
        p: [
          "Podemos suspender ou encerrar contas e lojas que violem estes Termos ou a lei, mediante aviso quando possível. Você pode encerrar sua conta a qualquer momento pelo contato abaixo; a assinatura deve ser cancelada conforme a Política de Cancelamento.",
        ],
      },
      {
        h: "13. Alterações destes Termos",
        p: [
          "Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas pela plataforma ou por e-mail, e o uso continuado após a vigência indica concordância com a nova versão.",
        ],
      },
      {
        h: "14. Lei aplicável e foro",
        p: [
          `Estes Termos são regidos pelas leis brasileiras. Para consumidores, fica eleito o foro do seu domicílio; nos demais casos, o foro da comarca de ${C.foro}.`,
        ],
      },
      { h: "15. Contato", p: [`Dúvidas sobre estes Termos: ${C.email}.`] },
    ],
  };
}

export function politicaDePrivacidade(): LegalDoc {
  return {
    title: "Política de privacidade",
    intro: [
      `Esta Política explica como a ${C.marca}, operada por ${C.razaoSocial} (CNPJ ${C.cnpj}, ${C.endereco}), coleta, usa e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD). ${C.razaoSocial} é a controladora dos dados tratados na plataforma.`,
    ],
    sections: [
      {
        h: "1. Dados que coletamos",
        ul: [
          "Conta: nome completo, e-mail, WhatsApp, nome da coleção, coleção escolhida e senha (armazenada de forma criptografada pelo nosso provedor de autenticação — nunca temos acesso à senha em texto).",
          "Coleção: as figurinhas registradas e suas quantidades.",
          "Loja (Lojistas): nome e endereço da loja, imagem enviada, WhatsApp de atendimento, preços, configurações e histórico de pedidos.",
          "Pedidos (Compradores): nome, e-mail, WhatsApp, endereço de entrega, figurinhas escolhidas e a data em que o Comprador confirmou ter lido as orientações de segurança.",
          "Assinatura: status, datas e identificadores da assinatura. Os dados do cartão são coletados e processados diretamente pela Stripe; não armazenamos número, validade ou código de segurança do cartão.",
          "Dados técnicos: cookies de sessão, identificador do carrinho, preferências de exibição salvas no seu navegador e registros de acesso (IP, data e hora).",
        ],
      },
      {
        h: "2. Para que usamos e com qual base legal",
        ul: [
          "Criar e manter sua conta, sua coleção e sua loja; processar pedidos e reservas — execução de contrato (art. 7º, V).",
          "Cobrar a assinatura e emitir comprovantes — execução de contrato e cumprimento de obrigação legal (art. 7º, II e V).",
          "Enviar ao Lojista os dados do pedido do Comprador, para que a venda aconteça — execução de contrato e procedimentos preliminares a pedido do titular (art. 7º, V).",
          "Segurança, prevenção a fraudes e melhoria da plataforma — legítimo interesse (art. 7º, IX), sempre respeitando seus direitos.",
          "Guardar registros de acesso — obrigação legal (Marco Civil da Internet, art. 15).",
        ],
      },
      {
        h: "3. Com quem compartilhamos",
        ul: [
          "Com o Lojista: os dados do pedido são enviados ao Lojista escolhido pelo Comprador. O Lojista passa a ser responsável pelo uso desses dados e deve utilizá-los apenas para atender ao pedido.",
          "Com fornecedores que operam a plataforma em nosso nome: Supabase (banco de dados, autenticação e armazenamento de imagens), Vercel (hospedagem) e Stripe (pagamentos da assinatura).",
          "Com o WhatsApp (Meta), quando você mesmo envia o pedido ou fala com o Lojista pelo aplicativo — nesse caso valem também as políticas do WhatsApp.",
          "Com autoridades, quando exigido por lei ou ordem judicial.",
          "Não vendemos nem alugamos dados pessoais.",
        ],
      },
      {
        h: "4. Transferência internacional",
        p: [
          "Nossos fornecedores podem armazenar dados em servidores fora do Brasil (por exemplo, nos Estados Unidos). Essas transferências ocorrem com fornecedores que adotam salvaguardas contratuais e padrões de segurança compatíveis com a LGPD (art. 33).",
        ],
      },
      {
        h: "5. Por quanto tempo guardamos",
        ul: [
          "Dados da conta, da coleção e da loja: enquanto a conta existir.",
          "Pedidos e dados de assinatura: pelo prazo necessário ao cumprimento de obrigações legais e ao exercício de direitos (em regra, até 5 anos).",
          "Registros de acesso: por no mínimo 6 meses, conforme o Marco Civil da Internet.",
          "Encerrada a finalidade, os dados são eliminados ou anonimizados.",
        ],
      },
      {
        h: "6. Seus direitos",
        p: [
          `Você pode, a qualquer momento: confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a anonimização, bloqueio ou eliminação de dados desnecessários, a portabilidade, informações sobre compartilhamento e a revisão de decisões automatizadas, além de revogar consentimentos (art. 18 da LGPD). Para exercer esses direitos, escreva para ${C.email}. Responderemos em até 15 dias.`,
          "Parte dos seus dados pode ser editada diretamente em Meu perfil. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
        ],
      },
      {
        h: "7. Crianças e adolescentes",
        p: [
          "Colecionar figurinhas é um hobby de todas as idades. O cadastro de menores de 18 anos deve ser feito com autorização e acompanhamento de um dos pais ou responsável, e os dados de crianças são tratados no seu melhor interesse (art. 14 da LGPD). A assinatura da Loja é restrita a maiores de 18 anos. Se identificarmos dados de criança coletados sem autorização, eles serão eliminados.",
        ],
      },
      {
        h: "8. Cookies e armazenamento no navegador",
        ul: [
          "Sessão: mantém você conectado (essencial).",
          "Carrinho: identifica o seu carrinho para reservar as figurinhas escolhidas (essencial).",
          "Preferências: guardam escolhas como a visualização em fotos ou grade e os dados do comprador para o próximo pedido, apenas no seu navegador.",
          "Não usamos cookies de publicidade.",
        ],
      },
      {
        h: "9. Segurança",
        p: [
          "Usamos conexão criptografada (HTTPS), controle de acesso por conta, regras de segurança no banco de dados e fornecedores com certificações reconhecidas. Nenhum sistema é totalmente imune a incidentes; se ocorrer um incidente relevante, comunicaremos os titulares afetados e a ANPD, conforme a lei.",
        ],
      },
      {
        h: "10. Encarregado (DPO) e contato",
        p: [`Encarregado pelo tratamento de dados pessoais: ${C.razaoSocial} — ${C.email}.`],
      },
      {
        h: "11. Alterações desta Política",
        p: ["Esta Política pode ser atualizada. A versão vigente estará sempre nesta página, com a data da última atualização."],
      },
    ],
  };
}

export function politicaDeCancelamento(trialDays: number, graceDays: number): LegalDoc {
  return {
    title: "Cancelamento e reembolso",
    intro: [
      "Queremos que você assine a Loja porque ela vale a pena — e que possa sair a qualquer momento, sem burocracia. Esta política vale para a assinatura da Loja da GN Coleciona. A Coleção é gratuita.",
    ],
    sections: [
      {
        h: "1. Teste grátis",
        p: [
          `Na primeira assinatura, você tem ${trialDays} dias grátis. Se cancelar antes do fim do teste, nenhuma cobrança é feita.`,
        ],
      },
      {
        h: "2. Como cancelar",
        p: [
          "Você cancela sozinho, a qualquer momento: Meu perfil → Assinatura da loja → Gerenciar assinatura. O cancelamento é feito no portal seguro da Stripe, nossa parceira de pagamentos. Se preferir, fale com a gente pelo contato abaixo.",
        ],
      },
      {
        h: "3. O que acontece depois de cancelar",
        ul: [
          "A renovação automática é encerrada e não haverá novas cobranças.",
          "Sua Loja continua no ar até o fim do período já pago.",
          "Sua Coleção continua salva e gratuita. Você pode assinar de novo quando quiser (o teste grátis vale apenas na primeira assinatura).",
        ],
      },
      {
        h: "4. Direito de arrependimento",
        p: [
          "Como a contratação é feita pela internet, você pode desistir em até 7 dias (art. 49 do Código de Defesa do Consumidor). Além do teste grátis, se você for cobrado pela primeira mensalidade e desistir em até 7 dias dessa cobrança, devolvemos o valor integral — basta cancelar e nos pedir o reembolso pelo contato abaixo.",
        ],
      },
      {
        h: "5. Demais mensalidades",
        p: [
          "Fora do prazo de arrependimento, o cancelamento interrompe as renovações futuras, sem reembolso proporcional do mês em curso — a Loja segue disponível até o fim do período pago. Cobranças em duplicidade ou indevidas são sempre estornadas integralmente.",
        ],
      },
      {
        h: "6. Falha no pagamento",
        p: [
          `Se o cartão for recusado, novas tentativas são feitas automaticamente e você é avisado por e-mail. A Loja fica disponível por ${graceDays} dias de carência; depois disso, é suspensa até a regularização, e os pedidos pendentes são cancelados (os registros permanecem salvos). Você pode atualizar o cartão em Gerenciar assinatura.`,
        ],
      },
      {
        h: "7. Compras de figurinhas entre usuários",
        p: [
          "As vendas de figurinhas acontecem diretamente entre Lojista e Comprador, sem pagamento pela plataforma. Trocas, devoluções e reembolsos dessas compras são tratados diretamente com o Lojista, observada a legislação aplicável.",
        ],
      },
      {
        h: "8. Reembolso: como é feito",
        p: [
          "Reembolsos aprovados são estornados no mesmo cartão usado no pagamento. O prazo para o valor aparecer na fatura depende da operadora do cartão (normalmente de 5 a 10 dias úteis, podendo cair na fatura seguinte).",
        ],
      },
      { h: "9. Contato", p: [`${C.email}`] },
    ],
  };
}
