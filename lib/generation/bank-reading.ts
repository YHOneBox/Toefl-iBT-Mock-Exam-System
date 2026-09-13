import { makeId } from "../ids";
import type { AcademicSet, DailyLifeSet, ModuleTag } from "../types";
import { buildCompleteTheWords } from "./ctw";
import { cefrAllowed, type DifficultyBand } from "./difficulty";
import { mcq } from "./util";

const CTW_PASSAGES: Array<{ topic: string; text: string }> = [
  {
    topic: "Life Sciences",
    text:
      "Mushrooms are the visible fruiting bodies of fungi that live mostly underground. A single organism may spread through soil as a hidden network of threads called mycelium. These threads absorb nutrients from decaying plants and recycle them back into the ecosystem. Consequently, forests depend on fungi to break down fallen leaves and wood. Some species also form partnerships with tree roots, exchanging minerals for sugars. Scientists now recognize that such partnerships can stretch across huge areas. Therefore, a mushroom on the forest floor is often only a small clue to a much larger living system.",
  },
  {
    topic: "Physical Sciences",
    text:
      "Glaciers form when snow accumulates for many years and is compressed into dense ice. Gravity then pulls the ice slowly downhill through valleys or outward from ice sheets. As a glacier moves, it scrapes rock from the landscape and carries the debris along. When the ice finally melts, it drops that material and creates distinctive ridges and lakes. Researchers study layers inside glaciers because they trap ancient air and dust. Those layers therefore preserve a record of past climate. However, many glaciers are now shrinking as global temperatures rise.",
  },
  {
    topic: "History",
    text:
      "Railroads transformed nineteenth-century North America by linking distant markets and settlements. Before tracks were laid, moving grain or coal over land was slow and expensive. Trains reduced travel time and allowed towns to grow far from navigable rivers. They also created new jobs in construction, manufacturing, and station services. At the same time, the industry displaced some communities and changed local economies almost overnight. Historians therefore treat the railroad as both an engine of growth and a source of social tension. Its influence can still be seen in the location of many modern cities.",
  },
  {
    topic: "Art and Music",
    text:
      "Glass mirrors became widely available during the Renaissance and quietly changed how people saw themselves. Earlier polished metal surfaces produced dim, distorted reflections. Clear glass coated with metal allowed artists and patrons to study faces in new detail. Some historians argue that this technology encouraged more intimate portraiture. It also supported scientific work, because accurate reflection helped in the study of light. However, mirrors remained luxury objects for a long time. Only later did cheaper production make them common in ordinary homes.",
  },
  {
    topic: "Business",
    text:
      "Just-in-time inventory systems try to deliver parts exactly when a factory needs them. The approach reduces warehouse costs and limits money tied up in unused materials. It also forces companies to keep close relationships with reliable suppliers. However, the system is vulnerable when shipping is delayed or demand suddenly changes. A missing component can stop an entire production line. Managers therefore balance efficiency against the need for a small safety stock. In practice, the best plan depends on how predictable the supply chain really is.",
  },
  {
    topic: "Social Sciences",
    text:
      "Public parks do more than decorate a city. They give residents places to exercise, meet neighbors, and cool off during hot weather. Urban researchers have found that nearby green space is often linked with lower stress and stronger community ties. Parks can also raise the value of surrounding housing, which may push some families to move. City planners therefore debate how to add parks without increasing inequality. One approach is to place new green space in neighborhoods that currently have little access to it. The goal is to spread the benefits more evenly across the city.",
  },
];

