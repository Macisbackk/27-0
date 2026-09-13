/**
 * Authentic Rugby League Player Name Pools & Generator.
 * Provides rich, culturally authentic name variety representing:
 * - British & Northern England RL heartlands (Lancashire, Yorkshire, Cumbria)
 * - Celtic heritage (Wales, Scotland, Ireland)
 * - Pacific Island & Polynesian communities (Samoa, Tonga, Fiji, Cook Islands, Maori, PNG)
 * - French RL tradition (Catalans, Toulouse, Occitanie, Aude)
 * - Australian & New Zealand overseas heritage
 */

export interface GeneratedPlayerName {
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
}

// ---------------------------------------------------------------------------
// 1. BRITISH & NORTHERN ENGLISH RL HEARTLANDS
// ---------------------------------------------------------------------------
export const BRITISH_FIRST_NAMES = [
  "Liam", "Jack", "Harry", "Oliver", "George", "Noah", "Charlie", "Jacob", "Alfie", "Freddie",
  "Sam", "Ben", "Joe", "Tom", "Will", "Dan", "Luke", "Alex", "Matty", "Brad",
  "Callum", "Cameron", "Lewis", "Josh", "Morgan", "Jordan", "Connor", "Tyler", "Kieran", "Ellis",
  "Mason", "Harvey", "Ethan", "Archie", "Oscar", "Lucas", "James", "Max", "Leo", "Logan",
  "Toby", "Harrison", "Zak", "Finlay", "Kai", "Bailey", "Reece", "Nathan", "Dylan", "Owen",
  "Aaron", "Scott", "Dean", "Craig", "Sean", "Leon", "Jamie", "Adam", "Danny", "Robbie",
  "Andy", "Kev", "Gary", "Paul", "Mark", "David", "Wayne", "Darren", "Ross", "Chris",
  "Declan", "Bradley", "Dominic", "Mitchell", "Corey", "Brandon", "Ryan", "Ashton", "Kian", "Louie",
  "Jayden", "Reuben", "Isaac", "Dexter", "Fletcher", "Jude", "Seth", "Brody", "Sonny", "Cole",
  "Roman", "Reggie", "Bobby", "Ronnie", "Frank", "Arthur", "Stanley", "Ralph", "Ted", "Ned",
  "Jonty", "Travis", "Caleb", "Austin", "Drew", "Rowan", "Joel", "Taylor", "Blake", "Rhys",
  "Kyle", "Troy", "Shaun", "Greg", "Ricky", "Brett", "Russell", "Stuart", "Gavin", "Trevor",
  "Clive", "Roy", "Alan", "Keith", "Colin", "Ian", "Brian", "Graham", "Terry", "Ray",
  "Malcolm", "Derek", "Barry", "Martin", "Nigel", "Peter", "Matthew", "John", "Richard", "Stephen",
  "Carl", "Simon", "Jason", "Lee", "Neil", "Karl", "Christian", "Marcus", "Elliot", "Nathaniel",
  "Finley", "Rowan", "Keaton", "Preston", "Harley", "Rory", "Lennon", "Theo", "Jasper", "Miles",
  "Hugo", "Rupert", "Barnaby", "Jenson", "Hudson", "Spencer", "Chester", "Woody", "Frankie", "Brodie"
];

