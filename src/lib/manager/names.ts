/**
 * Authentic Rugby League Player Name Pools & Generator.
 * Provides rich, culturally authentic name variety representing:
 * - British & Northern England RL heartlands (Lancashire, Yorkshire, Cumbria)
 * - Celtic heritage (Wales, Scotland, Ireland)
 * - Pacific Island & Polynesian communities (Samoa, Tonga, Fiji, Cook Islands, Māori, PNG)
 * - French RL tradition (Catalans, Toulouse, Occitanie, Aude)
 * - Australian & New Zealand overseas heritage
 *
 * Generation never uses well-known RL star surnames, and retries until the full
 * name does not match a player already in data/current-squads.json.
 */

import currentSquads from "../../../data/current-squads.json";

export interface GeneratedPlayerName {
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
}

// ---------------------------------------------------------------------------
// Reserved full names (from current squads) + famous RL surname blocklist
// ---------------------------------------------------------------------------

function normalizeFullName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSurname(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/\s+/g, " ");
}

/** Well-known Super League / NRL / historic RL surnames — never used in generation. */
export const FAMOUS_RL_SURNAME_BLOCKLIST: ReadonlySet<string> = new Set(
  [
    // Super League / Championship icons & current stars
    "Sinfield", "Burrow", "Welsby", "Wellens", "Long", "Radlinski", "Joynt", "Newlove",
    "Prescott", "Cunningham", "Sculthorpe", "Morley", "Fielden", "Peacock", "McGuire",
    "Diskin", "Mathers", "Calderwood", "Horne", "Briscoe", "Yeaman", "Brough", "Gale",
    "Sneyd", "Hardaker", "Charnley", "Sarginson", "Bateman", "Whitehead", "Burgess",
    "Walmsley", "Makinson", "Percival", "Lomax", "Dodd", "Lees", "Knowles", "Batchelor",
    "Litten", "Minchella", "Hadley", "Ackers", "Cust", "Dupree", "Nsemba", "Handley",
    "Myler", "Leeming", "Dwyer", "Westerman", "Griffin", "Eden", "McShane", "Roby",
    "Radford", "Cudjoe", "Forshaw", "Higginson", "Hodkinson", "Tomkins",
    "O'Loughlin", "OLoughlin", "Gildart", "McGillvary", "Hock", "Carney", "Flannery",
    "Higham", "Fozzard", "Langley", "Finnigan", "Wilkin", "Amor", "Atkins", "Escare",
    "Escaré", "Cummins", "Addy", "Lawler", "Halton", "Milnes", "Trout", "Mellor",
    "Croft", "Staveley", "Balmforth", "Thewlis", "Wrench", "Holroyd", "Gannon",
    "Turnbull", "Pemberton", "Gaskell", "Hilton", "Seddon", "Sharples", "Unsworth",
    "Tatlock", "Warburton", "Winstanley", "Betts", "Fairbank", "Woodburn", "Broadbent",
    "Senior", "Schofield", "Hodgson", "Kear", "Flower", "Saltonstall", "McMeeken",
    "McIlorum", "Keighran", "Mullaney", "Costello", "Fitzgibbon", "Hetherington",
    "Ritson", "Gelling",
    // NRL / Antipodean stars (distinctive — not generic English surnames)
    "Cleary", "Trbojevic", "Tedesco", "Munster", "Cherry-Evans", "CherryEvans",
    "Ponga", "Hynes", "Dearden", "Townsend", "Wighton", "Papenhuyzen", "Reynolds",
    "Sezer", "Hastings", "Drinkwater", "Coote", "Clifford", "Sailor", "Moylan",
    "Maloney", "Sandow", "Campese", "Finch", "Gidley", "Monaghan", "Menzies", "Lyon",
    "Orford", "Johns", "Fittler", "Lockyer", "Thurston", "Cronk", "Slater", "Inglis",
    "Hodges", "Folau", "Pearce", "Hayne", "Civoniceva", "Webcke", "Langer", "Gagai",
    "Addo-Carr", "AddoCarr", "Tabuai-Fidow", "TabuaiFidow", "Carrigan", "Haas", "Taaffe",
    "Mam", "Staggs", "Mansour", "Burton", "Cotter", "Turbo",
    // Pacific stars
    "Taumalolo", "Fifita", "Fonua", "Vunipola", "Tuilagi", "Hurrell", "Lolohea",
    "Hopoate", "Sao", "Taukeiaho", "Paasi", "Tagatese", "Masoe", "Taufua",
    "Nuuausala", "Nu'uausala", "Kasiano", "Soliola", "Vatuvei", "Naiqama", "Kikau",
    "Radradra", "Ravalawa", "Sivo", "Koroisau", "Kamikamica", "Vunivalu", "Leilua",
    "Luai", "Too", "To'o", "Crichton", "Kaufusi", "Katoa", "Asofa-Solomona",
    "AsofaSolomona", "Tapine", "Rapana", "Nikorima", "Tuivasa-Sheck", "TuivasaSheck",
    "Foran", "Wiki", "Puletua", "Cayless", "Faiumu", "Moimoi", "Vagana", "Iro",
    "Matautia", "Mata'utia", "Segeyaro", "Lam", "Mead", "Olam", "Boas", "Aiton",
    "Nanai", "Cobbo", "Paseka", "Uele", "Hamlin-Uele", "HamlinUele",
    "Faasuamaleaui", "Fa'asuamaleaui", "Fotuaika", "Lisone", "Proctor", "Harris",
    "Fisher-Harris", "FisherHarris", "Bromwich", "Waerea-Hargreaves", "WaereaHargreaves",
    "Jolliffe", "Palasia", "Tuipulotu", "Koloamatangi", "Tevaga", "Tuimoala", "Tupou",
    "Taunoa-Brown", "TaunoaBrown", "Vave", "Fepuleai", "Fafita", "Faumuina", "Leutele",
    "Ah Mau", "AhMau", "Olakauatu", "Olakau'atu", "Tatola", "Havili", "Pangai",
    "Fusitua", "Fusitu'a", "Utoikamanu", "Nakubuwai", "Koroibete", "Naulago",
    "Leota", "Papalii", "Papali'i", "Sualii", "Suali'i", "Paulo", "Tupouniua",
    "Leniu", "Taumoepeau", "Tetevano", "Faasoo", "Fa'aso'o", "Taulagi", "Fuimaono",
    "Matagi", "Napa", "Su'a", "Sua", "May", "Nikora", "Hiku", "Manu",
    "Watene-Zelezniak", "WateneZelezniak", "Maumalo", "Whare", "Kenny-Dowall",
    "KennyDowall", "Nightingale", "Marshall", "Luke", "Horo", "Blair", "Mannering",
    "Mateo", "Leuluai", "Faitala-Mariner", "FaitalaMariner", "Niukore", "Capewell",
    "Marsters", "Takairangi", "Tanginoa", "Glassie", "Makirere",
    // French / Catalans / Toulouse stars
    "Mourgue", "Fages", "Rouge", "Rougé", "Navarrete", "Bousquet", "Seguier", "Séguier",
    "Dezaria", "Scimone", "Casty", "Baitieri", "Gigot", "Jullien", "Pelissier",
    "Sangare", "Sangaré", "Belmas", "Stefani", "Laguerre", "Zenon", "Ader", "Puech",
    "Guisset", "Bosc", "Fakir", "Duport", "Mounis", "Elima", "Gossard", "Stacul",
    "Rinaldi", "Frayssinous", "Sabathier", "Garcia", "Maria", "Albert", "Marion",
    "Da Costa", "DaCosta", "Montoya",
  ].map(normalizeSurname)
);