const DAILY: Array<Omit<DailyLifeSet, "id" | "module" | "taskType">> = [
  {
    cefr: "A2",
    topic: "Campus life",
    format: "email",
    title: "Library hours update",
    text:
      "From: Central Library\nTo: All students\nSubject: Weekend hours this month\n\nThe main library will close at 6:00 p.m. on Saturdays during renovation of the second floor. Sunday hours remain 10:00 a.m. to 8:00 p.m. Course reserves can still be requested at the first-floor desk. If you need a quiet room after 6:00 on Saturday, the science building study lounge will stay open.",
    questions: [
      mcq(
        "Why are Saturday hours shorter this month?",
        [
          "The library is moving to the science building.",
          "Part of the library is being renovated.",
          "Sunday hours were expanded instead.",
          "Course reserves are no longer available.",
        ],
        1,
        "The email says the library closes earlier because of second-floor renovation.",
        "purpose",
        "A2",
      ),
      mcq(
        "Where can students study late on Saturday?",
        [
          "The second-floor reading room",
          "The course-reserves desk only",
          "The science building study lounge",
          "The library cafe",
        ],
        2,
        "The lounge in the science building stays open after 6:00 on Saturday.",
        "factual",
        "A2",
      ),
    ],
  },
  {
    cefr: "A2",
    topic: "Campus life",
    format: "notice",
    title: "Dining hall notice",
    text:
      "West Hall Dining will switch to a reduced menu from March 3 to March 7 while the serving line is repaired. Breakfast will be served from 7:30 to 9:30 only. Students with meal plans may use East Hall at no extra cost. Please return trays to the marked carts to keep the temporary line moving.",
    questions: [
      mcq(
        "What is the main purpose of the notice?",
        [
          "To advertise a new breakfast menu",
          "To explain temporary dining changes",
          "To close West Hall permanently",
          "To raise the price of meal plans",
        ],
        1,
        "The notice explains a short-term reduced menu and alternate dining option.",
        "purpose",
        "A2",
      ),
      mcq(
        "What can meal-plan students do during the repair?",
        [
          "Pay extra to stay at West Hall",
          "Skip breakfast for the week",
          "Eat at East Hall without an extra charge",
          "Reserve trays in advance",
        ],
        2,
        "Meal-plan students may use East Hall at no extra cost.",
        "factual",
        "A2",
      ),
    ],
  },
  {
    cefr: "B1",
    topic: "Campus life",
    format: "social",
    title: "Campus recreation post",
    text:
      "Rec Center: Saturday sunrise hike is ON. Meet at Gate C at 6:45 a.m. Bring water and closed-toe shoes. The van returns by 11:00. If rain is heavy at 6:00, we will post a gym substitute workout here. Sign-up list is full; waitlist only.",
    questions: [
      mcq(
        "What should students bring?",
        [
          "A meal card and an umbrella",
          "Water and closed-toe shoes",
          "A signed waiver at Gate A",
          "Cash for the van",
        ],
        1,
        "The post asks for water and closed-toe shoes.",
        "factual",
        "B1",
      ),
      mcq(
        "What happens if rain is heavy at 6:00?",
        [
          "The hike is delayed until afternoon.",
          "Students meet at the library instead.",
          "A gym workout will replace the hike.",
          "The waitlist is canceled.",
        ],
        2,
        "A gym substitute workout will be posted if rain is heavy.",
        "inference",
        "B1",
      ),
      mcq(
        "Why might a student be unable to join?",
        [
          "The sign-up list is already full.",
          "Gate C is closed on Saturday.",
          "The van is reserved for staff.",
          "The rec center requires a meal plan.",
        ],
        0,
        "The post says the sign-up list is full and only a waitlist remains.",
        "factual",
        "B1",
      ),
    ],
  },
  {
    cefr: "B1",
    topic: "Campus life",
    format: "schedule",
    title: "Tech bar appointments",
    text:
      "Tech Bar — Week of April 14\nMon–Thu: 11:00 a.m.–7:00 p.m.\nFri: 11:00 a.m.–4:00 p.m.\nLaptop repair drop-off ends 60 minutes before closing. Password resets are walk-in only. Bring your student ID. After-hours tickets submitted online are answered the next business morning.",
    questions: [
      mcq(
        "When must a laptop be dropped off on Friday?",
        [
          "Any time before 7:00 p.m.",
          "No later than 3:00 p.m.",
          "Only after an online ticket is opened",
          "Monday morning",
        ],
        1,
        "Friday closing is 4:00, and drop-off ends 60 minutes earlier.",
        "factual",
        "B1",
      ),
      mcq(
        "Which service does not require an appointment?",
        ["Laptop repair", "Password resets", "After-hours tickets", "ID replacement"],
        1,
        "Password resets are walk-in only.",
        "factual",
        "B1",
      ),
    ],
  },
  {
    cefr: "A2",
    topic: "Campus life",
    format: "sign",
    title: "Dorm laundry sign",
    text:
      "Laundry Room B\nMachines stop at 11:00 p.m.\nRemove clothes promptly.\nDo not leave detergent on the floor.\nOut-of-order washer #3: use Room C on floor 2.\nReport problems to Housing with the machine number.",
    questions: [
      mcq(
        "What should residents do if washer #3 does not work?",
        [
          "Wait until after 11:00 p.m.",
          "Use Room C on the second floor",
          "Call the campus police desk",
          "Leave detergent beside the machine",
        ],
        1,
        "The sign directs people to Room C on floor 2.",
        "factual",
        "A2",
      ),
      mcq(
        "What information is needed when reporting a problem?",
        ["The room key code", "The machine number", "A photo of the floor", "A housing deposit"],
        1,
        "Reports should include the machine number.",
        "factual",
        "A2",
      ),
    ],
  },
  {
    cefr: "B1",
    topic: "Campus life",
    format: "email",
    title: "Study group message",
    text:
      "Hi team — I booked Study Room 214 for Thursday 7–9 p.m. Please finish the problem set draft before then so we can compare answers. Maya cannot come, so she will send notes by 6. If 214 is locked, use the overflow seats near the periodicals. Bring a charger if you can; outlets are limited.",
    questions: [
      mcq(
        "What should members do before the meeting?",
        [
          "Print Maya's notes",
          "Finish a draft of the problem set",
          "Move the booking to Friday",
          "Meet at the periodicals desk",
        ],
        1,
        "They are asked to finish the problem set draft first.",
        "factual",
        "B1",
      ),
      mcq(
        "Why might someone go to the periodicals area?",
        [
          "Maya is presenting there.",
          "Room 214 might be locked.",
          "Outlets are better there.",
          "The problem set is stored there.",
        ],
        1,
        "Overflow seats near periodicals are the backup if 214 is locked.",
        "inference",
        "B1",
      ),
      mcq(
        "What is limited in Room 214?",
        ["Seats", "Time", "Electrical outlets", "Printed notes"],
        2,
        "The message says outlets are limited.",
        "factual",
        "B1",
      ),
    ],
  },
];

