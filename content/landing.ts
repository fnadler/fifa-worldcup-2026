// Texto da landing pública (/). Edite aqui sem mexer nos componentes.
// Os números dos mocks (totais, pedido #1042, preços de exemplo) são ilustrativos.

export const landing = {
  meta: {
    title: "GN Coleciona — sua coleção organizada, suas repetidas à venda",
    description:
      "Registre grátis cada figurinha do álbum da Copa 2026 e saiba na hora o que falta e o que sobra. Quando quiser, transforme as repetidas em uma loja própria — os pedidos chegam no seu WhatsApp.",
  },

  nav: [
    { href: "#colecao", label: "Coleção" },
    { href: "#loja", label: "Loja" },
    { href: "#planos", label: "Planos" },
    { href: "#faq", label: "Dúvidas" },
  ],

  hero: {
    pill: "Álbum da Copa 2026",
    title: "Organize sua coleção. Venda suas repetidas.",
    subtitle:
      "Registre grátis cada figurinha do álbum e saiba na hora o que falta e o que sobra. Quando quiser, transforme as repetidas em uma loja própria — os pedidos chegam direto no seu WhatsApp.",
    note: "Cancele quando quiser durante o teste, sem cobrança.",
    badgeTitle: "repetidas já na sua loja",
    badgeSub: "atualizado automaticamente",
    // 0 = falta, 1 = tenho, 2+ = repetida
    grid: [1, 1, 2, 1, 0, 1, 1, 1, 3, 1, 1, 0, 1, 2, 1, 1, 1, 1, 0, 1],
  },

  split: {
    kicker: "Uma plataforma, dois jeitos de usar",
    title: "Primeiro você completa o álbum. Depois, o que sobra vira renda.",
    colecao:
      "Todas as figurinhas do álbum num quadro só — com foto de cada uma. Marque o que tem, quantas repetidas de cada e veja o que falta por seleção.",
    loja: "Suas repetidas viram vitrine pública, com os seus preços e o seu endereço. Compradores montam o pedido e mandam para o seu WhatsApp.",
  },

  colecao: {
    kicker: "Coleção · grátis para sempre",
    title: "Chega de caderninho e lista no bloco de notas.",
    anchors: ["FWC", "A · MEX", "A · KOR", "C · BRA", "J · ARG", "L · ENG", "Legends"],
    totals: { coladas: 612, repetidas: 143, faltam: 382 },
    blocks: [
      { grupo: "C", nome: "Brasil", resumo: "17/20 · 4 rep.", cells: [1, 1, 2, 1, 0, 1, 1, 1, 3, 1, 1, 0, 1, 2, 1, 1, 1, 1, 0, 1] },
      { grupo: "J", nome: "Argentina", resumo: "14/20 · 2 rep.", cells: [1, 0, 1, 1, 2, 1, 0, 1, 1, 2, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0] },
    ],
    features: [
      {
        t: "O álbum inteiro em uma tela",
        d: "Seleções, FWC History, Coca-Cola e as raras Legends, organizadas por grupo, com atalho para pular direto para qualquer uma.",
      },
      { t: "Veja a foto de cada figurinha", d: "Alterne entre fotos e grade compacta. Um toque soma; a segunda unidade em diante já conta como repetida." },
      { t: "Totais sempre à vista", d: "Coladas, repetidas e faltantes no geral e em cada seleção." },
      { t: "Lista de troca pronta", d: "Filtre só repetidas ou só faltantes e copie a lista para mandar no grupo." },
    ],
    cta: "Criar minha coleção grátis",
  },

  loja: {
    kicker: "Loja · assinatura",
    title: "Suas repetidas já são o seu estoque.",
    subtitle:
      "Você não cadastra produto nenhum. Tudo o que está repetido na sua coleção aparece automaticamente na loja — e sai de lá quando você confirma a venda.",
    steps: [
      {
        t: "Repetidas viram estoque",
        d: "Toda figurinha com mais de uma unidade na coleção aparece na loja, com foto e a quantidade disponível.",
      },
      { t: "Sua loja, seu endereço", d: "Link próprio (gncoleciona.com.br/sua-loja), sua imagem e seus preços: por grupo e individuais para as mais disputadas." },
      {
        t: "O comprador monta o pedido",
        d: "As figurinhas ficam reservadas no carrinho enquanto ele fecha a compra — nada de vender a mesma duas vezes.",
      },
      { t: "Pedido no seu WhatsApp", d: "Você confirma, combina pagamento e entrega. A loja se atualiza sozinha." },
    ],
    pricing: {
      title: "Preço do seu jeito",
      subtitle: "Regra geral por grupo e exceções para as figurinhas que valem mais.",
      grupo: [
        { nome: "Figurinhas de seleção", preco: "R$ 2,50" },
        { nome: "FWC History", preco: "R$ 4,00" },
        { nome: "Legends", preco: "R$ 15,00" },
      ],
      individual: [
        { code: "BRA9", nome: "Craque da seleção", preco: "R$ 12,00" },
        { code: "OUR13", nome: "Legend ouro", preco: "R$ 40,00" },
      ],
    },
    whatsapp: {
      title: "Novo pedido na sua loja",
      sub: "via WhatsApp",
      intro: "Olá! Quero comprar da sua loja GN Coleciona:",
      items: "BRA9 · BRA14 · ARG10\nKOR3 · MEX7 · FWC6",
      total: "6 figurinhas · R$ 21,50",
      meta: "Pedido #1042 · Maria, Pinheiros – SP",
      reply: "Oi Maria! Tenho todas, pedido confirmado. Te entrego sábado na praça? Pode ser Pix.",
      note: "O pagamento e a entrega são combinados direto entre você e o comprador. A plataforma organiza o pedido; a venda é sua.",
    },
  },

  planos: {
    kicker: "Planos",
    title: "Colecione de graça. Venda quando quiser.",
    free: {
      nome: "Coleção",
      items: [
        "Registro completo do álbum, com fotos",
        "Quantidade de repetidas por figurinha",
        "Totais por seleção e geral",
        "Lista de repetidas para troca",
        "Link público para mostrar sua coleção",
      ],
      cta: "Criar conta grátis",
    },
    pago: {
      nome: "Coleção + Loja",
      badge: "dias grátis",
      after: "depois do teste gratuito",
      items: [
        "Tudo do plano Coleção",
        "Loja com endereço próprio e sua imagem",
        "Repetidas viram estoque automaticamente",
        "Preços por grupo e individuais",
        "Reserva automática no carrinho",
        "Pedidos direto no seu WhatsApp",
      ],
      cta: "Começar teste grátis",
    },
    trialTitle: "Como funciona o teste grátis",
  },

  faq: [
    {
      p: "Preciso pagar para registrar minha coleção?",
      r: "Não. O registro da coleção é gratuito, sem limite de tempo. A assinatura só é necessária para criar e publicar a sua loja.",
    },
    {
      p: "Como funciona o teste grátis?",
      r: "Você cadastra um cartão e usa a loja completa sem pagar nada durante o teste. Se cancelar dentro desse prazo, não há cobrança. Se não cancelar, a assinatura é cobrada automaticamente no cartão ao fim do teste.",
    },
    {
      p: "Posso cancelar a qualquer momento?",
      r: "Sim. Durante o teste, cancelar significa não ser cobrado. Depois, o cancelamento encerra a renovação e a loja sai do ar ao fim do período já pago. Sua coleção continua salva e gratuita.",
    },
    {
      p: "Preciso cadastrar as figurinhas da loja uma por uma?",
      r: "Não. Toda figurinha com repetida na sua coleção entra automaticamente na loja. Você só define os preços: um valor por grupo e, se quiser, valores específicos para figurinhas individuais.",
    },
    {
      p: "O comprador paga pelo site?",
      r: "Não. O comprador escolhe as figurinhas e envia o pedido, que chega pronto no seu WhatsApp. Você confirma a disponibilidade e combina pagamento e entrega direto com ele.",
    },
    {
      p: "E se duas pessoas quiserem a mesma figurinha?",
      r: "Quem coloca no carrinho primeiro garante: a figurinha fica reservada por alguns minutos enquanto a pessoa fecha o pedido, e o pedido segura o estoque até você confirmar. Ao confirmar a venda, ela sai das suas repetidas — nada de vender a mesma figurinha duas vezes.",
    },
  ],

  final: {
    title: "Aquela pilha de repetidas pode pagar os próximos pacotinhos.",
    ctaLoja: "Testar a loja grátis",
    ctaColecao: "Só quero a coleção grátis",
  },
};

export function trialSteps(trialDays: number) {
  return [
    { quando: "Hoje", t: "Cadastre seu cartão", d: "Sua loja é liberada na hora, com todos os recursos." },
    { quando: `Dias 1 a ${trialDays}`, t: "Teste sem pagar", d: "Publique, receba pedidos e cancele quando quiser, sem nenhuma cobrança." },
    {
      quando: `Dia ${trialDays + 1}`,
      t: "Assinatura começa",
      d: "Se você não cancelou, a cobrança é feita automaticamente no cartão cadastrado.",
    },
  ];
}