let reservedFullNames: Set<string> | null = null;
/** Extra occupied names for the active career (generated players, FAs, etc.). */
const sessionOccupiedNames = new Set<string>();

function getReservedFullNames(): Set<string> {
  if (reservedFullNames) return reservedFullNames;
  const set = new Set<string>();
  for (const raw of currentSquads as Array<{ name?: string }>) {
    if (raw?.name) set.add(normalizeFullName(raw.name));
  }
  reservedFullNames = set;
  return set;
}

function isNameTaken(fullName: string): boolean {
  const key = normalizeFullName(fullName);
  return getReservedFullNames().has(key) || sessionOccupiedNames.has(key);
}

/** Register names already in use so later generations do not collide. */
export function registerOccupiedPlayerNames(names: Iterable<string>): void {
  for (const name of names) {
    if (name) sessionOccupiedNames.add(normalizeFullName(name));
  }
}

/** Clear career-session occupied names (e.g. before a fresh career seed). */
export function clearOccupiedPlayerNames(): void {
  sessionOccupiedNames.clear();
}

function isBlockedSurname(lastName: string): boolean {
  return FAMOUS_RL_SURNAME_BLOCKLIST.has(normalizeSurname(lastName));
}

// ---------------------------------------------------------------------------
// 1. BRITISH & NORTHERN ENGLISH RL HEARTLANDS
// ---------------------------------------------------------------------------
export const BRITISH_FIRST_NAMES = [
  "Liam", "Jack", "Harry", "Oliver", "George", "Noah", "Charlie", "Jacob", "Alfie", "Freddie",
  "Sam", "Ben", "Joe", "Tom", "Will", "Dan", "Luke", "Alex", "Matty", "Brad",
  "Callum", "Cameron", "Lewis", "Josh", "Jordan", "Connor", "Tyler", "Kieran", "Ellis", "Mason",
  "Harvey", "Ethan", "Archie", "Oscar", "Lucas", "James", "Max", "Leo", "Logan", "Toby",
  "Harrison", "Zak", "Finlay", "Kai", "Bailey", "Reece", "Nathan", "Dylan", "Owen", "Aaron",
  "Scott", "Dean", "Craig", "Sean", "Leon", "Jamie", "Adam", "Danny", "Robbie", "Andy",
  "Paul", "Mark", "David", "Wayne", "Darren", "Ross", "Chris", "Declan", "Bradley", "Dominic",
  "Corey", "Brandon", "Ryan", "Ashton", "Kian", "Louie", "Jayden", "Reuben", "Isaac", "Dexter",
  "Fletcher", "Jude", "Seth", "Brody", "Sonny", "Cole", "Roman", "Reggie", "Bobby", "Ronnie",
  "Frank", "Arthur", "Stanley", "Ralph", "Ted", "Ned", "Jonty", "Travis", "Caleb", "Austin",
  "Drew", "Rowan", "Joel", "Taylor", "Blake", "Rhys", "Kyle", "Troy", "Shaun", "Greg",
  "Ricky", "Brett", "Russell", "Stuart", "Gavin", "Trevor", "Clive", "Roy", "Alan", "Keith",
  "Colin", "Ian", "Brian", "Graham", "Terry", "Ray", "Malcolm", "Derek", "Barry", "Martin",
  "Peter", "Matthew", "John", "Richard", "Stephen", "Carl", "Simon", "Jason", "Lee", "Neil",
  "Karl", "Christian", "Marcus", "Elliot", "Nathaniel", "Finley", "Keaton", "Preston", "Harley",
  "Rory", "Lennon", "Theo", "Jasper", "Miles", "Hugo", "Spencer", "Frankie", "Brodie", "Jed",
  "Billy", "Tommy", "Georgie", "Mikey", "Stevie", "Nicky", "Richie", "Gary", "Kevin", "Philip",
  "Antony", "Jonny", "Gareth", "Ashley", "Curtis", "Shane", "Warren", "Nigel", "Howard", "Norman",
];

