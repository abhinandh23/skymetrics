/** Reporting carrier codes used in the BTS on-time dataset. */
export const AIRLINE_NAMES = {
  '9E': 'Endeavor Air',
  AA: 'American Airlines',
  AS: 'Alaska Airlines',
  B6: 'JetBlue Airways',
  C5: 'CommutAir',
  DL: 'Delta Air Lines',
  F9: 'Frontier Airlines',
  G4: 'Allegiant Air',
  G7: 'GoJet Airlines',
  HA: 'Hawaiian Airlines',
  MQ: 'Envoy Air',
  NK: 'Spirit Airlines',
  OH: 'PSA Airlines',
  OO: 'SkyWest Airlines',
  PT: 'Piedmont Airlines',
  QX: 'Horizon Air',
  UA: 'United Airlines',
  WN: 'Southwest Airlines',
  YV: 'Mesa Airlines',
  YX: 'Republic Airways',
  ZW: 'Air Wisconsin',
};

export const airlineName = (code) => AIRLINE_NAMES[code] ?? code;
