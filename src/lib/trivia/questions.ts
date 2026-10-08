export type FeudQuestion = { id: string; prompt: string; options: string[] };

export const QUESTION_SET_VERSION = "liv-party-20-v2";

// The seed list matches the database migration. Runtime screens read the saved list.
export const FEUD_QUESTIONS: FeudQuestion[] = [
  {
    id: "late",
    prompt: "If Liv is running late, what's the most likely reason?",
    options: [
      "Forgot to get dressed",
      "Hungover",
      "Thought the breakfast was at 7:30PM",
      "Liv is never running late",
    ],
  },
  {
    id: "award",
    prompt: "Which award would Liv win in this friendship group?",
    options: [
      "Best Dressed",
      "Best Listener",
      "Best Planner",
      "Best Wingwoman",
    ],
  },
  {
    id: "animal",
    prompt: "Which animal is Liv most like?",
    options: [
      "Quokka - Always Happy",
      "Eagle - High Achiever",
      "Honeybadger - Brave",
      "Dolphin - Smart",
    ],
  },
  {
    id: "holiday",
    prompt: "What is Liv's role on a group holiday?",
    options: ["The Accountant", "The Planner", "The Leader", "The Party Girl"],
  },
  {
    id: "support",
    prompt:
      "You have a bad day, and Liv comes round to support you. What does she bring?",
    options: [
      "Wine",
      "Chocolate",
      "Tissues",
      "Recorded episodes of the Biggest Loser",
    ],
  },
  {
    id: "superpower",
    prompt: "What would Liv's completely useless superpower be?",
    options: [
      "can detect if someone wants to redesign their home, 70% of the time",
      "Able to talk to anteaters",
      "Can fall asleep at will on trams",
      "Can change eye colour one shade",
    ],
  },
  {
    id: "splurge",
    prompt: "What would Liv spend a surprise $500 on first?",
    options: [
      "A night out with Ben",
      "MCC Dues",
      "A new art piece",
      "Sportsbet Multi",
    ],
  },
  {
    id: "sex-and-city",
    prompt:
      "Which of the four main characters in Sex and the City is Liv most like?",
    options: ["Charlotte", "Miranda", "Carrie", "Samantha"],
  },
  {
    id: "influencer",
    prompt:
      "If Liv decided to become an online influencer, what niche would she choose?",
    options: [
      "TradWife + Sourdough",
      "Skincare",
      "Crypto grift",
      "Conspiracy Theories",
    ],
  },
  {
    id: "advice",
    prompt: "Which topic is Liv the worst at giving advice on?",
    options: [
      "Should I propose to my boyfriend?",
      "Which fund should I put my super into?",
      "Should I quit my job and move to London?",
      "Should I take this pinger?",
    ],
  },
  {
    id: "brownlow",
    prompt:
      "Liv gets two tickets to the Brownlow. Ben can't make it. Who does she take as her plus-one?",
    options: ["Hughesy", "Pete Evans", "Karl Stefanovic", "ScoMo"],
  },
  {
    id: "job",
    prompt: "What would be the worst job imaginable for Liv?",
    options: [
      "Sex Ed Teacher at Xavier College",
      "Bali Booze Bus Tour Guide",
      "International Student Recruiter at Melbourne Uni",
      "Pork Crackling Taste Tester",
    ],
  },
  {
    id: "tram",
    prompt:
      "Liv sees a man defecate on the Number 8 tram going into the city. What does she say?",
    options: [
      "Good Heavens!",
      "Holy Shit",
      "Code Brown",
      "Who ordered the BBQ Chicken?",
    ],
  },
  {
    id: "crime",
    prompt:
      "Liv calls you at 2am asking you to bail her out, what crime has she committed?",
    options: [
      "Ripped jeans at the MCC",
      "Doing 20km in a 5km carpark",
      "Stealing steaks down her pants at Coles",
      "Using the KFC Free Wifi to call her friends",
    ],
  },
  {
    id: "task",
    prompt: "Nobody can eat until Liv completes a task. Which one do you pick?",
    options: [
      "Solve a Rubiks cube",
      "Make $1000 busking",
      "Have 10 people join her pyramid scheme",
      'Get 1000 people to follow her "Fat Pigeons of Melbourne" insta',
    ],
  },
  {
    id: "funeral",
    prompt:
      "Which of these four songs would most likely be played at Liv's funeral?",
    options: [
      "My Neck, My Back",
      "Fuck the Police",
      "WAP",
      "Who Let the Dogs Out",
    ],
  },
  {
    id: "cats",
    prompt:
      "How many cats do you think Liv and Ben will have in the next 10 years?",
    options: ["0", "1", "2-5", "10+"],
  },
  {
    id: "yule-ball",
    prompt:
      "Which Harry Potter Character would most likely ask Liv to the Yule Ball",
    options: ["Harry", "Ron", "Draco", "Hagrid"],
  },
  {
    id: "favourite",
    prompt: "What do you like most about Liv?",
    options: [
      "How she makes you laugh",
      "How she is always loyal",
      "How she gives the best advice",
      "How she makes you a better person",
    ],
  },
  {
    id: "new-name",
    prompt:
      "If Liv told you she had legally changed her name, what would her new name be?",
    options: ["Schapelle", "Trixie", "Watermelonandrea", "Whoa-Livia"],
  },
];

export const DEFAULT_TEAM_NAMES = [
  "Disco Divas",
  "Rodeo Queens",
  "Bride Tribe",
  "Last Disco",
];
export type SurveyAnswers = Record<string, number>;
export type RankedAnswer = { option: string; votes: number; rank: number };

export function validSurvey(
  value: unknown,
  questions: FeudQuestion[] = FEUD_QUESTIONS,
): value is SurveyAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers = value as Record<string, unknown>;
  return (
    Object.keys(answers).length === questions.length &&
    questions.every(
      (q) =>
        Number.isInteger(answers[q.id]) &&
        Number(answers[q.id]) >= 0 &&
        Number(answers[q.id]) < q.options.length,
    )
  );
}

export function rankAnswers(
  question: FeudQuestion,
  votes: SurveyAnswers[],
): RankedAnswer[] {
  const sorted = question.options
    .map((option, index) => ({
      option,
      votes: votes.filter((v) => v[question.id] === index).length,
      rank: 0,
    }))
    .sort((a, b) => b.votes - a.votes);
  return sorted.map((answer, index) => ({
    ...answer,
    rank:
      index > 0 && sorted[index - 1].votes === answer.votes
        ? sorted.findIndex((a) => a.votes === answer.votes) + 1
        : index + 1,
  }));
}