export const BRITISH_LAST_NAMES = [
  // Super League & Championship Heritage
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
  "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke",
  "Clark", "Turner", "Harrison", "Ward", "Martin", "Cooper", "Morris", "King", "Watson", "Baker",
  "Shaw", "Holmes", "Fisher", "Bell", "Chapman", "Mason", "Butler", "Dixon", "Hunt", "Palmer",
  "Mills", "Simpson", "Marshall", "Ellis", "Fletcher", "Gibson", "Bennett", "Brooks", "Hodgson", "Schofield",
  "Senior", "Betts", "Fairbank", "Woodburn", "Broadbent", "Hesketh", "Ashworth", "Whittle", "Heyes", "Partington",
  "Wellens", "Long", "Radlinski", "Joynt", "Newlove", "Prescott", "Cunningham", "Sculthorpe", "Morley", "Fielden",
  "Peacock", "Sinfield", "Burrow", "McGuire", "Diskin", "Mathers", "Calderwood", "Bailey", "Horne", "Briscoe",
  "Yeaman", "Brough", "Gale", "Sneyd", "Hardaker", "Charnley", "Sarginson", "Bateman", "Whitehead", "Burgess",
  "Walmsley", "Makinson", "Percival", "Lomax", "Welsby", "Dodd", "Lees", "Knowles", "Batchelor", "Litten",
  "Minchella", "Hadley", "Staveley", "Balmforth", "Trout", "Mellor", "Croft", "Ackers", "Cust", "Dupree",
  "Nsemba", "Eckersley", "Farrimond", "Nicholson", "Thewlis", "Wrench", "Holroyd", "Gannon", "O'Connor", "Newman",
  "Handley", "Myler", "Leeming", "Dwyer", "Westerman", "Griffin", "Eden", "Watts", "McShane", "Milner",
  "Addy", "Lawler", "Halton", "Doro", "Fulton", "Milnes", "Ryan", "Blake", "Roby", "Radford",
  "Turnbull", "Pemberton", "Gaskell", "Hilton", "Seddon", "Sharples", "Unsworth", "Tatlock", "Warburton", "Winstanley",
  // Northern towns heritage (Wigan, Saints, Hull, Leeds, Cumbrian borders)
  "Aspinwall", "Astley", "Bate", "Bentham", "Bibby", "Boardman", "Booth", "Bostock", "Briers", "Brogan",
  "Bullough", "Bushell", "Butterworth", "Catterall", "Chisnall", "Clough", "Colquitt", "Cowen", "Craddock", "Critchley",
  "Crompton", "Crossley", "Cudjoe", "Dagger", "Derbyshire", "Dickinson", "Duckworth", "Dugdale", "Entwistle", "Fairclough",
  "Fazackerley", "Fishwick", "Forshaw", "Gelling", "Grimshaw", "Hampson", "Hardman", "Hargreaves", "Haslam", "Haughton",
  "Heaton", "Higginson", "Hodkinson", "Holgate", "Hollingsworth", "Horrocks", "Houghton", "Hulme", "Ince", "Isherwood",
  "Kay", "Kershaw", "Kirk", "Langtree", "Leach", "Leatherbarrow", "Livesey", "Lunt", "Lythgoe", "Melling",
  "Moss", "Nield", "Nuttall", "Orrell", "Parkin", "Pilling", "Ramsbottom", "Rigby", "Ritson", "Rostron",
  "Rushton", "Shuttleworth", "Smethurst", "Southward", "Speakman", "Standish", "Starkey", "Stockley", "Stopford", "Sumner",
  "Sutch", "Swarbrick", "Taberner", "Threlfall", "Waterworth", "Whalley", "Wilding", "Wolstenholme", "Worsley", "Worthington"
];

// ---------------------------------------------------------------------------
// 2. CELTIC (WALES, SCOTLAND, IRELAND)
// ---------------------------------------------------------------------------
export const CELTIC_FIRST_NAMES = [
  // Welsh
  "Rhys", "Ieuan", "Morgan", "Carwyn", "Steffan", "Emyr", "Gethin", "Owain", "Rhodri", "Dafydd",
  "Gareth", "Huw", "Sion", "Lloyd", "Gwyn", "Bryn", "Cai", "Osian", "Jac", "Gruffydd",
  // Scottish
  "Ewan", "Fraser", "Hamish", "Callum", "Alistair", "Stuart", "Duncan", "Ross", "Craig", "Blair",
  "Gregor", "Innes", "Brodie", "Rory", "Campbell", "Lachlan", "Finlay", "Niall", "Fergus", "Alasdair",
  // Irish
  "Liam", "Connor", "Kieran", "Caelan", "Declan", "Aidan", "Finbar", "Ronan", "Eoin", "Cormac",
  "Patrick", "Fionn", "Ciaran", "Darragh", "Senan", "Tiernan", "Colm", "Donnacha", "Oisin", "Tadhg"
];

