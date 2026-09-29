// Merchant lists and naming helpers. Banks, card issuers, brokers, customers and suppliers are made up (they
// carry TEST). Merchants may be common chains, because real statements show them; they are listed here so
// verify.mjs can tell a chain from an invented name.

export const LOC = ['TORONTO ON', 'MISSISSAUGA ON', 'OAKVILLE ON', 'BURLINGTON ON', 'MILTON ON', 'BRAMPTON ON',
  'SCARBOROUGH ON', 'NORTH YORK ON', 'ETOBICOKE ON', 'HAMILTON ON', 'VAUGHAN ON', 'MARKHAM ON', 'PICKERING ON', 'AJAX ON'];

// A base name ending in ' #' is a storefront: a store number and a place are added.
export const CH = {
  coffee: ['TIM HORTONS #', 'STARBUCKS #', 'SECOND CUP #', 'PRET A MANGER #'],
  lunch: ['SUBWAY #', 'MCDONALDS #', 'A&W #', 'HARVEYS #', 'SWISS CHALET #', 'BOSTON PIZZA #', 'EAST SIDE MARIOS #', 'PIZZA PIZZA #', 'PANERA BREAD #', 'MOXIES #', 'THE KEG #'],
  fuel: ['PETRO-CANADA #', 'SHELL #', 'ESSO #', 'ULTRAMAR #', 'HUSKY #', 'PIONEER #'],
  grocery: ['LOBLAWS #', 'NO FRILLS #', 'SOBEYS #', 'METRO #', 'FRESHCO #', 'FOOD BASICS #', 'COSTCO WHOLESALE #', 'WALMART SUPERCENTRE #', 'FARM BOY #'],
  telecom: ['ROGERS', 'BELL MOBILITY', 'TELUS MOBILITY', 'FIDO', 'KOODO'],
  internet: ['BELL CANADA INTERNET', 'ROGERS INTERNET', 'TELUS INTERNET'],
  software: ['MICROSOFT*365 MSBILL.INFO', 'GOOGLE *WORKSPACE', 'ZOOM.US', 'DROPBOX', 'ADOBE *CREATIVE CLOUD', 'INTUIT *QUICKBOOKS', 'SLACK', 'NOTION LABS', 'FIGMA', 'CANVA', 'AMAZON WEB SERVICES', 'GITHUB', 'LASTPASS', '1PASSWORD'],
  office: ['STAPLES #', 'AMAZON.CA', 'DOLLARAMA #', 'BEST BUY #', 'UPS STORE #', 'APPLE STORE #'],
  hardware: ['HOME DEPOT #', 'RONA #', 'CANADIAN TIRE #', 'PRINCESS AUTO #', 'HOME HARDWARE #'],
  parking: ['GREEN P PARKING', 'IMPARK', 'PRESTO', 'UBER *TRIP', 'ZIPCAR'],
  courier: ['CANADA POST', 'UPS', 'FEDEX', 'PUROLATOR'],
  pharmacy: ['SHOPPERS DRUG MART #', 'REXALL #'],
  streaming: ['NETFLIX.COM', 'SPOTIFY', 'DISNEY PLUS', 'APPLE.COM/BILL', 'AMAZON PRIME'],
  retail: ['WINNERS #', 'IKEA #', 'INDIGO #', 'LULULEMON #', 'OLD NAVY #', 'MARSHALLS #', 'SPORT CHEK #', 'PETSMART #'],
  delivery: ['UBER EATS', 'DOORDASH'],
  airline: ['TRILLIUM AIRWAYS TEST'],
  tolls: ['407 ETR', 'PRESTO'],
  rail: ['VIA RAIL CANADA', 'GO TRANSIT'],
  truckstop: ['PILOT TRAVEL CENTRE #', 'FLYING J #', 'PETRO-CANADA #', 'HUSKY #', 'ESSO #'],
  ads: ['FACEBK *ADS', 'GOOGLE *ADS', 'PINTEREST ADS', 'TIKTOK ADS'],
  ecom: ['SHOPIFY *SUBSCRIPTION', 'SHOPIFY *APPS', 'SHOPIFY PAYOUT', 'STRIPE PAYOUT', 'KLAVIYO', 'STAMPS.COM', 'PIRATESHIP'],
};

export const CHAIN_TOKENS = [...new Set(Object.values(CH).flat().map((s) => s.replace(/ #$/, '')))];
// Generic bank wording, government bodies and payment-network text that name no person or company.
export const GENERIC_RE = /(MONTHLY ACCOUNT FEE|ACCOUNT FEE|SERVICE CHARGE|OVERDRAFT|INTEREST|BANK FEE|E-TRANSFER FEE|WIRE FEE|PAYMENT - THANK YOU|PAYMENT THANK YOU|CRA |CANADA REVENUE AGENCY|WSIB|PAYROLL|CASH DEPOSIT|BRANCH DEPOSIT|ATM |CHEQUE \d+ *$|NSF|FX |PRE-AUTH DEBIT CRA|PRE-AUTH DEBIT WSIB)/;

export const locate = (rng, base) => (base.endsWith(' #') ? `${base}${rng.int(100, 9999)} ${rng.pick(LOC)}` : base);

// "Priya Nair (Test)" -> "PRIYA NAIR TEST" (the way a bank would print a made-up person)
export const bankName = (n) => n.replace(/\s*\(Test\)\s*$/, '').toUpperCase() + ' TEST';

// Personal spending on an owner's own card (never the company's).
export const PERSONAL = [
  { d: 'grocery', n: [7, 11], a: [22, 190] },
  { d: 'coffee', n: [5, 9], a: [4, 16] },
  { d: 'lunch', n: [5, 9], a: [11, 78] },
  { d: 'fuel', n: [3, 5], a: [42, 98] },
  { d: 'streaming', n: [2, 3], a: [9, 24] },
  { d: 'pharmacy', n: [1, 3], a: [8, 64] },
  { d: 'retail', n: [1, 4], a: [24, 240] },
  { d: 'delivery', n: [2, 4], a: [18, 64] },
  { d: 'parking', n: [1, 3], a: [6, 32] },
];
