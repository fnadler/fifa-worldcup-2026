// Texto da landing pública (/). Edite aqui sem mexer nos componentes.
// Os números dos mocks (totais, pedido #1042, preços de exemplo) são ilustrativos.

export const landing = {
  meta: {
    title: "GN Coleciona — complete o álbum da Copa 2026 e venda as repetidas",
    description:
      "Marque grátis as figurinhas do álbum da Copa 2026, das Legends e da Gold Crumple e saiba na hora o que falta e o que sobra. As repetidas viram uma loja própria — os pedidos chegam no seu WhatsApp.",
  },

  nav: [
    { href: "#colecoes", label: "Coleções" },
    { href: "#colecao", label: "Como funciona" },
    { href: "#loja", label: "Vender" },
    { href: "#planos", label: "Planos" },
    { href: "#faq", label: "Dúvidas" },
  ],

  // Link em destaque no topo — a vitrine com todas as lojas (a oficial em destaque).
  lojas: { href: "/lojas", label: "Lojas", badge: "novo" },

  hero: {
    pill: "Álbum da Copa 2026",
    title: "Complete o álbum da Copa. Venda as repetidas.",
    subtitle:
      "Marque grátis as 994 figurinhas do álbum da Copa 2026 e saiba na hora quais faltam e quais sobram. As repetidas que se acumularam viram uma loja própria — os pedidos chegam direto no seu WhatsApp.",
    note: "Cancele quando quiser durante o teste, sem cobrança.",
    badgeTitle: "repetidas já na sua loja",
    badgeSub: "atualizado automaticamente",
    // 0 = falta, 1 = tenho, 2+ = repetida
    grid: [1, 1, 2, 1, 0, 1, 1, 1, 3, 1, 1, 0, 1, 2, 1, 1, 1, 1, 0, 1],
  },

  // Painel da marca nas telas de acesso (/login): entrar/senha e, no cadastro, os benefícios da conta.
  auth: {
    foot: "Grátis para colecionar. Sem cartão.",
    signin: {
      title: "Sua coleção está te esperando.",
      subtitle: "Veja o que falta, o que sobra e onde encontrar as figurinhas que faltam.",
    },
    signup: {
      pill: "Conta grátis para sempre",
      title: "Tudo o que a sua coleção precisa, num lugar só.",
      benefits: [
        { t: "14 coleções na mesma conta", d: "Álbuns das Copas de 1990 a 2026, Legends, Extra Stickers, Gold Crumple Edition e Adrenalyn XL." },
        { t: "Foto de cada figurinha", d: "Marque com um toque o que você tem e veja os totais de coladas, repetidas e faltantes." },
        { t: "Listas prontas para o WhatsApp", d: "Compartilhe suas repetidas e faltantes, ou o link da sua coleção." },
        { t: "Ache quem tem o que falta", d: "Veja as lojas que têm as figurinhas que faltam para você completar." },
        { t: "Comunidade de colecionadores", d: "Entre no grupo para trocar, comprar e vender." },
      ],
    },
  },

  split: {
    kicker: "Uma plataforma, dois jeitos de usar",
    title: "Primeiro você completa a coleção. Depois, o que sobra vira renda.",
    colecao:
      "Cada coleção num quadro só — com foto de cada figurinha ou card. Marque o que tem, quantas repetidas de cada e veja o que falta por seleção.",
    loja: "Suas repetidas viram vitrine pública, com os seus preços e o seu endereço. Compradores montam o pedido e mandam para o seu WhatsApp.",
  },

  // Coleções disponíveis. `img`: capa do álbum (caminho em public/) ou código de uma figurinha (public/stickers/thumb/<img>.webp).
  // Na landing aparecem só as `destaque: true` e o card `mais`, que leva para a lista completa em /colecoes-disponiveis.
  colecoes: {
    kicker: "Coleções disponíveis",
    title: "Tudo da Copa 2026 num lugar só.",
    subtitle: "O álbum, as Legends e a Gold Crumple Edition, com foto de cada figurinha, progresso e repetidas — na mesma conta, grátis.",
    items: [
      { nome: "Álbum Copa 2026", desc: "As 994 figurinhas do álbum oficial Panini: seleções, FWC History e Coca-Cola.", img: "/brand/albums/copa-2026.webp", tag: "", destaque: true },
      { nome: "Legends 2026", desc: "As 80 figurinhas raras das Legends, nas versões lilás, bronze, prata e ouro.", img: "/brand/albums/legends-2026.webp", tag: "", destaque: true },
      { nome: "Gold Crumple Edition 2026", desc: "O álbum completo da Copa com o layout dourado — 980 figurinhas.", img: "GCARG17", tag: "", destaque: true },
      { nome: "Adrenalyn XL 2026", desc: "Os 630 cards da Copa e as Limited Editions, com foto de cada card.", img: "/brand/albums/adrenalyn-xl.webp", tag: "" },
      { nome: "Álbum Copa do Catar 2022", desc: "As 678 figurinhas do álbum da Copa de 2022: seleções, FIFA Museum e Coca-Cola.", img: "/brand/albums/copa-catar-2022.webp", tag: "Novo" },
      { nome: "Extra Stickers 2022", desc: "As 80 figurinhas raras da Copa do Catar, nas versões bordô, bronze, prata e ouro.", img: "CQEXOUR16", tag: "Novo" },
      { nome: "Álbum Copa da Rússia 2018", desc: "As 682 figurinhas do álbum da Copa de 2018: seleções, estádios, cartazes e Legends.", img: "/brand/albums/copa-russia-2018.webp", tag: "Novo" },
      { nome: "Álbum Copa do Brasil 2014", desc: "As 640 figurinhas do álbum da Copa de 2014: seleções, estádios e especiais.", img: "/brand/albums/copa-brasil-2014.webp", tag: "Novo" },
      { nome: "Álbum Copa da África do Sul 2010", desc: "As 640 figurinhas do álbum da Copa de 2010, mais as 77 atualizações à parte.", img: "/brand/albums/copa-africa-sul-2010.webp", tag: "Novo" },
      { nome: "Álbum Copa da Alemanha 2006", desc: "As 597 figurinhas do álbum da Copa de 2006: seleções, estádios e especiais.", img: "/brand/albums/copa-alemanha-2006.webp", tag: "Novo" },
      { nome: "Álbum Copa da Coreia e Japão 2002", desc: "As 576 figurinhas do álbum da Copa de 2002: seleções, estádios e especiais.", img: "/brand/albums/copa-coreia-japao-2002.webp", tag: "Novo" },
      { nome: "Álbum Copa da França 1998", desc: "As 561 figurinhas do álbum da Copa de 1998: seleções, estádios e especiais.", img: "/brand/albums/copa-franca-1998.webp", tag: "Novo" },
      { nome: "Álbum Copa dos EUA 1994", desc: "As 460 figurinhas do álbum da Copa de 1994, com o mosaico do escudo do Brasil.", img: "/brand/albums/copa-eua-1994.webp", tag: "Novo" },
      { nome: "Álbum Copa da Itália 1990", desc: "As 448 figurinhas do álbum da Copa de 1990: seleções, cidades, estádios e campeões.", img: "/brand/albums/copa-italia-1990.webp", tag: "Novo" },
    ],
    // Próximas coleções previstas: `ano` aparece no lugar da figurinha.
    soon: [] as { nome: string; desc: string; tag: string; ano: string }[],
    // Quarto card da landing: chamada para as demais coleções. `capas`: capas empilhadas no lugar da figurinha,
    // na versão de 360 px (brand/albums/pilha), porque aparecem com até ~170 px de largura.
    mais: {
      href: "/colecoes-disponiveis",
      titulo: "Mais coleções",
      desc: "Álbuns das Copas de 2022 a 1990, Extra Stickers e Adrenalyn XL. Tem raridade guardada? Coloque à venda na sua loja.",
      link: "Ver todas as coleções",
      capas: ["/brand/albums/pilha/copa-italia-1990.webp", "/brand/albums/pilha/copa-brasil-2014.webp", "/brand/albums/pilha/copa-catar-2022.webp"],
    },
    // Página /colecoes-disponiveis
    pagina: {
      kicker: "Coleções disponíveis",
      title: "Da Copa de 1990 à de 2026.",
      subtitle:
        "Acompanhe todas na mesma conta, grátis. Figurinhas antigas e raras valem mais: com a loja, as suas repetidas de qualquer coleção viram estoque à venda.",
      voltar: "Voltar para o site",
    },
  },

  // Bloco de lojistas: loja oficial + 3 sorteadas. {itens} é trocado pelo número real.
  lojistas: {
    kicker: "Lojas da plataforma",
    title: "Complete o álbum com as repetidas de outros colecionadores.",
    subtitle:
      "São {itens} figurinhas e cards à venda com os nossos lojistas. Marque a sua coleção e veja na hora quais lojas têm as que faltam para você.",
    verTodas: "Ver todos os lojistas",
    convite: {
      title: "Suas repetidas também podem estar aqui.",
      text: "Essas lojas são de colecionadores como você. Abra a sua e venda para quem está completando o álbum.",
    },
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
        t: "Várias coleções na mesma conta",
        d: "Os álbuns das Copas de 1990 a 2026, as raras Legends e Extra Stickers, a Gold Crumple Edition e os cards Adrenalyn XL, cada um com seu progresso. Troque de coleção com um toque.",
      },
      { t: "Veja a foto de cada item", d: "Alterne entre fotos e grade compacta. Um toque soma; a segunda unidade em diante já conta como repetida." },
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
        d: "Toda figurinha ou card com mais de uma unidade na coleção aparece na loja, com foto e a quantidade disponível.",
      },
      { t: "Sua loja, seu endereço", d: "Link próprio (gncoleciona.com.br/sua-loja), sua imagem e seus preços: por grupo e individuais para as mais disputadas." },
      {
        t: "O comprador monta o pedido",
        d: "Os itens ficam reservados no carrinho enquanto ele fecha a compra — nada de vender o mesmo duas vezes.",
      },
      { t: "Pedido no seu WhatsApp", d: "Você confirma, combina pagamento e entrega. A loja se atualiza sozinha." },
    ],
    pricing: {
      title: "Preço do seu jeito",
      subtitle: "Regra geral por grupo, em cada coleção, e exceções para os itens que valem mais.",
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
        "As coleções da Copa 2026 + coleções das Copas de 2022 até 1990",
        "Várias coleções na mesma conta",
        "Quantidade de repetidas por item",
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
        "Venda de várias coleções na mesma loja",
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
      p: "Quais coleções posso acompanhar?",
      r: "Hoje são 14: os álbuns das Copas de 2026, 2022, 2018, 2014, 2010, 2006, 2002, 1998, 1994 e 1990, as Legends 2026, as Extra Stickers 2022, a Gold Crumple Edition 2026 e os cards Adrenalyn XL. Você pode acompanhar todas na mesma conta, cada uma com seu progresso, sua lista de repetidas e seu link público.",
    },
    {
      p: "Preciso cadastrar os itens da loja um por um?",
      r: "Não. Toda figurinha ou card com repetida na sua coleção entra automaticamente na loja. Você só define os preços: um valor por grupo e, se quiser, valores específicos para itens individuais.",
    },
    {
      p: "O comprador paga pelo site?",
      r: "Não. O comprador escolhe os itens e envia o pedido, que chega pronto no seu WhatsApp. Você confirma a disponibilidade e combina pagamento e entrega direto com ele.",
    },
    {
      p: "E se duas pessoas quiserem o mesmo item?",
      r: "Quem coloca no carrinho primeiro garante: o item fica reservado por alguns minutos enquanto a pessoa fecha o pedido, e o pedido segura o estoque até você confirmar. Ao confirmar a venda, ele sai das suas repetidas — nada de vender o mesmo item duas vezes.",
    },
  ],

  comunidade: {
    title: "Entre na comunidade GN Coleciona no WhatsApp",
    text: "Trocas, achados e novidades no grupo da GN Coleciona. Grátis e aberto a todos.",
    cta: "Entrar na comunidade",
  },
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