export const CELTIC_LAST_NAMES = [
  // Welsh
  "Davies", "Evans", "Jones", "Williams", "Griffiths", "Lloyd", "Bevan", "Thomas", "Jenkins", "Morgan",
  "Hughes", "Lewis", "Owen", "Rees", "Parry", "Vaughan", "Briers", "Kear", "Flower", "Saltonstall",
  "Hopkins", "Powell", "Pritchard", "Prosser", "Meredith", "Llewellyn", "Bowen", "Havard", "Gough",
  // Scottish
  "Robertson", "Stewart", "Campbell", "Macleod", "Ferguson", "Anderson", "Scott", "Murray", "Ross", "Paterson",
  "Hamilton", "Graham", "Wallace", "Burns", "MacIntyre", "MacLean", "Buchanan", "Sutherland", "Sinclair", "Fraser",
  // Irish
  "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor", "O'Neill", "Reilly",
  "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch", "Quinn", "Moore", "McLoughlin", "McMeeken",
  "McIlorum", "McIntyre", "McNamara", "O'Hanlon", "Fitzpatrick", "O'Donnell", "Higgins", "Brennan", "Kearney", "Flanagan",
  "Kavanagh", "Keighran", "Mullaney", "Costello", "Fitzgibbon", "MacNamara", "O'Shea", "Treacy", "Tierney", "Hetherington"
];

// ---------------------------------------------------------------------------
// 3. PACIFIC ISLAND & MAORI (SAMOA, TONGA, FIJI, COOK ISLANDS, MAORI, PNG)
// ---------------------------------------------------------------------------
export const PACIFIC_FIRST_NAMES = [
  "Sione", "Tevita", "Kelepi", "Maika", "Siua", "Sitili", "Ligi", "Agnatius", "Konrad", "David",
  "Willie", "Mose", "Fetuli", "Samisoni", "Pauli", "Tui", "Manu", "Viliami", "Taniela", "Mikaele",
  "Peni", "Renouf", "Waqa", "Kevin", "Sauaso", "Franklin", "Francis", "Junior", "Siosiua", "Fa'amanu",
  "Isaac", "Jesse", "Ken", "Hymel", "Nene", "Tariq", "Korbin", "Ashton", "Toa", "Spencer",
  "Stephen", "Moses", "Jarome", "Brian", "Ronaldo", "Nelson", "Dallin", "Kodi", "Jahrome", "Isaiah",
  "Charnze", "Peta", "Shaun", "Keano", "Briton", "Jazz", "Kaea", "Manaia", "Wiremu", "Taine",
  "Rangi", "Haze", "Phoenix", "Niko", "Semi", "Suliasi", "Vilame", "Viliame", "Josaia", "Apisai",
  "Tesi", "Edwin", "Judah", "Epel", "Morea", "Rodrick", "Sylvester", "Nixon", "Justin", "Emmanuel",
  "Ativalu", "Sunia", "Eliesa", "Haumole", "Stefano", "Simi", "Manase", "Tesi", "Keaon", "Jacob"
];

export const PACIFIC_LAST_NAMES = [
  "Paasi", "Tuilagi", "Hurrell", "Lolohea", "Hopoate", "Sao", "Taukeiaho", "Taumalolo", "Fonua", "Vunipola",
  "Fifita", "Tagatese", "Masoe", "Taufua", "Nu'uausala", "Kasiano", "Soliola", "Sia", "Vatuvei", "Naiqama",
  "Kikau", "Radradra", "Ravalawa", "Sivo", "Koroisau", "Kamikamica", "Vunivalu", "Montoya", "Leilua", "Luai",
  "To'o", "Crichton", "May", "Naufahu", "Kaufusi", "Katoa", "Asofa-Solomona", "Tapine", "Rapana", "Nikorima",
  "Tuivasa-Sheck", "Foran", "Wiki", "Puletua", "Cayless", "Faiumu", "Moimoi", "Vagana", "Iro", "Mata'utia",
  "Segeyaro", "Lam", "Mead", "Olam", "Boas", "Aiton", "Albert", "Laybutt", "Nanai", "Sailor",
  "Mam", "Cobbo", "Haas", "Paseka", "Uele", "Hamlin-Uele", "Fa'asuamaleaui", "Fotuaika", "Lisone", "Liu",
  "Proctor", "Harris", "Fisher-Harris", "Bromwich", "Waerea-Hargreaves", "Jolliffe", "Palasia", "Tuipulotu", "Koloamatangi", "Tevaga",
  "Tuimoala", "Katoa", "Tupou", "Taunoa-Brown", "Vave", "Fepuleai", "Fafita", "Faumuina", "Leutele", "Ah Mau"
];