export const BRITISH_LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
  "Thompson", "Evans", "White", "Roberts", "Green", "Wood", "Jackson", "Turner", "Harrison",
  "Ward", "Martin", "Cooper", "Morris", "King", "Watson", "Baker", "Shaw", "Holmes", "Fisher",
  "Bell", "Chapman", "Mason", "Butler", "Dixon", "Palmer", "Mills", "Simpson", "Marshall",
  "Ellis", "Fletcher", "Gibson", "Bennett", "Brooks", "Nicholson", "Eckersley", "Farrimond",
  "O'Connor", "Blake", "Ryan", "Parker", "Foster", "Harvey", "Knight", "Booth", "Baxter",
  "Carter", "Dawson", "Elliott", "Frost", "Hewitt", "Jarvis", "Kent", "Lawson", "Metcalfe",
  "Newton", "Osborne", "Pearson", "Quigley", "Reed", "Sutton", "Tate", "Underwood", "Vance",
  "Whitaker", "Yates", "Abbott", "Barlow", "Carver", "Dalton", "Eaton", "Aspinwall", "Astley",
  "Bate", "Bentham", "Bibby", "Boardman", "Bostock", "Brogan", "Bullough", "Bushell",
  "Butterworth", "Catterall", "Chisnall", "Clough", "Colquitt", "Cowen", "Craddock", "Critchley",
  "Crompton", "Crossley", "Dagger", "Derbyshire", "Dickinson", "Duckworth", "Dugdale",
  "Entwistle", "Fairclough", "Fazackerley", "Fishwick", "Grimshaw", "Hampson", "Hardman",
  "Hargreaves", "Haslam", "Haughton", "Heaton", "Holgate", "Hollingsworth", "Horrocks",
  "Houghton", "Hulme", "Ince", "Isherwood", "Kay", "Kershaw", "Kirk", "Langtree", "Leach",
  "Leatherbarrow", "Livesey", "Lunt", "Lythgoe", "Melling", "Moss", "Nield", "Nuttall",
  "Orrell", "Parkin", "Pilling", "Ramsbottom", "Rigby", "Rostron", "Rushton", "Shuttleworth",
  "Smethurst", "Southward", "Speakman", "Standish", "Starkey", "Stockley", "Stopford",
  "Sumner", "Sutch", "Swarbrick", "Taberner", "Threlfall", "Waterworth", "Whalley", "Wilding",
  "Wolstenholme", "Worsley", "Worthington", "Ashworth", "Whittle", "Heyes", "Partington",
  "Hesketh", "Pendlebury", "Atherton", "Bamber", "Birtwistle", "Bleasdale", "Brindle",
  "Carrington", "Charnock", "Copeland", "Dewhurst", "Eccleston", "Fairhurst", "Gerrard",
  "Greenhalgh", "Haworth", "Heap", "Holdsworth", "Horwich", "Ibbotson", "Jolly", "Kenyon",
  "Lightfoot", "Mawdsley", "Molyneux", "Norcross", "Ogden", "Parrington", "Pilkington",
  "Rawsthorne", "Sedgwick", "Singleton", "Thornley", "Tomlinson", "Tunstall", "Urmston",
  "Wainwright", "Whiteside", "Witherspoon", "Armitage", "Beaumont", "Craven", "Dyson",
  "Earnshaw", "Firth", "Greenwood", "Hainsworth", "Illingworth", "Jowett", "Kitson",
];