const ACADEMIC: Array<Omit<AcademicSet, "id" | "module" | "taskType">> = [
  {
    cefr: "B2",
    topic: "Life Sciences",
    title: "Diel vertical migration",
    text:
      "Every day, countless tiny animals in the ocean travel up and down the water column. This behavior, called diel vertical migration, is one of the largest movements of biomass on Earth. At night, zooplankton rise toward the surface to feed on phytoplankton. At dawn they descend into darker water, where they are harder for predators to see. The journey also helps move carbon from surface waters to deeper layers, because waste and remains sink after the animals feed. Scientists once thought the pattern was driven only by light. However, recent studies show that hunger, temperature, and oxygen levels can change how far and how often the animals travel. Understanding the migration therefore matters for climate models as well as for marine food webs. Even a small shift in timing can affect how much carbon is stored in the deep ocean.",
    questions: [
      mcq(
        "What is the main idea of the passage?",
        [
          "Phytoplankton hide from zooplankton during the day.",
          "Daily up-and-down travel by zooplankton has ecological and climate effects.",
          "Ocean animals migrate only when oxygen is low.",
          "Carbon sinks only at night in warm seas.",
        ],
        1,
        "The passage explains the migration and why it matters for food webs and carbon.",
        "main idea",
        "B2",
      ),
      mcq(
        "Why do the animals go deeper at dawn?",
        [
          "The surface becomes too cold.",
          "They can store more carbon there.",
          "Darker water makes them harder to see.",
          "Phytoplankton disappear at night.",
        ],
        2,
        "They descend because they are harder for predators to see in darker water.",
        "factual",
        "B2",
      ),
      mcq(
        "In paragraph 1, the word \"remains\" is closest in meaning to",
        ["continues", "leftover material", "scientific records", "deep currents"],
        1,
        "Waste and remains that sink are leftover material after feeding.",
        "vocabulary",
        "B2",
      ),
      mcq(
        "What can be inferred about earlier scientific views?",
        [
          "Researchers ignored carbon storage.",
          "Light was thought to be the only main cause.",
          "Temperature was considered more important than hunger.",
          "The migration was believed to happen weekly.",
        ],
        1,
        "The passage says scientists once thought the pattern was driven only by light.",
        "inference",
        "B2",
      ),
      mcq(
        "Why does the author mention climate models?",
        [
          "To argue that zooplankton should be removed from food webs",
          "To show that migration timing can change carbon storage estimates",
          "To compare ocean models with weather forecasts",
          "To claim that light no longer affects the animals",
        ],
        1,
        "A timing shift can affect how much carbon is stored, so models need the behavior.",
        "rhetorical purpose",
        "B2",
      ),
    ],
  },
  {
    cefr: "B2",
    topic: "History",
    title: "Early cinema and peepshows",
    text:
      "Before public movie theaters became common, many people first saw moving pictures in peepshow machines. A customer dropped a coin into a wooden cabinet and looked through a small lens at a short looping film. The images were private, brief, and often sensational. Because only one person could watch at a time, exhibitors placed rows of machines in arcades and train stations. This business model shaped early film length: producers kept scenes short enough to hold a standing viewer. Later, projected films in dark halls changed the social experience. Strangers sat together and watched the same story, which encouraged longer narratives and more complex editing. Historians therefore see the shift from peepshow to theater as a change in technology and in public life. The later cinema audience was not simply larger; it was shared.",
    questions: [
      mcq(
        "What limited the length of early peepshow films?",
        [
          "The cost of train-station rent",
          "The need to keep a standing customer interested",
          "Laws against long public gatherings",
          "A shortage of wooden cabinets",
        ],
        1,
        "Producers kept scenes short enough for a standing viewer.",
        "factual",
        "B2",
      ),
      mcq(
        "Which of the following is NOT mentioned as a peepshow location?",
        ["Arcades", "Train stations", "Public theaters", "Rows of machines"],
        2,
        "Public theaters belong to the later projected-film stage.",
        "negative factual",
        "B2",
      ),
      mcq(
        "The word \"sensational\" in the passage is closest in meaning to",
        ["scientific", "designed to shock or excite", "carefully documented", "silent"],
        1,
        "Sensational images are meant to excite or startle.",
        "vocabulary",
        "B2",
      ),
      mcq(
        "What does the author suggest about theater audiences?",
        [
          "They preferred looping films.",
          "They watched privately and quickly.",
          "Sharing a story changed how films were made.",
          "They rejected complex editing.",
        ],
        2,
        "Sitting together encouraged longer narratives and more complex editing.",
        "inference",
        "B2",
      ),
      mcq(
        "Look at the four squares where the sentence could be added: \"That privacy was part of the attraction.\" Where does it best fit after the sentence about looking through a lens?",
        [
          "After the sentence about the coin and lens",
          "After the sentence about projected films",
          "After the sentence about complex editing",
          "After the final sentence",
        ],
        0,
        "The added sentence comments on the private viewing described early in the passage.",
        "insert text",
        "B2",
      ),
    ],
  },
  {
    cefr: "C1",
    topic: "Physical Sciences",
    title: "Water and marine life",
    text:
      "Water’s physical properties strongly influence what can live in the sea. Cold water is denser than warm water, so it can sink and carry oxygen downward. Pressure increases with depth, which changes the solubility of gases and the structure of proteins in deep-dwelling animals. Viscosity, the internal resistance of a fluid, is higher in cold water and makes swimming more costly for small organisms. These facts help explain why some species stay in narrow temperature bands. They are not simply preferring comfort; their bodies are tuned to a particular combination of density, pressure, and viscosity. When surface waters warm, layers can become more stable and mix less. Nutrients then remain trapped below the sunlit zone, and phytoplankton growth may decline. Marine scientists therefore treat temperature change as a chemical and physical problem, not only a biological one.",
    questions: [
      mcq(
        "What is the passage mainly about?",
        [
          "Why phytoplankton prefer warm water",
          "How physical features of water shape marine life",
          "How pressure is measured in laboratories",
          "Why swimming is easy for all small organisms",
        ],
        1,
        "The passage links density, pressure, and viscosity to living conditions.",
        "main idea",
        "C1",
      ),
      mcq(
        "Why can cold water help oxygen reach deeper layers?",
        [
          "It is less viscous than warm water.",
          "It is denser and can sink.",
          "It dissolves less gas at the surface.",
          "It prevents phytoplankton growth.",
        ],
        1,
        "Denser cold water can sink and carry oxygen downward.",
        "factual",
        "C1",
      ),
      mcq(
        "What can be inferred when surface layers mix less?",
        [
          "Deep animals immediately move upward.",
          "Nutrients may not reach the sunlit zone as easily.",
          "Viscosity no longer affects small organisms.",
          "Pressure at the surface increases sharply.",
        ],
        1,
        "If mixing declines, nutrients remain trapped below the sunlit zone.",
        "inference",
        "C1",
      ),
      mcq(
        "Why does the author mention viscosity?",
        [
          "To explain a cost of swimming for small organisms in cold water",
          "To prove that pressure is unimportant",
          "To define density in mathematical terms",
          "To argue that warming always increases oxygen",
        ],
        0,
        "Higher viscosity in cold water makes swimming more costly for small organisms.",
        "rhetorical purpose",
        "C1",
      ),
      mcq(
        "Which sentence best simplifies this idea: \"They are not simply preferring comfort; their bodies are tuned to a particular combination of density, pressure, and viscosity.\"",
        [
          "Species choose habitats only because the water feels pleasant.",
          "Bodies are adapted to a specific mix of physical conditions, not just comfort.",
          "All marine animals can live in any temperature band.",
          "Density is the only property that matters to deep-sea proteins.",
        ],
        1,
        "The sentence says adaptation, not mere comfort, explains narrow ranges.",
        "sentence simplification",
        "C1",
      ),
    ],
  },
];