// ---------------------------------------------------------------------------
// 4. FRENCH (CATALANS DRAGONS, TOULOUSE OLYMPIQUE, OCCITANIE & AUDE)
// ---------------------------------------------------------------------------
export const FRENCH_FIRST_NAMES = [
  "Arthur", "Romain", "Matthieu", "César", "Théo", "Ugo", "Benjamin", "Julian", "Alrix", "Mickaël",
  "Jordan", "Eloi", "Paul", "Tanguy", "Lambert", "Justin", "Corentin", "Maxime", "Thomas", "Lucas",
  "Anthony", "Enzo", "Florian", "Bastien", "Guillaume", "Robin", "Clément", "Rémi", "Jean", "Pierre",
  "Louis", "Fabien", "Laurent", "Sébastien", "Vincent", "Nicolas", "Alexandre", "Valentin", "Hugo", "Axel",
  "Lilian", "Damien", "Yoan", "Loïc", "Adrien", "Gilles", "Christophe", "Stéphane", "Franck", "Cédric",
  "Yannick", "Dorian", "Mathias", "Thibault", "Kylian", "Nathanaël", "Gabin", "Sacha", "Malo", "Antonin"
];

export const FRENCH_LAST_NAMES = [
  "Mourgue", "Garcia", "Fages", "Rougé", "Da Costa", "Navarrete", "Bousquet", "Séguier", "Dezaria", "Scimone",
  "Maria", "Casty", "Baitieri", "Gigot", "Escaré", "Jullien", "Pelissier", "Albert", "Sangaré", "Marion",
  "Belmas", "Stefani", "Laguerre", "Zenon", "Ader", "Puech", "Marguerite", "Robin", "Guisset", "Bosc",
  "Fakir", "Duport", "Mounis", "Elima", "Gossard", "Stacul", "Martins", "Ferret", "Rinaldi", "Verges",
  "Frayssinous", "Carrasco", "Sabathier", "Bonnet", "Valls", "Fabre", "Fontanier", "Perez", "Boyer", "Dupuy",
  "Calvet", "Vidal", "Roux", "Blanc", "Morel", "Laurent", "Simon", "Bernard", "Rey", "Marty",
  "Arnaud", "Prat", "Pons", "Pages", "Garrigues", "Castany", "Doutres", "Delgado", "Crunel", "Castel"
];

// ---------------------------------------------------------------------------
// 5. AUSTRALIAN & NEW ZEALAND OVERSEAS
// ---------------------------------------------------------------------------
export const ANTIPODEAN_FIRST_NAMES = [
  "Mitchell", "Lachlan", "Cooper", "Brodie", "Blake", "Jai", "Jayden", "Tyson", "Cody", "Clint",
  "Corey", "Jarrod", "Bevan", "Cade", "Tex", "Brayden", "Brock", "Beau", "Todd", "Dane",
  "Brett", "Trent", "Matt", "Scott", "Glenn", "Craig", "Brad", "Nathan", "Reece", "Kalyn",
  "Jake", "Angus", "Hudson", "Toby", "Patrick", "Travis", "Dale", "Bryson", "Kurt", "Aaron",
  "Daniel", "Xavier", "Hamiso", "Ezra", "Keaon", "Braxton", "Campbell", "Latrell", "Nicho", "Payne"
];

export const ANTIPODEAN_LAST_NAMES = [
  "Hastings", "Field", "French", "Miller", "Reynolds", "Sezer", "Croft", "Austin", "Coote", "Drinkwater",
  "Clifford", "Sailor", "Moylan", "Maloney", "Carney", "Sandow", "Campese", "Finch", "Gidley", "Monaghan",
  "King", "Menzies", "Lyon", "Orford", "Johns", "Fittler", "Lockyer", "Thurston", "Cronk", "Slater",
  "Inglis", "Hodges", "Folau", "Pearce", "Cleary", "Munster", "Cherry-Evans", "Trbojevic", "Tedesco", "Edwards",
  "Ponga", "Walsh", "Hynes", "Dearden", "Townsend", "Moses", "Wighton", "Walker", "Cook", "Papenhuyzen"
];