// ---------------------------------------------------------------------------
// 2. CELTIC (WALES, SCOTLAND, IRELAND)
// ---------------------------------------------------------------------------
export const CELTIC_FIRST_NAMES = [
  "Rhys", "Ieuan", "Carwyn", "Steffan", "Emyr", "Gethin", "Owain", "Rhodri", "Dafydd",
  "Gareth", "Huw", "Sion", "Lloyd", "Gwyn", "Bryn", "Cai", "Osian", "Jac", "Gruffydd",
  "Iwan", "Tomos", "Dyfan", "Aled", "Ifan", "Macsen", "Elis", "Ioan", "Arwyn", "Meirion",
  "Geraint", "Llyr", "Trystan", "Cynan", "Emrys", "Hywel", "Idris", "Llewelyn", "Maldwyn",
  "Ewan", "Fraser", "Hamish", "Callum", "Alistair", "Stuart", "Duncan", "Ross", "Craig",
  "Gregor", "Innes", "Brodie", "Rory", "Campbell", "Lachlan", "Finlay", "Niall", "Fergus",
  "Alasdair", "Murray", "Douglas", "Angus", "Struan", "Calum", "Euan", "Iain", "Ruairidh",
  "Torquil", "Keith", "Bruce", "Gordon", "Malcolm", "Neil", "Scott", "Andrew", "Findlay",
  "Harris", "Logan", "Arran", "Liam", "Connor", "Kieran", "Caelan", "Declan", "Aidan",
  "Finbar", "Ronan", "Eoin", "Cormac", "Patrick", "Fionn", "Ciaran", "Darragh", "Senan",
  "Tiernan", "Colm", "Donnacha", "Oisin", "Tadhg", "Padraig", "Seamus", "Cathal", "Diarmuid",
  "Fergal", "Lorcan", "Odhran", "Ruairi", "Shane", "Brendan", "Cillian", "Eoghan", "Killian",
  "Micheal", "Peadar", "Rian", "Tomas", "Ultan", "Conall", "Fionntan", "Oran", "Shea", "Dara",
];

export const CELTIC_LAST_NAMES = [
  "Davies", "Evans", "Jones", "Griffiths", "Lloyd", "Bevan", "Thomas", "Jenkins",
  "Hughes", "Lewis", "Owen", "Rees", "Parry", "Vaughan", "Hopkins", "Pritchard", "Prosser",
  "Meredith", "Llewellyn", "Bowen", "Havard", "Gough", "Howells", "Pugh", "Price",
  "Richards", "Phillips", "Rowlands", "Wynne", "Gwilym", "Cadwaladr", "Mathias", "Morgans",
  "Pembrey", "Treharne", "Elias", "Gower", "Harries", "Latham", "Prys", "Rhys", "Wyn",
  "Robertson", "Stewart", "Campbell", "Macleod", "Ferguson", "Anderson", "Scott", "Murray",
  "Ross", "Paterson", "Hamilton", "Wallace", "Burns", "MacIntyre", "MacLean", "Buchanan",
  "Sutherland", "Sinclair", "Fraser", "MacGregor", "MacKenzie", "MacKay", "Drummond", "Forbes",
  "Gordon", "Grant", "Innes", "Keith", "Lamont", "Lindsay", "MacDonald", "MacPherson",
  "Munro", "Napier", "Ramsay", "Strachan", "Urquhart", "Watt", "Young", "Aitken", "Baird",
  "Craig", "Dunbar", "Findlay", "Gilmour", "Henderson", "Irving", "Johnston", "Kerr",
  "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor", "O'Neill",
  "Reilly", "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch", "Quinn", "Moore",
  "McLoughlin", "McIntyre", "McNamara", "O'Hanlon", "Fitzpatrick", "O'Donnell", "Higgins",
  "Brennan", "Kearney", "Flanagan", "Kavanagh", "MacNamara", "O'Shea", "Treacy", "Tierney",
  "Brady", "Carey", "Daly", "Glynn", "Healy", "Joyce", "Keane", "Lenihan", "Maguire",
  "Nolan", "Power", "Roche", "Sweeney", "Tobin", "Whelan", "Burke", "Casey", "Dolan",
];

