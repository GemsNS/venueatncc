/**
 * Event types the venue promotes. Each entry becomes a landing page at /events/<slug>/.
 * Slugs and names must match src/data/event-types.ts.
 *
 * Copy rules (docs/design/brand.md, "Voice" and "Redundancy rules"):
 * - Professional hospitality: confident, warm, precise, brief. First person plural for the venue,
 *   second person for guidance. No exclamation marks, no em or en dashes, no parentheses where a
 *   sentence works. Headings in sentence case.
 * - Never mention alcohol or drinks of any kind, and never mention catering, menus, kitchens, or
 *   bringing your own anything. Catering appears only in one FAQ entry on /faq/.
 * - The venue is a stand-alone business (brand.md, "Separation"): no copy connects it to a church. A
 *   client's own congregation or clergy may be mentioned.
 * - Describe only what the photos show. The Hall: arched windows, a fireplace feature wall, dark
 *   wood-look floors, recessed lighting, double doors. The Grove: a timber gazebo, open lawn, picnic
 *   tables on a patio, tall pines, paths. The grounds: a long paved drive and a paved lot.
 *   Never claim or ask about a kitchen, sound, screens, a stage, tables and chairs, or setup times.
 * - State each fact once per page. Capacities appear only in the event's first section, which
 *   describes the spaces. Rates, deposits, parking, and visits are not written here: the event page
 *   adds one line that links to /pricing/ (Ask about rates) and the FAQ, and its checklist carries the
 *   Request a Visit action. Parking may appear as a checklist task.
 * - Each event states its own booking lead time once, in its section prose or in one FAQ.
 * - FAQs answer only what the page body and /faq/ do not already answer.
 * - Venue facts (space names, capacities, phone) come from site.ts through the constants below, so a
 *   change there flows into every page. Never type them in by hand. The phone appears at most once in
 *   an event's copy, and the street address never does (the footer carries it).
 * - The venue does not publish prices: never write a price, a percentage, a discount, a special rate,
 *   or an estimate. Rates are given by phone; the event page's shared line points to /pricing/.
 * - Checklists hold practical venue steps only: date, space, guest count, budget, visit, timeline.
 * - The visit is carried by the checklist item and the Request a Visit button, so it is not written into
 *   the intro or section prose. Intros open with something true of the occasion, not a promise about booking.
 */
import { site, type SpaceId } from './site';

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