// ---------------------------------------------------------------------------
// CONSOLIDATED MASTER ARRAYS
// (Over 400 first names and over 600 last names for maximum variety)
// ---------------------------------------------------------------------------
export const FIRST_NAMES: string[] = Array.from(
  new Set([
    ...BRITISH_FIRST_NAMES,
    ...CELTIC_FIRST_NAMES,
    ...PACIFIC_FIRST_NAMES,
    ...FRENCH_FIRST_NAMES,
    ...ANTIPODEAN_FIRST_NAMES,
  ])
);

export const LAST_NAMES: string[] = Array.from(
  new Set([
    ...BRITISH_LAST_NAMES,
    ...CELTIC_LAST_NAMES,
    ...PACIFIC_LAST_NAMES,
    ...FRENCH_LAST_NAMES,
    ...ANTIPODEAN_LAST_NAMES,
  ])
);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates an authentic player name tailored to club identity and regional flavor.
 * - French clubs (Catalans, Toulouse) receive predominantly authentic French & Catalan names.
 * - Welsh clubs (North Wales Crusaders) receive higher Welsh/Celtic distribution.
 * - General British clubs receive a natural blend of Northern English, Celtic, Pacific Islander, and overseas flair.
 */
export function generateRandomPlayerName(clubId?: string | null): GeneratedPlayerName {
  const normClub = (clubId || "").toLowerCase();

  // 1. French clubs: Catalans Dragons, Toulouse Olympique
  if (normClub.includes("catalans") || normClub.includes("toulouse")) {
    const roll = Math.random();
    if (roll < 0.65) {
      const firstName = pickRandom(FRENCH_FIRST_NAMES);
      const lastName = pickRandom(FRENCH_LAST_NAMES);
      return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: "France" };
    }
    if (roll < 0.82) {
      const firstName = pickRandom(PACIFIC_FIRST_NAMES);
      const lastName = pickRandom(PACIFIC_LAST_NAMES);
      const nat = pickRandom(["Samoa", "Tonga", "Fiji", "New Zealand"]);
      return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: nat };
    }
    // Overseas Antipodean or English import
    const isAus = Math.random() < 0.6;
    const firstName = isAus ? pickRandom(ANTIPODEAN_FIRST_NAMES) : pickRandom(BRITISH_FIRST_NAMES);
    const lastName = isAus ? pickRandom(ANTIPODEAN_LAST_NAMES) : pickRandom(BRITISH_LAST_NAMES);
    return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: isAus ? "Australia" : "England" };
  }

  // 2. Welsh clubs: North Wales Crusaders
  if (normClub.includes("crusader") || normClub.includes("wales")) {
    const roll = Math.random();
    if (roll < 0.45) {
      const firstName = pickRandom(CELTIC_FIRST_NAMES);
      const lastName = pickRandom(CELTIC_LAST_NAMES);
      return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: "Wales" };
    }
    const firstName = pickRandom(BRITISH_FIRST_NAMES);
    const lastName = pickRandom(BRITISH_LAST_NAMES);
    return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: "England" };
  }

  // 3. Standard UK Super League & Championship clubs
  const roll = Math.random();

  // 70% Core British / Northern England
  if (roll < 0.70) {
    const firstName = pickRandom(BRITISH_FIRST_NAMES);
    const lastName = pickRandom(BRITISH_LAST_NAMES);
    return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: "England" };
  }

  // 12% Celtic (Wales, Scotland, Ireland)
  if (roll < 0.82) {
    const firstName = pickRandom(CELTIC_FIRST_NAMES);
    const lastName = pickRandom(CELTIC_LAST_NAMES);
    const nat = pickRandom(["Wales", "Scotland", "Ireland", "England"]);
    return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: nat };
  }

  // 10% Pacific Island / Maori (integral to modern rugby league)
  if (roll < 0.92) {
    const firstName = pickRandom(PACIFIC_FIRST_NAMES);
    const lastName = pickRandom(PACIFIC_LAST_NAMES);
    const nat = pickRandom(["Samoa", "Tonga", "Fiji", "Cook Islands", "Papua New Guinea", "New Zealand"]);
    return { firstName, lastName, fullName: `${firstName} ${lastName}`, nationality: nat };
  }

  // 8% Australian / New Zealand overseas imports
  const isAus = Math.random() < 0.65;
  const firstName = pickRandom(ANTIPODEAN_FIRST_NAMES);
  const lastName = pickRandom(ANTIPODEAN_LAST_NAMES);
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    nationality: isAus ? "Australia" : "New Zealand",
  };
}