// ---------------------------------------------------------------------------
// 3. PACIFIC ISLAND & MĀORI (SAMOA, TONGA, FIJI, COOK ISLANDS, MĀORI, PNG)
// ---------------------------------------------------------------------------
export const PACIFIC_FIRST_NAMES = [
  "Sione", "Tevita", "Kelepi", "Maika", "Siua", "Sitili", "Ligi", "Mose", "Fetuli", "Samisoni",
  "Pauli", "Tui", "Viliami", "Taniela", "Mikaele", "Peni", "Siosiua", "Fa'amanu", "Ativalu",
  "Sunia", "Eliesa", "Simi", "Manase", "Mosese", "Salesi", "Latu", "Tolu", "Isaiya", "Felise",
  "Moeaki", "Tuiaki", "Siosifa", "Langi", "Toa", "Amani", "Sanele", "Taufa", "Semisi", "Uaisele",
  "Lisiate", "Ofa", "Siosaia", "Finau", "Kalolo", "Aleki", "Pita", "Iosefa", "Anitelu", "Tala",
  "Semi", "Suliasi", "Vilame", "Viliame", "Josaia", "Apisai", "Tesi", "Waqa", "Iliesa", "Simione",
  "Josateki", "Penioni", "Netane", "Epeli", "Apenisa", "Marika", "Kitione", "Lepani", "Ratu", "Seru",
  "Timoci", "Waisea", "Alipate", "Isoa", "Jone", "Kolinio", "Nemani", "Peceli", "Wiremu", "Taine",
  "Rangi", "Kaea", "Manaia", "Tama", "Ariki", "Hemi", "Rawiri", "Tamati", "Hohepa", "Nikau",
  "Tane", "Kauri", "Matiu", "Rewi", "Tipene", "Anaru", "Hone", "Kahu", "Mikaere", "Paora",
  "Ropata", "Taika", "Whetu", "Ihaia", "Mahanga", "Tawhiri", "Teina", "Tinirau", "Malachi",
  "Esan", "Kayal", "Zane", "Cassidy", "Morea", "Epel", "Rodrick", "Sylvester", "Nixon", "Justin",
  "Emmanuel", "Judah", "Edwin", "Israel", "Lazarus", "Stanton", "Wellington", "Junior", "Francis",
  "Franklin", "Nelson", "Isaac", "Jesse", "Moses", "Stephen", "David", "Kevin", "Joseph", "Daniel",
  "Samuel", "Benjamin", "Michael", "Peter", "John", "James", "Andrew", "Thomas", "Aisea", "Savenaca",
];

export const PACIFIC_LAST_NAMES = [
  "Autagavaia", "Tuala", "Fale", "Anae", "Ulugia", "Vaega", "Tofa", "Leaupepe", "Tupai", "Fualau",
  "Solofa", "Mulipola", "Taufete'e", "Aiolupotea", "Fata", "Sanele", "Vaafusuaga", "Tofilau",
  "Pule", "Amosa", "Enosa", "Fa'alogo", "Iosefa", "Leavasa", "Malo", "Nua", "Salavea", "Taito",
  "Tanielu", "Uati", "Vili", "Afoa", "Ale", "Filo", "Galu", "Iuli", "Kuresa", "Lauano",
  "Mamea", "Niko", "Olo", "Fonokalafi", "Mahe", "Lavulo", "Feki", "Tu'itavake", "Vaea", "Helu",
  "Tatupu", "Finau", "Havea", "Latu", "Ma'afu", "Naufahu", "Palu", "Taufa", "Uhi", "Vailea",
  "Afu", "Fainga'a", "Heimuli", "Kolo", "Lolo", "Manu'atu", "Ofa", "Pulu", "Siola'a", "Tali",
  "Tongia", "Uasike", "Veikoso", "Qoro", "Cavuilati", "Natoga", "Cagilaba", "Tikoisuva",
  "Draunidalo", "Bukuya", "Nagusa", "Qaluma", "Raiwalui", "Saumaki", "Tagi", "Naisoro",
  "Vakacegu", "Wainiqolo", "Bale", "Cakau", "Dawai", "Koroi", "Lomani", "Mataika", "Nabuli",
  "Qio", "Ratu", "Saukuru", "Tiko", "Uluiviti", "Vakatawa", "Waqa", "Yavala", "Bola", "Gavidi",
  "Koro", "Lalabalavu", "Reweti", "Herewini", "Tamihana", "Ngata", "Mahuta", "Heke", "Waititi",
  "Potatau", "Te Rangi", "Whatu", "Kahukiwa", "Maniapoto", "Ngatai", "Paikea", "Raukawa",
  "Tawhai", "Wharepapa", "Awatere", "Hapi", "Iwikau", "Kereama", "Moko", "Parata", "Ruru",
  "Taiaroa", "Uru", "Waka", "Taripo", "Mateariki", "Pini", "Heather", "Noovao", "Paitai",
  "Puna", "Tou", "Ioane", "Vaine", "Matamua", "Short", "Tepaki", "Tuatini", "Waira", "Geno",
  "Kaugla", "Kapena", "Amini", "Numapo", "Gima", "Riyong", "Yere", "Kuamin", "Valu", "Gebbie",
  "Naiyep", "Waine", "Alick", "Kila", "Muri", "Oa", "Poka", "Sina", "Tari", "Ume", "Vagi",
];

// ---------------------------------------------------------------------------
// 4. FRENCH (CATALANS, TOULOUSE, OCCITANIE & AUDE)
// ---------------------------------------------------------------------------
export const FRENCH_FIRST_NAMES = [
  "Arthur", "Romain", "Matthieu", "César", "Théo", "Ugo", "Benjamin", "Julian", "Mickaël",
  "Jordan", "Eloi", "Paul", "Tanguy", "Lambert", "Justin", "Corentin", "Maxime", "Thomas", "Lucas",
  "Anthony", "Enzo", "Florian", "Bastien", "Guillaume", "Robin", "Clément", "Rémi", "Jean", "Pierre",
  "Louis", "Fabien", "Laurent", "Sébastien", "Vincent", "Nicolas", "Alexandre", "Valentin", "Hugo",
  "Axel", "Lilian", "Damien", "Yoan", "Loïc", "Adrien", "Gilles", "Christophe", "Stéphane", "Franck",
  "Cédric", "Yannick", "Dorian", "Mathias", "Thibault", "Kylian", "Nathanaël", "Gabin", "Sacha",
  "Malo", "Antonin", "Baptiste", "Ethan", "Noé", "Raphaël", "Quentin", "Tristan", "Yanis",
  "Zacharie", "Amine", "Bruno", "Cyril", "Didier", "Étienne", "Francis", "Grégoire", "Henri",
  "Ismaël", "Jérôme", "Killian", "Luc", "Marc", "Noël", "Olivier", "Pascal", "Renaud", "Sylvain",
];

