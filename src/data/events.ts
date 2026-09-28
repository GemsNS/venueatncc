/**
 * Event types the venue promotes. Each entry becomes a landing page at /events/<slug>/.
 * Slugs and names must match src/data/event-types.ts.
 *
 * Copy rules (docs/design/brand.md, "Voice"):
 * - Professional hospitality: confident, warm, precise, brief. First person plural for the venue,
 *   second person for guidance. No exclamation marks, no em or en dashes, no parentheses where a
 *   sentence works. Headings in sentence case.
 * - Never mention alcohol or drinks of any kind, and never mention catering, menus, kitchens, or
 *   bringing your own anything. Catering appears only on the pricing page and in one FAQ entry.
 * - Describe only what the photos show. The Hall: arched windows, a fireplace feature wall, dark
 *   wood-look floors, recessed lighting, double doors. The Grove: a timber gazebo, open lawn, picnic
 *   tables on a paved patio, tall pines, paved paths. The grounds: a long paved drive and a paved lot.
 *   Never claim or ask about a kitchen, sound, screens, a stage, tables and chairs, or setup times.
 * - Venue facts (space names, capacity, phone, address) come from site.ts through the
 *   constants below, so a change there flows into every page. Never type them in by hand.
 * - Never type a price or a percentage. Rates live in src/shared/pricing.ts; point to the pricing
 *   page, or build the sentence from `pricing` as the deposit and special-rate sentences below do.
 * - Reserving always reads: we confirm availability, then your booking deposit reserves the date.
 * - Checklists hold practical venue steps only: date, space, guest count, estimate, visit, timeline.
 */
import { site, fullAddress, type SpaceId } from './site';
import { pricing, formatUSD } from '../shared/pricing';

export interface EventSection {
  heading: string;
  body: string[];
}

export interface EventType {
  slug: string;
  /** Display name, e.g. "Weddings & receptions" */
  name: string;
  /** One line for lists and cards. */
  summary: string;
  /** <title>, under 60 characters. */
  metaTitle: string;
  /** Meta description, roughly 140 to 160 characters. */
  metaDescription: string;
  h1: string;
  intro: string[];
  sections: EventSection[];
  checklist: { heading: string; items: string[] };
  faqs: { q: string; a: string }[];
  /** Slugs of related event types. */
  related: string[];
  /** Search phrases this page targets. Reference only; not output as meta keywords. */
  keywords: string[];
}

function spaceOf(id: SpaceId) {
  const space = site.spaces.find((s) => s.id === id);
  if (!space) throw new Error(`site.ts has no "${id}" space`);
  return space;
}

const HALL = spaceOf('indoor').name;
const GROVE = spaceOf('outdoor').name;
const INDOOR = spaceOf('indoor').capacity;
const OUTDOOR = spaceOf('outdoor').capacity;
const PHONE = site.contact.phone;
const ADDRESS = fullAddress;
const STREET = site.address.street;

/** The reserving sentence, worded the same everywhere on the site. */
const RESERVE = 'We confirm availability, then your booking deposit reserves the date.';

/** Parking, worded the same on every page. */
const PARKING = 'On-site parking on our paved lot is included with every booking.';

/** The visit offer, worded the same on every page. */
const VISIT = `Ask for a visit when you send your request, or call ${PHONE}, and we will find a time to walk the property with you.`;

/** Deposit terms, built from the rate card so the figures never drift. */
const deposit = pricing.bookingDeposit;
const DEPOSIT =
  deposit.type === 'percent'
    ? `The booking deposit is ${deposit.value}% of your total`
    : `The booking deposit is ${formatUSD(deposit.value)}`;
const DEPOSIT_TERMS =
  deposit.balanceDueDaysBefore > 0
    ? `${DEPOSIT}, and the balance is due ${deposit.balanceDueDaysBefore} days before your event.`
    : `${DEPOSIT}.`;
/** For events that are often booked at short notice. Empty when there is no balance window. */
const SHORT_NOTICE =
  deposit.balanceDueDaysBefore > 0
    ? ` For an event within ${deposit.balanceDueDaysBefore} days, the full amount is due when you reserve.`
    : '';

/** Special-rate sentences, built from the rate card so the percentages never drift. */
const repastRate = pricing.discounts.find((d) => d.id === 'repast' && d.percent > 0);
const nonprofitRate = pricing.discounts.find((d) => d.id === 'nonprofit' && d.percent > 0);
const howApplied = (d: { appliesTo: string }) =>
  d.appliesTo === 'manual' ? 'Mention it in your request.' : 'It is applied automatically in your estimate.';

const REPAST_RATE = repastRate
  ? ` Repasts and celebrations of life receive ${repastRate.percent}% off the rental. ${howApplied(repastRate)}`
  : '';