export const events: EventType[] = [
  {
    slug: 'weddings',
    name: 'Weddings & receptions',
    summary: `Ceremonies at the gazebo in ${GROVE}, your choice of an indoor or outdoor reception, and the whole day on one property.`,
    metaTitle: 'Wedding venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan your wedding at The Venue at NCC in Suffolk, VA: a ceremony at the gazebo in ${GROVE}, your choice of an indoor or outdoor reception, and on-site parking.`,
    h1: 'A Suffolk wedding venue among the pines',
    intro: [
      `Say your vows at the timber gazebo in ${GROVE}, then celebrate with your choice of an indoor or outdoor reception, all on one wooded property in Suffolk.`,
    ],
    sections: [
      {
        heading: 'Your choice of an indoor or outdoor reception',
        body: [
          `${GROVE} is our outdoor space: a timber gazebo with a metal roof, open lawn, a patio, and tall pines around it. It holds up to ${OUTDOOR} guests and gives your vows a natural setting.`,
          `${HALL} is our indoor space, with arched windows, a fireplace feature wall, and dark wood-look floors. It holds up to ${INDOOR} guests for the reception. Reserve both for the same day and guests move from the ceremony to the reception without returning to their cars.`,
        ],
      },
      {
        heading: 'The gatherings around the wedding',
        body: [
          'A wedding is often a series of gatherings. Engagement parties, bridal showers, and rehearsal dinners can each be booked on their own date, in the space that suits the group.',
          'Check each date on the availability calendar and send a request for each one. If the dates are close together, say so in your requests and we will review them together.',
        ],
      },
    ],
    checklist: {
      heading: 'Wedding venue checklist',
      items: [
        'Set a budget and a working guest count.',
        'Compare two or three dates on the availability calendar.',
        'Build the timeline of the day backward from the ceremony time.',
        'Visit the property before you reserve.',
        'Plan a weather option for any part of the day outdoors.',
        'Confirm your final guest count and order of the day a few weeks ahead.',
        'Send guests the address and parking details with the invitation.',
      ],
    },
    faqs: [
      {
        q: 'What happens if it rains on our wedding day?',
        a: `When you reserve both spaces, ${HALL} is ready for your guests if the weather turns. If your guest list is larger than ${HALL} holds, talk through a weather plan with us before you book.`,
      },
      {
        q: 'How far in advance should we book a wedding venue?',
        a: 'Many couples book nine to twelve months ahead, and earlier for a popular Saturday. The availability calendar shows open dates up to two years ahead, so you can see right away whether yours is free.',
      },
    ],
    related: ['receptions-banquets', 'baby-bridal-showers', 'community-events'],
    keywords: [
      'wedding venue Suffolk VA',
      'wedding reception venue Suffolk VA',
      'outdoor wedding venue Suffolk VA',
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
      'A formal evening deserves a room with presence, one that frames a head table or a speaker.',
      'Anniversaries, awards nights, scholarship dinners, and appreciation evenings share a shape: a welcome, dinner, a program, and time to honor people.',
    ],
    sections: [
      {
        heading: 'The Hall for a formal evening',
        body: [
          `${HALL} holds up to ${INDOOR} guests. Arched windows, a fireplace feature wall, and recessed lighting give a banquet a finished look, and the double doors make a clear entrance for guests of honor.`,
          `For a larger gathering or a summer evening outdoors, ${GROVE} holds up to ${OUTDOOR} guests among tall pines, with a timber gazebo and picnic tables on a patio.`,
        ],
      },
      {
        heading: 'Planning the program',
        body: [
          'Formal celebrations run best with a clear program. Decide early who will speak, whether there will be awards or tributes, and how long each part should last. Give every presenter a set number of minutes and share the order of events with them ahead of time.',
          'For an anniversary, a few words from children or grandchildren and a display of photos across the decades make the evening personal. For an awards banquet, confirm names and spellings before the printing deadline.',
          'Most hosts reserve a banquet date three to six months ahead, and earlier for a date near the end of a school or sports season.',
        ],
      },
    ],
    checklist: {
      heading: 'Banquet planning checklist',
      items: [
        'Confirm the occasion, a few possible dates, and a working guest count.',
        `Choose ${HALL} or ${GROVE} for your guest count.`,
        'Check your dates on the availability calendar.',
        'Visit the space to plan the room and the program.',
        'Write the program with speakers, awards, and timing in order.',
        'Order plaques, certificates, or keepsakes early so they arrive in time.',
        'Confirm your final guest count about two weeks ahead.',
        'Send guests the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'What should an awards banquet program include?',
        a: 'Most banquet programs include a welcome, dinner, remarks, the recognitions, and a closing. Share the order of events with every speaker ahead of time so the evening stays on schedule.',
      },
      {
        q: 'What are good ideas for a 50th anniversary celebration?',
        a: 'Popular ideas include a memory table with photos from each decade, a keepsake book where guests write notes, and a short tribute from each generation of the family. Pick one or two that fit the honorees rather than trying to do everything.',
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
      `${HALL} gives a shower an open, graceful room for family and friends.`,
      'Showers are usually planned by a friend or relative, often with co-hosts. One host sends the request and stays our contact, so every decision is made in one place.',
    ],
    sections: [
      {
        heading: 'The Hall for a shower',
        body: [
          `Most showers fit comfortably in ${HALL}, which holds up to ${INDOOR} guests. The fireplace feature wall makes a natural backdrop for gifts and photos, and the arched windows bring in daylight for an afternoon shower.`,
          `For a spring or summer shower outdoors, ${GROVE} holds up to ${OUTDOOR} guests, with picnic tables on a patio beside the timber gazebo.`,
        ],
      },
      {
        heading: 'Baby showers, gender reveals, and bridal showers',
        body: [
          'A baby shower usually happens four to eight weeks before the due date. A gender reveal builds toward one shared moment, so timing and a clear view for every guest matter most. Tell us which one you are planning in your request, and mention it if you are combining the two.',
          'A bridal shower is usually hosted by a friend, a sister, or a relative, two weeks to two months before the wedding. A couples shower follows the same idea with both partners as guests of honor. Confirm the wedding date and the guest list with the family before you book. Many hosts reserve six to ten weeks ahead.',
        ],
      },
    ],
    checklist: {
      heading: 'Shower planning checklist',
      items: [
        'Confirm the date with the parent-to-be, the couple, or the family.',
        'Agree on a budget with any co-hosts.',
        'Draft a guest list.',
        'Check your date and a backup on the availability calendar.',
        'Visit the space to plan where gifts, games, and photos will go.',
        'Plan a simple order for the event, from the welcome to the gifts or the reveal.',
        'Send guests the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'How long does a baby shower or bridal shower usually last?',
        a: 'Most showers run about two to three hours. Some days have a minimum number of hours, which the booking calendar shows when you choose a date.',
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
      'Turning one, sixteen, or fifty deserves a proper room, and so does retiring after decades of work.',
    ],
    sections: [
      {
        heading: 'Choosing the space for your party',
        body: [
          `${HALL} suits most milestone parties: an open room for up to ${INDOOR} guests, with arched windows, a fireplace feature wall, and double doors that make a fine entrance for the guest of honor.`,
          `A large open-house party or a summer celebration can move outdoors to ${GROVE}, which holds up to ${OUTDOOR} guests, with open lawn, a timber gazebo, and picnic tables on a patio.`,
        ],
      },
      {
        heading: 'First birthdays, sweet sixteens, and milestone birthdays',
        body: [
          'Every milestone brings a different crowd. A first birthday is a party for parents, grandparents, and a few little ones, so many families plan around nap schedules and keep the program short. A sweet sixteen usually centers on friends, photos, and one planned moment such as a candle ceremony.',
          'A fortieth, fiftieth, or seventieth often mixes generations and may include a few speeches or a surprise entrance. A retirement party brings together coworkers, family, and friends, so keep the speaking list short and give each speaker a few minutes at most.',
        ],
      },
    ],
    checklist: {
      heading: 'Birthday party planning checklist',
      items: [
        'Pick a first-choice date and a backup, and check both on the availability calendar.',
        'Decide early whether the party is a surprise.',
        `Choose ${HALL} or ${GROVE} for your guest count.`,
        'Set a budget and a working guest count.',
        "Visit the space to plan the room and the guest of honor's arrival.",
        'Plan a short run of show for the welcome, speeches, and photos.',
        'Send invitations four to six weeks ahead with the address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'How far in advance should I book a birthday party venue?',
        a: 'Many hosts book two to three months ahead for a milestone birthday and earlier for a larger party or a holiday weekend. The availability calendar shows open dates, so you can check yours right away.',
      },
      {
        q: 'How do I plan a surprise birthday party?',
        a: 'Ask guests to arrive about thirty minutes before the guest of honor, and choose one trusted person to bring them in on time. Mention the surprise in your request so we can plan arrival times with you.',
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
      `The gathering after a service is often where family and friends finally have time to talk and remember. ${HALL} offers a calm, dignified room for that time together.`,
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
          'Decide early who will welcome guests, who will offer a blessing, and who will gather photographs and flowers at the end. Small tasks like these are easy to hand to cousins, friends, or members of your congregation who want to help.',
        ],
      },
    ],
    checklist: {
      heading: 'Repast and celebration of life checklist',
      items: [
        'Confirm the service time and plan the start of the gathering around it.',
        'Choose one family point person for questions and decisions.',
        'Share a best guess at the guest count.',
        'Call us or check the date on the availability calendar.',
        'Choose who will welcome guests and who will offer a blessing.',
        'Gather photographs and keepsakes for a memory table.',
        'Share our address with guests and the funeral home.',
      ],
    },
    faqs: [
      {
        q: 'What is a repast?',
        a: 'A repast is a gathering after a funeral or memorial service, usually with family, friends, and members of their faith community. It gives people time to rest, visit, and share memories together.',
      },
      {
        q: 'How far ahead should we plan a celebration of life?',
        a: 'Repasts are often arranged within a few days of a funeral. Celebrations of life are sometimes held weeks or months later, which gives relatives from across Hampton Roads and farther away time to travel.',
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
    metaDescription: `Rent meeting space in Suffolk, VA for board meetings, trainings, and workshops. ${HALL} holds up to ${INDOOR} people, and on-site parking is included.`,
    h1: 'Meeting and training space in Suffolk',
    intro: [
      `Board meetings, staff trainings, and planning days often go better away from the office. ${HALL} gives your group a wooded setting on Godwin Boulevard in north Suffolk.`,
      'Businesses, nonprofits, schools, and community groups all book the same way.',
    ],
    sections: [
      {
        heading: 'The Hall for meetings and trainings',
        body: [
          `${HALL} holds up to ${INDOOR} people in one open room with arched windows and recessed lighting. It suits a board meeting, a training session, or a workshop that breaks into small groups.`,
          `For a staff picnic or an outdoor team day, ${GROVE} holds up to ${OUTDOOR} among tall pines, with picnic tables on a patio.`,
        ],
      },
      {
        heading: 'Before the meeting',
        body: [
          'Start with the agenda and work backward: what the group needs to finish, how long the session should run, and when to take breaks. A hands-on training needs a different layout than a board meeting where everyone faces each other.',
          'Most organizers book a few weeks ahead for a single meeting and a season ahead for an annual meeting or a full-day training. A few days before, send attendees the agenda, address, and start time, along with anything they should read first.',
        ],
      },
    ],
    checklist: {
      heading: 'Meeting and training checklist',
      items: [
        'Write a short agenda with start, break, and end times.',
        'Count your expected attendees.',
        'Check your date on the availability calendar.',
        'Get budget approval before you send your request.',
        'Visit the room to plan your layout.',
        'Ask us about any equipment your session needs.',
        'Send attendees the address and start time, and let them know parking is on site.',
      ],
    },
    faqs: [
      {
        q: 'Can we book recurring dates?',
        a: 'Ask in your request. Tell us the schedule you have in mind, and we will confirm which dates are available.',
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
      `Graduations and reunions bring together people who rarely share a room. ${GROVE} gives a large group space to spread out, with open lawn, a timber gazebo, and picnic tables on a patio.`,
    ],
    sections: [
      {
        heading: 'The Grove for a large gathering',
        body: [
          `${GROVE} holds up to ${OUTDOOR} guests. Families gather at the picnic tables on the patio, children have the open lawn, and the timber gazebo makes a natural spot for a group photograph.`,
          `For a smaller or cooler-weather gathering, ${HALL} holds up to ${INDOOR} guests indoors. Reserve both and the day can move between them.`,
        ],
      },
      {
        heading: 'Graduation parties',
        body: [
          'A graduation party lets grandparents, teachers, coaches, and friends say congratulations in person. If classmates are hosting parties too, compare dates early so friends can stop by more than one.',
        ],
      },
      {
        heading: 'Family and class reunions',
        body: [
          'Reunions take more coordination because the guest list is spread out. Many families form a small committee and send a save-the-date as soon as the date is set. Class reunion committees often start by rebuilding the contact list.',
          'Decide early how costs will be shared, such as a set contribution per household or a class fee. A simple program, like recognizing elders or welcoming new babies, gives the day shape.',
        ],
      },
    ],
    checklist: {
      heading: 'Graduation party and reunion checklist',
      items: [
        'Pick a date around the graduation ceremony or the travel plans of most relatives.',
        'Make a working guest count, with a cushion for late additions.',
        `Choose ${GROVE}, ${HALL}, or both for your guest count.`,
        'Set a budget with your committee.',
        'Visit the grounds with your committee before you reserve.',
        'Plan a weather option if the day is outdoors.',
        'Send save-the-dates with our address and parking details.',
      ],
    },
    faqs: [
      {
        q: 'How far ahead should we plan a family reunion?',
        a: 'Many families start nine to twelve months ahead so relatives can save and arrange travel. Check your date on the availability calendar as soon as the committee agrees on it.',
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
    summary: 'Conferences, civic meetings, and community days for local groups.',
    metaTitle: 'Community event venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Host a conference, civic meeting, or neighborhood day at The Venue at NCC in Suffolk, VA. ${GROVE} holds up to ${OUTDOOR} guests and ${HALL} up to ${INDOOR}.`,
    h1: 'Community events in Suffolk',
    intro: [
      'A conference, a civic forum, or a neighborhood day brings people together around a shared purpose. We give your organization the room to host it, indoors or among the pines.',
      'Nonprofits, civic groups, schools, faith groups, and neighborhood associations are welcome to book.',
    ],
    sections: [
      {
        heading: 'Choosing the space',
        body: [
          `${HALL} suits sessions, workshops, and community meetings: one open room for up to ${INDOOR} guests, with arched windows and recessed lighting.`,
          `${GROVE} suits a community picnic, a volunteer appreciation day, or a neighborhood gathering, with room for up to ${OUTDOOR} guests on the lawn and the patio under tall pines. Reserve both for a program that moves between them.`,
        ],
      },
      {
        heading: 'From purpose to run of show',
        body: [
          'Start with the purpose. Write one sentence about why the event exists and who should be there, and let it guide every other decision. Then set a date, a headcount, and a budget, and decide whether attendees will register.',
          'Build a simple run of show with start times, speakers, breaks, and an end time. Name one point person for the day, so volunteers, speakers, and our team all have a single contact.',
          'Conferences and community days are often set a season ahead so leaders, speakers, and volunteers can hold the date. Youth nights and smaller gatherings usually need four to eight weeks.',
        ],
      },
    ],
    checklist: {
      heading: 'Community event checklist',
      items: [
        'Write one sentence that explains the purpose of the event and who it is for.',
        'Set a date, a headcount, and a budget.',
        `Choose ${HALL}, ${GROVE}, or both for your headcount.`,
        'Visit the spaces with your planning team.',
        'Draft a run of show with start times, breaks, and a firm end time.',
        'Recruit volunteers for check-in and greeting, and name one point person for the day.',
        'Put the address and parking details on every flyer and registration page.',
      ],
    },
    faqs: [
      {
        q: 'Should we require registration for a conference?',
        a: 'Registration helps with name tags, materials, and headcounts for a conference, and a simple online form is usually enough. For a neighborhood gathering, an RSVP or a parent sign-up may be all you need.',
      },
    ],
    related: ['meetings-trainings', 'receptions-banquets', 'graduations-reunions'],
    keywords: [
      'community event space Suffolk VA',
      'nonprofit event venue Suffolk VA',
      'conference venue Suffolk VA',
      'civic event space Suffolk VA',
    ],
  },
];

export function getEvent(slug: string): EventType | undefined {
  return events.find((e) => e.slug === slug);
}