export const FRENCH_LAST_NAMES = [
  "Bonnet", "Valls", "Fabre", "Fontanier", "Perez", "Boyer", "Dupuy", "Calvet", "Vidal", "Roux",
  "Blanc", "Morel", "Laurent", "Simon", "Bernard", "Rey", "Marty", "Arnaud", "Prat", "Pons",
  "Pages", "Garrigues", "Castany", "Doutres", "Delgado", "Crunel", "Castel", "Ferret", "Verges",
  "Carrasco", "Martins", "Marguerite", "Robin", "Aubert", "Bardon", "Cazals", "Delmas", "Estève",
  "Fournier", "Giraud", "Hugues", "Izard", "Jouve", "Lacombe", "Masson", "Noël", "Ortega",
  "Pujol", "Riviere", "Salles", "Teisseire", "Vila", "Alary", "Boudet", "Cayla", "Durand",
  "Escribe", "Faure", "Gaubert", "Hourcade", "Icard", "Jalabert", "Lacroix", "Maurel", "Nadal",
  "Olive", "Peiret", "Ribas", "Serres", "Toulouse", "Vidalenc", "Amiel", "Barre", "Cabrol",
  "Dumas", "Estang", "Fabreau", "Gautier", "Herve", "Icher", "Joubert", "Lavigne", "Mestre",
];

// ---------------------------------------------------------------------------
// 5. AUSTRALIAN & NEW ZEALAND (ANTIPODEAN)
// ---------------------------------------------------------------------------
export const ANTIPODEAN_FIRST_NAMES = [
  // Australian
  "Mitchell", "Lachlan", "Cooper", "Brodie", "Blake", "Jai", "Jayden", "Tyson", "Cody", "Clint",
  "Corey", "Jarrod", "Bevan", "Cade", "Tex", "Brayden", "Brock", "Beau", "Todd", "Dane",
  "Brett", "Trent", "Matt", "Scott", "Glenn", "Craig", "Brad", "Nathan", "Reece", "Jake",
  "Angus", "Hudson", "Toby", "Patrick", "Travis", "Dale", "Bryson", "Kurt", "Aaron", "Daniel",
  "Xavier", "Ezra", "Braxton", "Campbell", "Harry", "Jack", "Tom", "Cameron", "Ryan", "Liam",
  "Ethan", "Bailey", "Connor", "Max", "Oscar", "Sam", "Will", "Ben", "Josh", "Luke",
  "Adam", "Sean", "Shane", "Kieran", "Jordan", "Jarryd", "Heath", "Zac", "Joel", "Ty",
  "Ned", "Flynn", "Harvey", "Riley", "Archer", "Hunter", "Jett", "Kai", "Nate", "Owen",
  // New Zealand / Kiwi
  "Dallin", "Kodi", "Isaiah", "Joseph", "Casey", "Jesse", "Jackson", "Harley", "Phoenix", "Leo",
  "Niko", "Tyrell", "Wiremu", "Taine", "Rangi", "Kaea", "Manaia", "Nikau", "Rewi", "Hemi",
  "Callum", "Hamish", "Fraser", "Blair", "Logan", "Cody", "Zane", "Rico", "Cruz", "Jaxon",
  "Arlo", "Finn", "George", "Hugo", "Mason", "Noah", "Oliver", "Theo", "William", "Xavier",
];