/** "Nonprofits and churches receive 15% off the rental for events Sunday to Thursday. Mention it in your request." */
const NONPROFIT_RATE = nonprofitRate
  ? ` ${nonprofitRate.who ?? nonprofitRate.label} receive ${nonprofitRate.percent}% off the rental${nonprofitRate.when ? ` for events ${nonprofitRate.when}` : ''}. ${howApplied(nonprofitRate)}`
  : '';

const repastRateFaq = repastRate
  ? [
      {
        q: 'Is there a special rate for repasts?',
        a: `Yes.${REPAST_RATE} The pricing page shows the full rate card and an instant estimate for your date.`,
      },
    ]
  : [];
const nonprofitRateFaq = (q: string) =>
  nonprofitRate
    ? [
        {
          q,
          a: `Yes.${NONPROFIT_RATE} The pricing page lists every rate and gives an instant estimate for your date.`,
        },
      ]
    : [];

export const events: EventType[] = [
  {
    slug: 'weddings',
    name: 'Weddings & receptions',
    summary: `Ceremonies at the gazebo in ${GROVE}, receptions in ${HALL}, and the whole day on one property.`,
    metaTitle: 'Wedding venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan your wedding at The Venue at NCC in Suffolk, VA: a ceremony at the gazebo in ${GROVE}, a reception in ${HALL} for up to ${INDOOR}, and on-site parking.`,
    h1: 'A Suffolk wedding venue among the pines',
    intro: [
      `Say your vows at the timber gazebo in ${GROVE}, then welcome guests into ${HALL} for the reception, all on one wooded property in Suffolk. ${GROVE} holds up to ${OUTDOOR} guests and ${HALL} up to ${INDOOR}.`,
      `We confirm every date personally, and we welcome you to visit before you book, so you can stand at the gazebo, walk into ${HALL}, and picture the day.`,
    ],
    sections: [
      {
        heading: 'Ceremony outdoors, reception indoors',
        body: [
          `${GROVE} is our outdoor space: a timber gazebo with a metal roof, open lawn, a paved patio, and tall pines around it. It holds up to ${OUTDOOR} guests and gives your vows a natural setting.`,
          `${HALL} is our indoor space, with arched windows, a fireplace feature wall, and dark wood-look floors. It holds up to ${INDOOR} guests for the reception. Reserve both for the same day and guests move from the ceremony to the reception without returning to their cars. With both spaces reserved, ${HALL} is also ready for up to ${INDOOR} guests if the weather turns.`,
        ],
      },
      {
        heading: 'The gatherings around the wedding',
        body: [
          'A wedding is often a series of gatherings. Engagement parties, bridal showers, and rehearsal dinners can each be booked on their own date, in the space that suits the group.',
          'Check each date on the availability calendar and send a request for each one. If the dates are close together, say so in your requests and we will review them together.',
        ],
      },
      {
        heading: 'A planning timeline',
        body: [
          'Many couples reserve their venue nine to twelve months ahead, and earlier for a Saturday in spring or fall. The availability calendar shows open dates up to two years ahead.',
          `Visit before you reserve. ${VISIT} A few weeks before the wedding, confirm your final guest count and the order of the day, and send guests the address and parking details.`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          'Rates depend on the day, the space, and the hours you need. The pricing page lists every rate and gives an instant estimate for your date, so you can compare dates before you choose one.',
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Wedding venue checklist',
      items: [
        'Set a budget and a working guest count.',
        `Choose ${GROVE} for the ceremony, ${HALL} for the reception, or reserve both.`,
        'Compare two or three dates on the availability calendar.',
        'Get an instant estimate for each date on the pricing page.',
        'Visit the property before you reserve.',
        'Plan a weather option for any part of the day outdoors.',
        'Confirm your final guest count and order of the day a few weeks ahead.',
        'Send guests the address and parking details with the invitation.',
      ],
    },
    faqs: [
      {
        q: 'Can we hold the ceremony and the reception here?',
        a: `Yes. Many couples hold the ceremony at the gazebo in ${GROVE} and the reception in ${HALL}. Request both spaces for the same day, and we confirm availability for each when we follow up.`,
      },
      {
        q: 'What happens if it rains on our wedding day?',
        a: `When you reserve both spaces, ${HALL} is ready for up to ${INDOOR} guests if the weather turns. For a larger outdoor wedding, talk through a weather plan with us before you book.`,
      },
      {
        q: 'How much does a wedding at The Venue at NCC cost?',
        a: 'Rates depend on the day, the space, and the hours you need. The pricing page lists the full rate card and gives an instant estimate for your date, and on-site parking is included with every booking.',
      },
      {
        q: 'How far in advance should we book a wedding venue?',
        a: 'Many couples book nine to twelve months ahead, and earlier for a popular Saturday. The availability calendar shows open dates up to two years ahead, so you can see right away whether yours is free.',
      },
      {
        q: 'Can we visit before we book?',
        a: `Yes. ${VISIT}`,
      },
    ],
    related: ['receptions-banquets', 'baby-bridal-showers', 'community-events'],
    keywords: [
      'wedding venue Suffolk VA',
      'wedding reception venue Suffolk VA',
      'outdoor wedding venue Suffolk VA',
      'church wedding venue Suffolk VA',
      'gazebo wedding venue Suffolk VA',
      'small wedding venue Hampton Roads',
    ],
  },
  {
    slug: 'receptions-banquets',
    name: 'Banquets & anniversaries',
    summary: 'Anniversary dinners, awards banquets, and formal celebrations.',
    metaTitle: 'Banquet hall in Suffolk, VA | The Venue at NCC',
    metaDescription: `Host an anniversary dinner or awards banquet at The Venue at NCC in Suffolk, VA. ${HALL} holds up to ${INDOOR} guests, and on-site parking is included.`,
    h1: 'Banquets and anniversary dinners in Suffolk',
    intro: [
      `A formal evening deserves a room with presence. ${HALL} holds up to ${INDOOR} guests beneath arched windows, with a fireplace feature wall that frames a head table or a speaker.`,
      'Anniversaries, awards nights, scholarship dinners, and appreciation evenings share a shape: a welcome, dinner, a program, and time to honor people. We confirm every booking personally and will walk the room with you before you reserve.',
    ],
    sections: [
      {
        heading: 'The Hall for a formal evening',
        body: [
          `${HALL} holds up to ${INDOOR} guests. Arched windows, a fireplace feature wall, and recessed lighting give a banquet a finished look, and the double doors make a clear entrance for guests of honor.`,
          `For a larger gathering or a summer evening outdoors, ${GROVE} holds up to ${OUTDOOR} guests among tall pines, with a timber gazebo and picnic tables on a paved patio.`,
        ],
      },
      {
        heading: 'Planning the program',
        body: [
          'Formal celebrations run best with a clear program. Decide early who will speak, whether there will be awards or tributes, and how long each part should last. Give every presenter a set number of minutes and share the order of events with them ahead of time.',
          'For an anniversary, a few words from children or grandchildren and a display of photos across the decades make the evening personal. For an awards banquet, confirm names and spellings before the printing deadline.',
        ],
      },
      {
        heading: 'A planning timeline',
        body: [
          'Most hosts reserve a banquet date three to six months ahead, and earlier for a date near the end of a school or sports season. Visit before you book to see how your guest count and program fit the room.',
          `${VISIT} About two weeks before the event, confirm the program and your final guest count, and send guests the address and parking details.`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          'Rates depend on the day, the space, and the hours you need. If a board or committee approves the budget, the instant estimate on the pricing page gives them a clear figure to review.',
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Banquet planning checklist',
      items: [
        'Confirm the occasion, a few possible dates, and a working guest count.',
        `Choose ${HALL} for up to ${INDOOR} guests or ${GROVE} for up to ${OUTDOOR}.`,
        'Check your dates on the availability calendar and get an instant estimate.',
        'Visit the space to plan the room and the program.',
        'Write the program with speakers, awards, and timing in order.',
        'Order plaques, certificates, or keepsakes early so they arrive in time.',
        'Confirm your final guest count about two weeks ahead.',
        'Send guests the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'How many guests can a banquet at The Venue at NCC hold?',
        a: `${HALL} holds up to ${INDOOR} guests, and ${GROVE} holds up to ${OUTDOOR}. Choose the space that fits your guest list when you pick your date on the availability calendar.`,
      },
      {
        q: 'Can we see the room before we book?',
        a: `Yes. ${VISIT}`,
      },
      {
        q: 'What should an awards banquet program include?',
        a: 'Most banquet programs include a welcome, dinner, remarks, the recognitions, and a closing. Share the order of events with every speaker ahead of time so the evening stays on schedule.',
      },
      {
        q: 'What are good ideas for a 50th anniversary celebration?',
        a: 'Popular ideas include a memory table with photos from each decade, a keepsake book where guests write notes, and a short tribute from each generation of the family. Pick one or two that fit the honorees rather than trying to do everything.',
      },
      {
        q: 'How much does it cost to host a banquet?',
        a: 'Rates depend on the day, the space, and the hours you need. The pricing page lists the full rate card and gives an instant estimate for your date, and on-site parking is included with every booking.',
      },
    ],
    related: ['weddings', 'birthday-parties', 'graduations-reunions'],
    keywords: [
      'banquet hall Suffolk VA',
      'anniversary party venue Suffolk VA',
      'awards banquet venue Suffolk VA',
      '50th anniversary party venue Suffolk VA',
      'event hall rental Suffolk VA',
    ],
  },
  {
    slug: 'baby-bridal-showers',
    name: 'Baby & bridal showers',
    summary: 'Baby showers, bridal showers, and gender reveals for family and friends.',
    metaTitle: 'Baby and bridal shower venue, Suffolk | The Venue at NCC',
    metaDescription: `Host a baby shower, bridal shower, or gender reveal at The Venue at NCC in Suffolk, VA. ${HALL} holds up to ${INDOOR} guests, with on-site parking included.`,
    h1: 'Baby and bridal showers in Suffolk',
    intro: [
      `${HALL} gives a shower an open, graceful room: arched windows, a fireplace feature wall, and dark wood-look floors, with space for up to ${INDOOR} guests.`,
      'Showers are usually planned by a friend or relative, often with co-hosts. We keep booking simple: one host sends the request, we confirm the date personally, and the instant estimate gives every co-host the same figure.',
    ],
    sections: [
      {
        heading: 'The Hall for a shower',
        body: [
          `Most showers fit comfortably in ${HALL}, which holds up to ${INDOOR} guests. The fireplace feature wall makes a natural backdrop for gifts and photos, and the arched windows bring in daylight for an afternoon shower.`,
          `For a spring or summer shower outdoors, ${GROVE} holds up to ${OUTDOOR} guests, with picnic tables on a paved patio beside the timber gazebo.`,
        ],
      },
      {
        heading: 'Baby showers, gender reveals, and bridal showers',
        body: [
          'A baby shower usually happens four to eight weeks before the due date. A gender reveal builds toward one shared moment, so timing and a clear view for every guest matter most. Tell us which one you are planning in your request, and mention it if you are combining the two.',
          'A bridal shower is usually hosted by a friend, a sister, or a relative, two weeks to two months before the wedding. A couples shower follows the same idea with both partners as guests of honor. Confirm the wedding date and the guest list with the family before you book.',
        ],
      },
      {
        heading: 'A planning timeline',
        body: [
          'Pick a first-choice date and a backup, and check both on the availability calendar. Many hosts reserve six to ten weeks ahead. When several friends or relatives co-host, agree on the date and budget first so one host can send the request.',
          `If you would like to see the room first, ${VISIT.charAt(0).toLowerCase()}${VISIT.slice(1)}`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          'Rates depend on the day, the space, and the hours you need. Most showers run two to three hours, and the instant estimate on the pricing page shows the cost for your date, including any minimum hours for that day.',
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Shower planning checklist',
      items: [
        'Confirm the date with the parent-to-be, the couple, or the family.',
        'Agree on a budget with any co-hosts.',
        `Draft a guest list. ${HALL} holds up to ${INDOOR} guests.`,
        'Check your date and a backup on the availability calendar.',
        'Get an instant estimate for the hours you need.',
        'Visit the space to plan where gifts, games, and photos will go.',
        'Plan a simple order for the event, from the welcome to the gifts or the reveal.',
        'Send guests the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'Can I host a gender reveal at The Venue at NCC?',
        a: 'Yes. Gender reveals, baby showers, bridal showers, and couples showers are all welcome. Pick your date on the availability calendar and tell us your plans in your request.',
      },
      {
        q: 'When should a baby shower be held?',
        a: 'Many families hold a baby shower four to eight weeks before the due date, while there is still time to sort and set up the gifts.',
      },
      {
        q: 'How long does a baby shower or bridal shower usually last?',
        a: 'Most showers run about two to three hours. Rates depend on the day and the hours you book, and some days have a minimum, so check the instant estimate on the pricing page for your date.',
      },
      {
        q: 'Is parking included?',
        a: 'Yes. On-site parking is included with every booking, on a large paved lot at the end of our drive.',
      },
    ],
    related: ['weddings', 'birthday-parties', 'receptions-banquets'],
    keywords: [
      'baby shower venue Suffolk VA',
      'bridal shower venue Suffolk VA',
      'gender reveal venue Suffolk VA',
      'couples shower venue Suffolk VA',
      'baby shower venue Hampton Roads',
    ],
  },
  {
    slug: 'birthday-parties',
    name: 'Birthdays & milestones',
    summary: 'First birthdays, sweet sixteens, milestone birthdays, and retirement parties.',
    metaTitle: 'Birthday party venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan a sweet sixteen, 50th birthday, or retirement party at The Venue at NCC in Suffolk, VA. ${HALL} holds up to ${INDOOR} guests, and parking is included.`,
    h1: 'Milestone birthdays and retirement parties',
    intro: [
      `Turning one, sixteen, or fifty deserves a proper room, and so does retiring after decades of work. ${HALL} holds up to ${INDOOR} guests, and ${GROVE} welcomes up to ${OUTDOOR} among the pines.`,
      'We confirm every booking personally, and you are welcome to visit before you reserve. The notes below cover choosing a space, a simple timeline, and what to share with your guests.',
    ],
    sections: [
      {
        heading: 'Choosing the space for your party',
        body: [
          `${HALL} suits most milestone parties: an open room with arched windows, a fireplace feature wall, and double doors that make a fine entrance for the guest of honor.`,
          `A large open-house party or a summer celebration can move outdoors to ${GROVE}, which holds up to ${OUTDOOR} guests, with open lawn, a timber gazebo, and picnic tables on a paved patio.`,
        ],
      },
      {
        heading: 'First birthdays, sweet sixteens, and milestone birthdays',
        body: [
          'Every milestone brings a different crowd. A first birthday is a party for parents, grandparents, and a few little ones, so many families plan around nap schedules and keep the program short. A sweet sixteen usually centers on friends, photos, and one planned moment such as a candle ceremony.',
          'A fortieth, fiftieth, or seventieth often mixes generations and may include a few speeches or a surprise entrance. A retirement party brings together coworkers, family, and friends, so keep the speaking list short and give each speaker a few minutes at most.',
        ],
      },
      {
        heading: 'A planning timeline',
        body: [
          'Many hosts book two to three months ahead for a milestone birthday, and earlier for a large party or a holiday weekend. Send invitations four to six weeks before the date, and earlier if guests are traveling.',
          `Planning a surprise? Choose one trusted person to bring the guest of honor, and ask guests to arrive about thirty minutes earlier. A visit before you book helps you plan where guests will wait. ${VISIT}`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          'Rates depend on the day, the space, and the hours you need. When family members or an employer share the cost, the instant estimate on the pricing page gives everyone the same figure.',
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Birthday party planning checklist',
      items: [
        'Pick a first-choice date and a backup, and check both on the availability calendar.',
        'Decide early whether the party is a surprise.',
        `Choose ${HALL} for up to ${INDOOR} guests or ${GROVE} for up to ${OUTDOOR}.`,
        'Set a budget and get an instant estimate on the pricing page.',
        "Visit the space to plan the room and the guest of honor's arrival.",
        'Plan a short run of show for the welcome, speeches, and photos.',
        'Send invitations four to six weeks ahead with the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'Where can I host a retirement party in Suffolk, VA?',
        a: `The Venue at NCC is at ${STREET} in Suffolk. ${HALL} holds up to ${INDOOR} guests, and on-site parking is included with every booking.`,
      },
      {
        q: 'How far in advance should I book a birthday party venue?',
        a: 'Many hosts book two to three months ahead for a milestone birthday and earlier for a larger party or a holiday weekend. The availability calendar shows open dates, so you can check yours right away.',
      },
      {
        q: 'How do I plan a surprise birthday party?',
        a: 'Ask guests to arrive about thirty minutes before the guest of honor, and choose one trusted person to bring them in on time. Mention the surprise in your request so we can plan arrival times with you.',
      },
      {
        q: 'Can I see the space before I book?',
        a: `Yes. ${VISIT}`,
      },
    ],
    related: ['graduations-reunions', 'receptions-banquets', 'baby-bridal-showers'],
    keywords: [
      'birthday party venue Suffolk VA',
      'sweet 16 venue Suffolk VA',
      '50th birthday party venue Suffolk VA',
      'retirement party venue Suffolk VA',
      'party hall rental Suffolk VA',
    ],
  },
  {
    slug: 'repasts-memorials',
    name: 'Repasts & celebrations of life',
    summary: 'A calm place for family and friends to gather and remember.',
    metaTitle: 'Repast venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `A calm place for family and friends to gather after a funeral or memorial in Suffolk, VA. ${HALL} holds up to ${INDOOR}, with on-site parking. Call ${PHONE}.`,
    h1: 'Repasts and celebrations of life',
    intro: [
      `The gathering after a service is often where family and friends finally have time to talk and remember. ${HALL} offers a calm, dignified room for up to ${INDOOR} guests.`,
      `You may be planning within a few days, so the first step is short: call ${PHONE}, or send a request from the availability calendar, and we will follow up with you personally.`,
    ],
    sections: [
      {
        heading: 'A calm room for the gathering',
        body: [
          `${HALL} holds up to ${INDOOR} guests. Arched windows, a fireplace feature wall, and recessed lighting give it a quiet, dignified character, and the fireplace wall is a natural place for photographs and flowers.`,
          `A celebration of life in warmer months, or one expecting more guests, can use ${GROVE}, which holds up to ${OUTDOOR} among tall pines.`,
        ],
      },
      {
        heading: 'Planning a repast',
        body: [
          'Most repasts begin soon after the burial or memorial service, so the service schedule sets the timing. Choose one family point person to confirm the date, share a rough guest count, and keep decisions in one place.',
          'Decide early who will welcome guests, who will offer a blessing, and who will gather photographs and flowers at the end. Small tasks like these are easy to hand to cousins, friends, or church members who want to help.',
        ],
      },
      {
        heading: 'Timing and celebrations of life',
        body: [
          `Repasts are often arranged within a few days. Call ${PHONE} or send a request with the service time and a best guess at numbers, and we will talk the timing through with you. A best guess is fine, since attendance is often hard to know ahead of time.`,
          'Celebrations of life are sometimes held weeks or months after a passing, which gives relatives from across Hampton Roads and farther away time to travel. With more time, a visit before you book helps the family plan photographs and tributes.',
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          `Rates depend on the day and the hours you need, and the pricing page shows an instant estimate so the family can see the cost before deciding.${REPAST_RATE}`,
          `${DEPOSIT_TERMS}${SHORT_NOTICE} ${PARKING} If you are working with a funeral home, share our address, ${ADDRESS}, with them early.`,
        ],
      },
    ],
    checklist: {
      heading: 'Repast and celebration of life checklist',
      items: [
        'Confirm the service time and plan the start of the gathering around it.',
        'Choose one family point person for questions and decisions.',
        `Share a best guess at the guest count. ${HALL} holds up to ${INDOOR}.`,
        `Call ${PHONE} or check the date on the availability calendar.`,
        'Choose who will welcome guests and who will offer a blessing.',
        'Gather photographs and keepsakes for a memory table.',
        `Share the address, ${ADDRESS}, with guests and the funeral home.`,
      ],
    },
    faqs: [
      {
        q: 'What is a repast?',
        a: 'A repast is a gathering after a funeral or memorial service, usually with family, friends, and members of the church community. It gives people time to rest, visit, and share memories together.',
      },
      {
        q: 'Can we hold a repast at The Venue at NCC right after the funeral?',
        a: `Check the date on the availability calendar or call ${PHONE}, and share the time of the service. We will talk through timing with you and confirm what works.`,
      },
      ...repastRateFaq,
      {
        q: 'How far ahead should we plan a celebration of life?',
        a: `Repasts are often arranged within a few days of a funeral, while celebrations of life can be planned weeks or months ahead. Either way, check your date on the availability calendar or call ${PHONE}, and we will talk it through.`,
      },
    ],
    related: ['community-events', 'receptions-banquets', 'meetings-trainings'],
    keywords: [
      'repast venue Suffolk VA',
      'celebration of life venue Suffolk VA',
      'funeral repast location Suffolk VA',
      'memorial reception venue Suffolk VA',
      'repast hall Hampton Roads',
    ],
  },
  {
    slug: 'meetings-trainings',
    name: 'Meetings & workshops',
    summary: 'Board meetings, trainings, workshops, and nonprofit gatherings.',
    metaTitle: 'Meeting space in Suffolk, VA | The Venue at NCC',
    metaDescription: `Rent meeting space in Suffolk, VA for board meetings, trainings, and workshops. ${HALL} holds up to ${INDOOR} people, with on-site parking and instant estimates.`,
    h1: 'Meeting and training space in Suffolk',
    intro: [
      `Board meetings, staff trainings, and planning days often go better away from the office. ${HALL} holds up to ${INDOOR} people in a wooded setting minutes from downtown Suffolk, with on-site parking included.`,
      'Businesses, nonprofits, schools, and community groups book with the same simple process. The instant estimate on the pricing page gives you a figure to forward for approval, and we confirm every booking personally.',
    ],
    sections: [
      {
        heading: 'The Hall for meetings and trainings',
        body: [
          `${HALL} holds up to ${INDOOR} people in one open room with arched windows and recessed lighting. It suits a board meeting, a training session, or a workshop that breaks into small groups.`,
          `For a staff picnic or an outdoor team day, ${GROVE} holds up to ${OUTDOOR} among tall pines, with picnic tables on a paved patio.`,
        ],
      },
      {
        heading: 'Before the meeting',
        body: [
          'Start with the agenda and work backward: what the group needs to finish, how long the session should run, and when to take breaks. A hands-on training needs a different layout than a board meeting where everyone faces each other, so walk the room with us before you book if the layout matters.',
          'Send attendees the agenda, address, and start time a few days ahead, along with anything they should read first. If you need equipment in the room, ask us when you send your request.',
        ],
      },
      {
        heading: 'Regular meetings and planning ahead',
        body: [
          'Most organizers book a few weeks ahead for a single meeting and a season ahead for an annual meeting or a full-day training. If your group meets on a regular schedule, ask about recurring dates in your request.',
          `${VISIT} Groups coming from across Hampton Roads will find us at ${ADDRESS}.`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          `Rates depend on the day, the space, and the hours you need. The pricing page gives an instant estimate you can forward for approval.${NONPROFIT_RATE}`,
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Meeting and training checklist',
      items: [
        'Write a short agenda with start, break, and end times.',
        `Estimate your headcount. ${HALL} holds up to ${INDOOR} people.`,
        'Check your date on the availability calendar.',
        'Get an instant estimate on the pricing page for budget approval.',
        'Visit the room to plan your layout.',
        'Ask us about any equipment your session needs.',
        'Send attendees the address and start time, and let them know parking is on site.',
      ],
    },
    faqs: [
      {
        q: 'What kinds of meetings can we hold at The Venue at NCC?',
        a: `Board meetings, trainings, workshops, and nonprofit gatherings. ${HALL} holds up to ${INDOOR} people. If your event is a little different, tell us about it in your request.`,
      },
      {
        q: 'Is parking included for attendees?',
        a: 'Yes. On-site parking is included with every booking.',
      },
      {
        q: 'Can we book recurring dates?',
        a: 'Ask in your request. Tell us the schedule you have in mind, and we will confirm which dates are available.',
      },
      ...nonprofitRateFaq('Is there a rate for nonprofits?'),
      {
        q: 'How do I book meeting space in Suffolk at The Venue at NCC?',
        a: `Pick your date on the availability calendar and send a request with your meeting details, which takes about two minutes. ${RESERVE}`,
      },
    ],
    related: ['community-events', 'receptions-banquets', 'graduations-reunions'],
    keywords: [
      'meeting space Suffolk VA',
      'meeting room rental Suffolk VA',
      'training room rental Suffolk VA',
      'workshop venue Suffolk VA',
      'board meeting space Suffolk VA',
      'nonprofit meeting space Hampton Roads',
    ],
  },
  {
    slug: 'graduations-reunions',
    name: 'Graduations & reunions',
    summary: 'Graduation parties, family reunions, and class reunions.',
    metaTitle: 'Reunion and graduation venue, Suffolk | The Venue at NCC',
    metaDescription: `Host a graduation party or family reunion at The Venue at NCC in Suffolk, VA. ${GROVE} holds up to ${OUTDOOR} guests among the pines, with on-site parking.`,
    h1: 'Graduation parties and reunions in Suffolk',
    intro: [
      `Graduations and reunions bring together people who rarely share a room. ${GROVE} gives a large group space to spread out, with open lawn, a timber gazebo, and picnic tables on a paved patio for up to ${OUTDOOR} guests.`,
      `${HALL} holds up to ${INDOOR} indoors, and on-site parking is included, which helps when relatives drive in from across Hampton Roads and beyond.`,
    ],
    sections: [
      {
        heading: 'The Grove for a large gathering',
        body: [
          `${GROVE} holds up to ${OUTDOOR} guests. Families gather at the picnic tables on the paved patio, children have the open lawn, and the timber gazebo makes a natural spot for a group photograph.`,
          `For a smaller or cooler-weather gathering, ${HALL} holds up to ${INDOOR} guests indoors. Reserve both and the day can move between them.`,
        ],
      },
      {
        heading: 'Graduation parties',
        body: [
          'A graduation party lets grandparents, teachers, coaches, and friends say congratulations in person. Many families plan it for the same weekend as the ceremony, so out-of-town relatives make one trip. If classmates are hosting parties too, compare dates early so friends can stop by more than one.',
        ],
      },
      {
        heading: 'Family and class reunions',
        body: [
          'Reunions take more coordination because the guest list is spread out. Many families form a small committee, pick a date nine to twelve months ahead, and send a save-the-date as soon as it is set. Class reunion committees often start by rebuilding the contact list.',
          `Decide early how costs will be shared, such as a set contribution per household or a class fee. A simple program, like recognizing elders or welcoming new babies, gives the day shape. If the committee would like to see the grounds first, ${VISIT.charAt(0).toLowerCase()}${VISIT.slice(1)}`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          'Rates depend on the day, the space, and the hours you need. The instant estimate on the pricing page makes it easy to work out a fair share per household or classmate.',
          `${DEPOSIT_TERMS} ${PARKING} Share the full address, ${ADDRESS}, early so everyone can plan the trip.`,
        ],
      },
    ],
    checklist: {
      heading: 'Graduation party and reunion checklist',
      items: [
        'Pick a date around the graduation ceremony or the travel plans of most relatives.',
        'Make a working guest count, with a cushion for late additions.',
        `Choose ${GROVE} for up to ${OUTDOOR} guests, ${HALL} for up to ${INDOOR}, or both.`,
        'Get an instant estimate and decide how the cost will be shared.',
        'Visit the grounds with your committee before you reserve.',
        'Plan a weather option if the day is outdoors.',
        'Send save-the-dates with the full address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'How far ahead should we plan a family reunion?',
        a: 'Many families start nine to twelve months ahead so relatives can save and arrange travel. Check your date on the availability calendar as soon as the committee agrees on it.',
      },
      {
        q: 'How many guests can the venue hold for a graduation party or reunion?',
        a: `${GROVE} holds up to ${OUTDOOR} guests, and ${HALL} holds up to ${INDOOR}. Choose the space that fits your guest list when you pick your date.`,
      },
      {
        q: 'Can we reserve both spaces?',
        a: `Yes. Request ${HALL} and ${GROVE} together for the same day, and we confirm availability for both when we follow up.`,
      },
      {
        q: 'When should we have a graduation party?',
        a: 'Many families hold the party the same weekend as the ceremony or within a few weeks after, so relatives can make one trip.',
      },
    ],
    related: ['birthday-parties', 'receptions-banquets', 'community-events'],
    keywords: [
      'graduation party venue Suffolk VA',
      'family reunion venue Suffolk VA',
      'class reunion venue Suffolk VA',
      'outdoor party venue Suffolk VA',
      'family reunion venue Hampton Roads',
    ],
  },
  {
    slug: 'community-events',
    name: 'Community events',
    summary: 'Conferences, fellowship events, youth nights, and community meetings.',
    metaTitle: 'Community event venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan a church conference, youth night, or community day at The Venue at NCC in Suffolk, VA. ${GROVE} holds up to ${OUTDOOR} guests and ${HALL} up to ${INDOOR}.`,
    h1: 'Community events in Suffolk',
    intro: [
      `Much of the life of a church or community happens outside Sunday morning. ${HALL} holds up to ${INDOOR} guests for a conference session or a youth night, and ${GROVE} holds up to ${OUTDOOR} for a fellowship picnic or a community day.`,
      'Nonprofits, schools, faith groups, and neighborhood associations are welcome to book.',
    ],
    sections: [
      {
        heading: 'Choosing the space',
        body: [
          `${HALL} suits sessions, youth nights, and community meetings: one open room for up to ${INDOOR} guests, with arched windows and recessed lighting.`,
          `${GROVE} suits a fellowship picnic, an outdoor service, or a community day, with room for up to ${OUTDOOR} guests on the lawn and the paved patio under tall pines. Reserve both for a program that moves between them.`,
        ],
      },
      {
        heading: 'From purpose to run of show',
        body: [
          'Start with the purpose. Write one sentence about why the event exists and who should be there, and let it guide every other decision. Then set a date, a headcount, and a budget, and decide whether attendees will register.',
          'Build a simple run of show with start times, speakers, breaks, and an end time. Name one point person for the day, so volunteers, speakers, and our team all have a single contact.',
        ],
      },
      {
        heading: 'A planning timeline',
        body: [
          'Conferences and community days are often set a season ahead so leaders, speakers, and volunteers can hold the date. Youth nights and fellowship events usually need four to eight weeks.',
          `Visit with your planning team before you book to walk the spaces and settle the layout. ${VISIT} Include the full address, ${ADDRESS}, on every flyer, email, and registration page.`,
        ],
      },
      {
        heading: 'Rates, deposits, and parking',
        body: [
          `Rates depend on the day, the space, and the hours you need.${NONPROFIT_RATE} The instant estimate on the pricing page makes it easy to set a budget before the leadership team meets.`,
          `${DEPOSIT_TERMS} ${PARKING}`,
        ],
      },
    ],
    checklist: {
      heading: 'Community event checklist',
      items: [
        'Write one sentence that explains the purpose of the event and who it is for.',
        'Set a date, a headcount, and a budget.',
        `Choose ${HALL} for up to ${INDOOR} guests, ${GROVE} for up to ${OUTDOOR}, or both.`,
        'Get an instant estimate on the pricing page.',
        'Visit the spaces with your planning team.',
        'Draft a run of show with start times, breaks, and a firm end time.',
        'Recruit volunteers for check-in and greeting, and name one point person for the day.',
        'Put the address and parking details on every flyer and registration page.',
      ],
    },
    faqs: [
      {
        q: 'Can community groups and nonprofits book the venue?',
        a: 'Yes. The Venue at NCC is open to the public, including nonprofits, faith groups, schools, and neighborhood associations.',
      },
      ...nonprofitRateFaq('Is there a rate for churches and nonprofits?'),
      {
        q: 'Should we require registration for a church conference?',
        a: 'Registration helps with name tags, materials, and headcounts for a conference, and a simple online form is usually enough. For a fellowship event or youth night, an RSVP or a parent sign-up may be all you need.',
      },
      {
        q: 'What should a youth night plan include?',
        a: 'A youth night runs best with a simple schedule, enough adult volunteers, and contact information for every parent. Collect any permission forms before the night so check-in moves quickly.',
      },
    ],
    related: ['meetings-trainings', 'receptions-banquets', 'graduations-reunions'],
    keywords: [
      'church event venue Suffolk VA',
      'church conference venue Suffolk VA',
      'community event space Suffolk VA',
      'fellowship hall rental Suffolk VA',
      'youth event venue Suffolk VA',
    ],
  },
];

export function getEvent(slug: string): EventType | undefined {
  return events.find((e) => e.slug === slug);
}