export function makeCtwSet(module: ModuleTag, cefr: "B1" | "B2" | "C1", exclude: string[] = []) {
  const pool = CTW_PASSAGES.filter((p) => !exclude.includes(p.text));
  const chosen = pool[Math.floor(Math.random() * pool.length)] || CTW_PASSAGES[0];
  return buildCompleteTheWords(chosen.text, chosen.topic, module, cefr);
}

export function makeDailySets(module: ModuleTag, counts: number[], band: DifficultyBand = "standard"): DailyLifeSet[] {
  const used = new Set<string>();
  const allow = new Set(cefrAllowed(band));
  return counts.map((need) => {
    const byLevel = DAILY.filter((d) => !used.has(d.title) && d.questions.length >= need && allow.has(d.cefr));
    const available = byLevel.length
      ? byLevel
      : DAILY.filter((d) => !used.has(d.title) && d.questions.length >= need);
    const src = available[Math.floor(Math.random() * available.length)] || DAILY[0];
    used.add(src.title);
    return {
      ...src,
      id: makeId("daily"),
      taskType: "read_daily_life" as const,
      module,
      questions: src.questions.slice(0, need).map((q) => ({ ...q, id: makeId("q") })),
    };
  });
}

export function makeAcademicSet(module: ModuleTag, band: DifficultyBand | boolean = "standard"): AcademicSet {
  const level = band === true ? "harder" : band === false ? "standard" : band;
  const allow = new Set(cefrAllowed(level));
  const preferred = ACADEMIC.filter((a) => allow.has(a.cefr));
  const pool = preferred.length ? preferred : ACADEMIC;
  const src = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...src,
    id: makeId("acad"),
    taskType: "read_academic",
    module,
    questions: src.questions.map((q) => ({ ...q, id: makeId("q") })),
  };
}