export const ANTIPODEAN_LAST_NAMES = [
  // Australian (non-celebrity)
  "North", "Hanley", "Barlow", "Corcoran", "Sullivan", "Matthews", "Brennan", "Cassidy",
  "Donovan", "Gallagher", "Harrington", "Irving", "Jennings", "Langford", "Madden", "Nolan",
  "Quinn", "Rutherford", "Stanton", "Tully", "Vaughan", "Whitaker", "Yates", "Abbott", "Crowley",
  "Duggan", "Everett", "Faulkner", "Goddard", "Henderson", "Ingram", "Jowsey", "Keating",
  "Larkin", "McAllister", "Newcombe", "Oakes", "Patterson", "Quigley", "Redmond", "Sheffield",
  "Talbot", "Underwood", "Vickers", "Westbrook", "Yardley", "Ashcroft", "Berryman", "Callaghan",
  "Driscoll", "Ellison", "Fitzgerald", "Gleeson", "Isherwood", "Jefferies",
  "Kavanagh", "Lonergan", "McKenzie", "Nettlefold", "O'Reilly", "Pendleton", "Quirk", "Riordan",
  "Sutherland", "Thornbury", "Upton", "Vernon", "Whitelaw", "Younger", "Bannister", "Caldwell",
  "Cavanagh", "Duffy", "Egan", "Farrell", "Gorman", "Healy", "Irvine", "Jensen", "Keenan",
  "Larsson", "Molloy", "Noonan", "O'Byrne", "Phelan", "Quiggin", "Rafter", "Scanlon", "Tynan",
  // New Zealand / Kiwi (Anglo + Māori non-star)
  "Ashby", "Aspden", "Bevin", "Drysdale", "Easton", "Fairweather", "Hadfield",
  "Kirkland", "Lethbridge", "Macalister", "Northcott", "Ormond", "Rennie",
  "Tait", "Ure", "Wainwright", "Yeoman", "Aitken", "Bain", "Cowie",
  "Ewen", "Forsyth", "Gilmour", "Hewitson", "Jamieson", "Kerr",
  "Lowry", "McGregor", "Neill", "Ogilvie", "Paterson", "Strachan", "Tennant",
  "Verry", "Watt", "Barrowclough", "Dewar", "Findlay", "Hepburn", "Laidlaw",
  "Middleton", "Penrose", "Quigley", "Roxburgh", "Sinclair", "Torrance", "Unger",
  "Vickers", "Whitford", "Ainsworth", "Bracewell", "Caldwell", "Duff", "Edmonds",
  "Herewini", "Kahukiwa", "Ngatai", "Parata", "Reweti", "Taiaroa", "Whatu", "Waka",
  "Puna", "Mateariki", "Taripo", "Noovao", "Tuatini", "Heather", "Paitai",
];

// ---------------------------------------------------------------------------
// OTHER (small UK spillover pool — European / mixed flavour)
// ---------------------------------------------------------------------------
export const OTHER_FIRST_NAMES = [
  "Marco", "Luca", "Mateo", "Andre", "Nikolas", "Stefan", "Erik", "Jonas", "Oskar", "Felix",
  "Adrian", "Victor", "Leo", "Hugo", "Emile", "Rafael", "Diego", "Sergio", "Ivan", "Anton",
];

export const OTHER_LAST_NAMES = [
  "Rossi", "Bianchi", "Moreau", "Dupont", "Novak", "Horvat", "Nielsen", "Jensen", "Berg",
  "Lind", "Keller", "Weber", "Fischer", "Schneider", "Costa", "Silva", "Oliveira", "Santos",
  "Petrov", "Ivanov",
];

// ---------------------------------------------------------------------------
// CONSOLIDATED MASTER ARRAYS
// ---------------------------------------------------------------------------
function filterSafeLastNames(names: string[]): string[] {
  return names.filter((n) => !isBlockedSurname(n));
}

const SAFE_BRITISH_LAST = filterSafeLastNames(BRITISH_LAST_NAMES);
const SAFE_CELTIC_LAST = filterSafeLastNames(CELTIC_LAST_NAMES);
const SAFE_PACIFIC_LAST = filterSafeLastNames(PACIFIC_LAST_NAMES);
const SAFE_FRENCH_LAST = filterSafeLastNames(FRENCH_LAST_NAMES);
const SAFE_ANTIPODEAN_LAST = filterSafeLastNames(ANTIPODEAN_LAST_NAMES);
const SAFE_OTHER_LAST = filterSafeLastNames(OTHER_LAST_NAMES);

export const FIRST_NAMES: string[] = Array.from(
  new Set([
    ...BRITISH_FIRST_NAMES,
    ...CELTIC_FIRST_NAMES,
    ...PACIFIC_FIRST_NAMES,
    ...FRENCH_FIRST_NAMES,
    ...ANTIPODEAN_FIRST_NAMES,
    ...OTHER_FIRST_NAMES,
  ])
);

export const LAST_NAMES: string[] = Array.from(
  new Set([
    ...SAFE_BRITISH_LAST,
    ...SAFE_CELTIC_LAST,
    ...SAFE_PACIFIC_LAST,
    ...SAFE_FRENCH_LAST,
    ...SAFE_ANTIPODEAN_LAST,
    ...SAFE_OTHER_LAST,
  ])
);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSafeLast(pool: string[]): string {
  const safe = pool === SAFE_BRITISH_LAST || pool === SAFE_CELTIC_LAST || pool === SAFE_PACIFIC_LAST
    || pool === SAFE_FRENCH_LAST || pool === SAFE_ANTIPODEAN_LAST || pool === SAFE_OTHER_LAST
    ? pool
    : filterSafeLastNames(pool);
  const source = safe.length > 0 ? safe : SAFE_BRITISH_LAST;
  for (let i = 0; i < 12; i++) {
    const last = pickRandom(source);
    if (!isBlockedSurname(last)) return last;
  }
  return pickRandom(source);
}

type NameRegion =
  | "british"
  | "celtic"
  | "pacific"
  | "french"
  | "antipodean"
  | "other";

