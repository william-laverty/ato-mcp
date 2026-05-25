/**
 * Bundled subset of ANZSIC 2006 class codes (4-digit) from the ABS classification.
 * Covers ~80 representative codes spanning all divisions A–S.
 * Source: ABS ANZSIC 2006 (cat. 1292.0)
 */

export const ANZSIC_CODES: ReadonlyArray<{ code: string; title: string }> = [
  // Division A — Agriculture, Forestry and Fishing
  { code: "0111", title: "Nursery Production (Under Cover)" },
  { code: "0112", title: "Nursery Production (Outdoors)" },
  { code: "0121", title: "Mushroom Growing" },
  { code: "0130", title: "Turf Growing" },
  { code: "0141", title: "Sheep Farming (Specialised)" },
  { code: "0142", title: "Beef Cattle Farming (Specialised)" },
  { code: "0160", title: "Grain Growing" },
  { code: "0500", title: "Aquaculture" },

  // Division B — Mining
  { code: "0600", title: "Coal Mining" },
  { code: "0700", title: "Oil and Gas Extraction" },
  { code: "0800", title: "Iron Ore Mining" },
  { code: "0900", title: "Non-Ferrous Metal Ore Mining" },
  { code: "1000", title: "Construction Material Mining" },

  // Division C — Manufacturing
  { code: "1111", title: "Meat Processing" },
  { code: "1200", title: "Bakery Product Manufacturing" },
  { code: "1300", title: "Beverage Manufacturing" },
  { code: "1511", title: "Log Sawmilling" },
  { code: "1600", title: "Printing" },
  { code: "1900", title: "Basic Chemical Manufacturing" },
  { code: "2010", title: "Motor Vehicle Manufacturing" },
  { code: "2390", title: "Other Manufacturing n.e.c." },

  // Division D — Electricity, Gas, Water and Waste Services
  { code: "2611", title: "Fossil Fuel Electricity Generation" },
  { code: "2612", title: "Hydro-Electricity Generation" },
  { code: "2613", title: "Other Electricity Generation" },
  { code: "2700", title: "Water Supply, Sewerage and Drainage Services" },
  { code: "2910", title: "Solid Waste Collection Services" },

  // Division E — Construction
  { code: "3011", title: "House Construction" },
  { code: "3020", title: "Commercial and Industrial Building Construction" },
  { code: "3100", title: "Heavy and Civil Engineering Construction" },
  { code: "3211", title: "Plumbing Services" },
  { code: "3212", title: "Electrical Services" },
  { code: "3220", title: "Carpentry Services" },
  { code: "3290", title: "Other Construction Services n.e.c." },

  // Division F — Wholesale Trade
  { code: "3300", title: "Farm Produce and Supplies Wholesaling" },
  { code: "3500", title: "Grocery, Liquor and Tobacco Product Wholesaling" },
  { code: "3700", title: "Machinery and Equipment Wholesaling" },
  { code: "3900", title: "Other Goods Wholesaling n.e.c." },

  // Division G — Retail Trade
  { code: "4110", title: "Supermarket and Grocery Stores" },
  { code: "4121", title: "Meat, Fish and Poultry Retailing" },
  { code: "4130", title: "Specialised Food Retailing" },
  { code: "4211", title: "Furniture Retailing" },
  { code: "4221", title: "Electrical and Electronic Goods Retailing" },
  { code: "4231", title: "Hardware and Building Supplies Retailing" },
  { code: "4251", title: "Sport and Camping Equipment Retailing" },
  { code: "4260", title: "Clothing, Footwear and Personal Accessory Retailing" },
  { code: "4310", title: "Motor Vehicle Retailing" },
  { code: "4400", title: "Fuel Retailing" },

  // Division H — Accommodation and Food Services
  { code: "4401", title: "Hotel and Resort Operations" },
  { code: "4511", title: "Cafes, Restaurants and Takeaway Food Services" },
  { code: "4512", title: "Catering Services" },
  { code: "4520", title: "Pubs, Taverns and Bars" },

  // Division I — Transport, Postal and Warehousing
  { code: "4611", title: "Road Freight Transport" },
  { code: "4621", title: "Taxi and Other Road Transport" },
  { code: "4700", title: "Rail Freight and Passenger Transport" },
  { code: "4800", title: "Water Transport" },
  { code: "4900", title: "Air and Space Transport" },
  { code: "5300", title: "Road Freight Transport Services" },
  { code: "5400", title: "Storage Services" },

  // Division J — Information Media and Telecommunications
  { code: "5500", title: "Newspaper, Periodical, Book and Directory Publishing" },
  { code: "5600", title: "Software Publishing" },
  { code: "5700", title: "Internet Publishing and Broadcasting" },
  { code: "5800", title: "Telecommunications Services" },
  { code: "5900", title: "Internet Service Providers, Web Search Portals and Data Processing Services" },

  // Division K — Financial and Insurance Services
  { code: "6211", title: "Banking" },
  { code: "6220", title: "Building Society Operation" },
  { code: "6230", title: "Credit Union Operation" },
  { code: "6311", title: "Life Insurance" },
  { code: "6321", title: "Health Insurance" },
  { code: "6330", title: "General Insurance" },
  { code: "6400", title: "Auxiliary Finance and Investment Services" },

  // Division L — Rental, Hiring and Real Estate Services
  { code: "6611", title: "Residential Property Operators" },
  { code: "6612", title: "Commercial Property Operators and Investors" },
  { code: "6720", title: "Real Estate Services" },

  // Division M — Professional, Scientific and Technical Services
  { code: "6910", title: "Legal Services" },
  { code: "6920", title: "Accounting Services" },
  { code: "6931", title: "Architectural Services" },
  { code: "6940", title: "Veterinary Services" },
  { code: "6950", title: "Computer System Design and Related Services" },
  { code: "6960", title: "Management and Related Consulting Services" },
  { code: "6990", title: "Other Professional, Scientific and Technical Services n.e.c." },

  // Division N — Administrative and Support Services
  { code: "7211", title: "Employment Placement and Recruitment Services" },
  { code: "7220", title: "Labour Supply Services" },
  { code: "7310", title: "Building Cleaning, Pest Control and Other Support Services" },
  { code: "7320", title: "Packaging Services" },

  // Division O — Public Administration and Safety
  { code: "7510", title: "Central Government Administration" },
  { code: "7520", title: "State Government Administration" },
  { code: "7530", title: "Local Government Administration" },
  { code: "7700", title: "Police Services" },

  // Division P — Education and Training
  { code: "8011", title: "Pre-School Education" },
  { code: "8012", title: "Primary Education" },
  { code: "8021", title: "Secondary Education" },
  { code: "8101", title: "Higher Education" },
  { code: "8200", title: "Adult, Community and Other Education" },

  // Division Q — Health Care and Social Assistance
  { code: "8401", title: "General Practice Medical Services" },
  { code: "8402", title: "Specialist Medical Services" },
  { code: "8500", title: "Hospitals" },
  { code: "8601", title: "Pathology and Diagnostic Imaging Services" },
  { code: "8700", title: "Residential Care Services" },
  { code: "8800", title: "Social Assistance Services" },

  // Division R — Arts and Recreation Services
  { code: "9001", title: "Performing Arts Operation" },
  { code: "9101", title: "Amusement Parks and Centres Operation" },
  { code: "9200", title: "Gambling Activities" },
  { code: "9301", title: "Sport and Physical Recreation Activities" },

  // Division S — Other Services
  { code: "9411", title: "Automotive Repair and Maintenance" },
  { code: "9500", title: "Personal Care Services" },
  { code: "9601", title: "Laundry and Dry-Cleaning Services" },
  { code: "9609", title: "Other Services n.e.c." },
];

export function isValidAnzsicCode(code: string): boolean {
  return ANZSIC_CODES.some(c => c.code === code);
}