function poolsForRegion(region: NameRegion): {
  firsts: string[];
  lasts: string[];
  nationality: () => string;
} {
  switch (region) {
    case "british":
      return {
        firsts: BRITISH_FIRST_NAMES,
        lasts: SAFE_BRITISH_LAST,
        nationality: () => "England",
      };
    case "celtic":
      return {
        firsts: CELTIC_FIRST_NAMES,
        lasts: SAFE_CELTIC_LAST,
        nationality: () => pickRandom(["Wales", "Scotland", "Ireland", "England"]),
      };
    case "pacific":
      return {
        firsts: PACIFIC_FIRST_NAMES,
        lasts: SAFE_PACIFIC_LAST,
        nationality: () =>
          pickRandom([
            "Samoa",
            "Tonga",
            "Fiji",
            "Cook Islands",
            "Papua New Guinea",
            "New Zealand",
          ]),
      };
    case "french":
      return {
        firsts: FRENCH_FIRST_NAMES,
        lasts: SAFE_FRENCH_LAST,
        nationality: () => "France",
      };
    case "antipodean":
      return {
        firsts: ANTIPODEAN_FIRST_NAMES,
        lasts: SAFE_ANTIPODEAN_LAST,
        nationality: () => (Math.random() < 0.58 ? "Australia" : "New Zealand"),
      };
    case "other":
    default:
      return {
        firsts: OTHER_FIRST_NAMES,
        lasts: SAFE_OTHER_LAST,
        nationality: () => pickRandom(["England", "France", "Italy", "Spain"]),
      };
  }
}

function pickRegionForClub(clubId?: string | null): NameRegion {
  const normClub = (clubId || "").toLowerCase();

  // French clubs: Catalans Dragons, Toulouse Olympique — mostly French
  if (normClub.includes("catalans") || normClub.includes("toulouse")) {
    const roll = Math.random();
    if (roll < 0.68) return "french";
    if (roll < 0.82) return "pacific";
    if (roll < 0.93) return "antipodean";
    return "british";
  }

  // Welsh clubs — lean Celtic
  if (normClub.includes("crusader") || normClub.includes("wales")) {
    const roll = Math.random();
    if (roll < 0.55) return "celtic";
    if (roll < 0.78) return "british";
    if (roll < 0.90) return "pacific";
    return "antipodean";
  }

  // Standard UK Super League & Championship clubs
  // ~50% British, ~12% Celtic, ~20% Pacific, ~15% Antipodean, ~3% other
  const roll = Math.random();
  if (roll < 0.5) return "british";
  if (roll < 0.62) return "celtic";
  if (roll < 0.82) return "pacific";
  if (roll < 0.97) return "antipodean";
  return "other";
}

function buildNameFromRegion(region: NameRegion): GeneratedPlayerName {
  const { firsts, lasts, nationality } = poolsForRegion(region);
  const firstName = pickRandom(firsts);
  const lastName = pickSafeLast(lasts);
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    nationality: nationality(),
  };
}

const MIDDLE_INITIALS = "ABCDEFGHJKLMNPRSTW";

/**
 * Generates an authentic player name tailored to club identity and regional flavor.
 * - French clubs (Catalans, Toulouse) receive predominantly authentic French names.
 * - Welsh clubs receive higher Welsh/Celtic distribution.
 * - General British clubs: ~50% British, ~12% Celtic, ~20% Pacific, ~15% Antipodean, ~3% other.
 * Retries until the full name is not already in current-squads.json and the surname
 * is not on the famous RL blocklist.
 */
export function generateRandomPlayerName(clubId?: string | null): GeneratedPlayerName {
  // Ensure squad denylist is warm even if no session names registered yet
  getReservedFullNames();
  const region = pickRegionForClub(clubId);
  const { firsts, lasts, nationality } = poolsForRegion(region);

  let lastAttempt: GeneratedPlayerName | null = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = buildNameFromRegion(region);
    lastAttempt = candidate;
    if (isBlockedSurname(candidate.lastName)) continue;
    if (isNameTaken(candidate.fullName)) continue;
    registerOccupiedPlayerNames([candidate.fullName]);
    return candidate;
  }

  // Prefer a different last name with the same first name / region
  const firstName = lastAttempt?.firstName ?? pickRandom(firsts);
  const nat = lastAttempt?.nationality ?? nationality();
  for (let i = 0; i < 40; i++) {
    const lastName = pickSafeLast(lasts);
    if (isBlockedSurname(lastName)) continue;
    const fullName = `${firstName} ${lastName}`;
    if (isNameTaken(fullName)) continue;
    registerOccupiedPlayerNames([fullName]);
    return { firstName, lastName, fullName, nationality: nat };
  }

  // Last resort: rare middle initial to uniquify (keep first/last fields clean)
  const lastName = pickSafeLast(lasts);
  const initial = MIDDLE_INITIALS[Math.floor(Math.random() * MIDDLE_INITIALS.length)];
  const fullName = `${firstName} ${initial}. ${lastName}`;
  if (!isNameTaken(fullName) && !isBlockedSurname(lastName)) {
    registerOccupiedPlayerNames([fullName]);
    return { firstName, lastName, fullName, nationality: nat };
  }

  // Absolute fallback: Jr suffix on full name only
  const jrName = `${firstName} ${lastName} Jr`;
  registerOccupiedPlayerNames([jrName]);
  return {
    firstName,
    lastName,
    fullName: jrName,
    nationality: nat,
  };
}
