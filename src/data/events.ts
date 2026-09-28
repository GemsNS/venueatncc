/**
 * Event types the venue promotes. Each entry becomes a landing page at /events/<slug>/.
 * Slugs and names must match src/data/event-types.ts.
 *
 * Copy rules:
 * - Venue facts (capacity, phone, address, church details) come from site.ts through the
 *   constants below, so a change there flows into every page. Never type them in by hand.
 * - Never type a price or a percentage. Rates live in src/shared/pricing.ts; point to the pricing
 *   page, or build the sentence from `pricing` (as the special rates below do).
 * - Unconfirmed details (tables and chairs, whether there is a kitchen, AV, decorating and setup
 *   times, end times) appear only as questions to ask us. Never state or imply an answer.
 * - Reserving always reads: we confirm availability, then your booking deposit reserves the date.
 * - No em or en dashes, no exclamation marks. Headings in sentence case.
 */
import { site, fullAddress, type SpaceId } from './site';
import { pricing } from '../shared/pricing';

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

function capacityOf(id: SpaceId): number {
  const space = site.spaces.find((s) => s.id === id);
  if (!space) throw new Error(`site.ts has no "${id}" space`);
  return space.capacity;
}

const INDOOR = capacityOf('indoor');
const OUTDOOR = capacityOf('outdoor');
const PHONE = site.contact.phone;
const ADDRESS = fullAddress;
const STREET = site.address.street;
const CHURCH = site.parent.name;
const FOUNDED = site.parent.foundingYear;
const FOUNDER = site.parent.pastor;
const CHURCH_SITE = site.parent.url.replace('https://', '');
/** The reserving sentence, worded the same everywhere on the site. */
const RESERVE = 'We confirm availability, then your booking deposit reserves the date.';

/** Special-rate sentences, built from the rate card so the percentages never drift. */
const repastRate = pricing.discounts.find((d) => d.id === 'repast' && d.percent > 0);
const nonprofitRate = pricing.discounts.find((d) => d.id === 'nonprofit' && d.percent > 0);
const howApplied = (d: { appliesTo: string }) =>
  d.appliesTo === 'manual' ? 'Mention it in your request.' : 'It is applied automatically in your estimate.';
const REPAST_RATE = repastRate
  ? ` Repasts and celebrations of life get our ${repastRate.label.toLowerCase()}: ${repastRate.percent}% off the rental. ${howApplied(repastRate)}`
  : '';
const NONPROFIT_RATE = nonprofitRate
  ? ` The special rate for ${nonprofitRate.label.charAt(0).toLowerCase()}${nonprofitRate.label.slice(1)} is ${nonprofitRate.percent}% off the rental. ${howApplied(nonprofitRate)}`
  : '';

export const events: EventType[] = [
  {
    slug: 'weddings',
    name: 'Weddings & receptions',
    summary: 'Ceremonies, receptions, and the celebrations around your wedding day.',
    metaTitle: 'Wedding venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan your wedding at The Venue at NCC in Suffolk, VA: an indoor hall for up to ${INDOOR} guests, outdoor space for up to ${OUTDOOR}, and on-site parking included.`,
    h1: 'Your Suffolk wedding venue at New Community Church',
    intro: [
      `The Venue at NCC is the event space of ${CHURCH} at ${STREET} in Suffolk, Virginia. Say your vows outdoors with up to ${OUTDOOR} guests, or celebrate in the indoor hall with up to ${INDOOR}. Anyone can book, and church membership is not required.`,
      'Your rental includes the space you book and on-site parking. Catering is not included, which leaves the menu and the caterer up to you. Alcohol is allowed, so a champagne toast or a bar can be part of the plan.',
    ],
    sections: [
      {
        heading: 'Ceremony, reception, or both',
        body: [
          `Many couples want everything in one place so guests are not driving across town between the ceremony and the reception. At The Venue at NCC you can book the indoor hall, book the outdoor space, or request both for the same day. We confirm availability for each space when we follow up on your request.`,
          `Your guest count points you to the right space. The indoor hall holds up to ${INDOOR} guests. The outdoor space holds up to ${OUTDOOR}, which makes it a natural choice for an open-air ceremony or a larger reception. If you plan to be outdoors, settle on a weather plan early and share it with your vendors.`,
        ],
      },
      {
        heading: 'Your caterer, your menu',
        body: [
          'Catering is not included, and that gives you room to plan the meal your way. Book the caterer you already trust, choose a cuisine that reflects your families, or plan a relaxed buffet. There is no house menu to work around.',
          'Alcohol is allowed, so you can plan a champagne toast, wine with dinner, or a full bar through your caterer. Before you sign with a caterer, ask us whether there is a kitchen they can use and what time they can arrive, so their plan matches the space.',
        ],
      },
      {
        heading: 'Rehearsal dinners and engagement parties',
        body: [
          'A wedding is often more than one event. Engagement parties, rehearsal dinners, and a family brunch the day after all bring people together around the main celebration, and each one can be booked on its own date.',
          'Check each date on the availability calendar, then send a request for each gathering. If the dates are close together, mention that in your requests so we can look at them together.',
        ],
      },
      {
        heading: 'How to reserve your wedding date',
        body: [
          `Booking takes three steps. Pick your date on the live availability calendar and choose the indoor hall, the outdoor space, or both. Send a request with your guest count and plans, which takes about two minutes. ${RESERVE}`,
          `Rates depend on the day, the space, and how many hours you need. The pricing page shows the full rate card and gives you an instant estimate, so you can compare dates before you choose one. Prefer to talk it through first? Call ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Wedding venue checklist',
      items: [
        'Set your budget and a rough guest count before you choose a space.',
        `Choose the indoor hall for up to ${INDOOR} guests, the outdoor space for up to ${OUTDOOR}, or request both.`,
        'Pick two or three possible dates and compare them on the availability calendar.',
        'Get an instant estimate on the pricing page for each date you are considering.',
        'Book your caterer early, since catering is not included with the rental.',
        'Plan your drinks. Alcohol is allowed, so arrange any bar service with your caterer.',
        'Ask us whether tables and chairs are included or should be rented.',
        'Ask whether there is a kitchen your caterer can use, and ask about decorating, setup times, and what time your event needs to end.',
      ],
    },
    faqs: [
      {
        q: 'Can we have our ceremony and reception at The Venue at NCC?',
        a: `Yes. You can hold both in one space, or request the indoor hall and the outdoor space together for the same day. The outdoor space holds up to ${OUTDOOR} guests for an open-air ceremony, and the indoor hall holds up to ${INDOOR}. We confirm availability for each space when we follow up on your request.`,
      },
      {
        q: 'Do we need to be members of New Community Church?',
        a: `No. Anyone can book The Venue at NCC for a wedding. Couples planning a faith-centered wedding often like celebrating at a church venue, and ${CHURCH} has been part of Suffolk since ${FOUNDED}, but membership is never required.`,
      },
      {
        q: 'Can we bring our own caterer and serve alcohol?',
        a: 'Yes. Catering is not included, so you choose your caterer or bring your own food, and alcohol is allowed. Before you finalize the plan with your caterer, ask us whether there is a kitchen they can use and when they can arrive.',
      },
      {
        q: 'How much does a wedding at The Venue at NCC cost?',
        a: 'Rates depend on the day, the space, and how many hours you need. The pricing page lists the full rate card and gives an instant estimate for your date, and on-site parking is included with every booking.',
      },
      {
        q: 'How far in advance should we book a wedding venue?',
        a: 'Many couples book nine to twelve months before the wedding, and earlier if they have their heart set on one date. The availability calendar shows open dates, so you can see right away whether yours is free.',
      },
    ],
    related: ['receptions-banquets', 'baby-bridal-showers', 'church-community-events'],
    keywords: [
      'wedding venue Suffolk VA',
      'wedding reception venue Suffolk VA',
      'outdoor wedding venue Suffolk VA',
      'church wedding venue Suffolk VA',
      'affordable wedding venue Suffolk VA',
      'small wedding venue Hampton Roads',
    ],
  },
  {
    slug: 'receptions-banquets',
    name: 'Banquets & anniversaries',
    summary: 'Anniversary dinners, award banquets, and formal celebrations.',
    metaTitle: 'Banquet hall in Suffolk, VA | The Venue at NCC',
    metaDescription: `Host an anniversary dinner or awards banquet at The Venue at NCC in Suffolk, VA. Indoor hall for up to ${INDOOR} guests, your own caterer, and alcohol allowed.`,
    h1: 'Anniversary dinners and awards banquets in Suffolk',
    intro: [
      `Fifty years of marriage and a season of hard work have something in common: both deserve to be honored with the people who were there. The Venue at NCC in Suffolk has an indoor hall for up to ${INDOOR} guests and an outdoor space for up to ${OUTDOOR}, and anyone can book it.`,
      'Catering is not included, so you bring the caterer or menu that suits the occasion, and alcohol is allowed for a toast or a bar. On-site parking is included with every booking, which helps when guests of every age are arriving at once.',
    ],
    sections: [
      {
        heading: 'Planning a banquet or formal dinner',
        body: [
          'Formal celebrations run best with a clear program. Decide early who will speak, whether there will be awards or a photo slideshow, and how long the program should last. Many hosts build the evening around a meal, then move into speeches, tributes, and recognitions.',
          `Set your budget and guest list first, since both shape almost every other choice. The indoor hall holds up to ${INDOOR} guests, and the outdoor space holds up to ${OUTDOOR} for a larger crowd or an open-air reception. For a banquet, confirm award names and spellings before the printing deadline, and give each presenter a set number of minutes.`,
        ],
      },
      {
        heading: 'Hosting an anniversary party in Suffolk',
        body: [
          'A 25th, 40th, or 50th anniversary is a chance to gather family and the friends who have been there through the years. Many families plan a dinner with a short program, a few words from children or grandchildren, and a slideshow of photos across the decades. Others keep it simple with a meal and time to visit.',
          'Alcohol is allowed, so a champagne toast to the couple is easy to include. If you are planning a surprise, pick one person to manage the guest list and keep the details quiet, and mention the surprise in your booking request.',
        ],
      },
      {
        heading: 'Awards banquets, team dinners, and appreciation nights',
        body: [
          'Schools, sports teams, clubs, businesses, and churches often hold banquets to close out a season or a year of work. Scholarship dinners and volunteer appreciation nights follow a similar shape: a welcome, a meal, and time to honor people. Anyone can book The Venue at NCC, so your group does not need any tie to the church.',
          'If the program includes a slideshow or microphones, ask us about sound and screens before you plan around them. If you plan to serve alcohol, Virginia ABC may require a banquet license, so check its rules early.',
        ],
      },
      {
        heading: 'Reserving a date for your banquet or anniversary dinner',
        body: [
          `Booking takes three steps. Pick your date on the live availability calendar and send a request with the occasion and a rough guest count, which takes about two minutes. ${RESERVE}`,
          `Rates depend on the day, the space, and how many hours you need. If a board or committee needs to approve the cost, the instant estimate on the pricing page gives them a clear figure to review. Questions first? Call ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Banquet planning checklist',
      items: [
        'Confirm the occasion, a few possible dates, and a rough guest count.',
        'Check your dates on the availability calendar and get an instant estimate.',
        'Book your caterer, since catering is not included with the rental.',
        'Plan drinks for the toast or the bar. Alcohol is allowed.',
        'Ask us whether a microphone, sound, or a screen is available for speeches and slideshows.',
        'Ask whether tables and chairs are included, and when you can arrive to set up and decorate.',
        'Write out your program with speakers, awards, and timing in order.',
        'Order plaques, certificates, or anniversary keepsakes early so they arrive in time.',
      ],
    },
    faqs: [
      {
        q: 'Can we use our own caterer for a banquet?',
        a: 'Yes. Catering is not included, so you choose the caterer or bring your own food. When you send your request, ask us whether there is a kitchen your caterer can use and when they can arrive.',
      },
      {
        q: 'Is alcohol allowed at an anniversary party or banquet?',
        a: "Yes. You can serve alcohol at your event. Virginia ABC may require a banquet license, so check its rules early.",
      },
      {
        q: 'How many guests can a banquet at The Venue at NCC hold?',
        a: `The indoor hall holds up to ${INDOOR} guests, and the outdoor space holds up to ${OUTDOOR}. Choose the space that fits your guest list when you pick your date on the availability calendar.`,
      },
      {
        q: 'What are good ideas for a 50th anniversary celebration?',
        a: 'Popular ideas include a memory table with photos from each decade, a keepsake book where guests write notes, and a short tribute from each generation of the family. Pick one or two that fit the honorees rather than trying to do everything.',
      },
      {
        q: 'What should an awards banquet program include?',
        a: 'Most banquet programs include a welcome, a meal, remarks, the recognitions, and a closing. Share the order of events with every speaker ahead of time so the evening stays on schedule.',
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
    summary: 'Showers, gender reveals, and sip-and-sees for family and friends.',
    metaTitle: 'Baby and bridal shower venue, Suffolk | The Venue at NCC',
    metaDescription:
      'Host a baby shower, bridal shower, or gender reveal at The Venue at NCC in Suffolk, VA. Bring your own food, parking is included, and anyone can book.',
    h1: 'Baby shower and bridal shower venue in Suffolk',
    intro: [
      `A shower is often the first time family and friends gather around big news: a baby on the way or a wedding on the calendar. The Venue at NCC in Suffolk has an indoor hall for up to ${INDOOR} guests, and anyone can book it for a shower, a gender reveal, or a sip-and-see.`,
      'Catering is not included, which gives shower hosts plenty of freedom: bring homemade favorites, order trays, or hire a caterer. On-site parking is included with your booking, and you can check open dates on the availability calendar any time.',
    ],
    sections: [
      {
        heading: 'Baby showers, gender reveals, and sip-and-sees',
        body: [
          'Baby celebrations come in a few forms, and each one plans a little differently. A traditional baby shower happens before the baby arrives and usually centers on food, games, and gifts. A gender reveal builds toward one shared moment, so timing and a clear view for every guest matter most. A sip-and-see comes after the birth and gives friends and family an easygoing way to meet the baby.',
          'Tell us which one you are planning in your booking request. If you are combining two, like a shower with a reveal at the end, mention that too.',
        ],
      },
      {
        heading: 'Hosting a bridal shower or couples shower',
        body: [
          'A bridal shower is usually hosted by a friend, a sister, or a relative rather than the bride. The host handles the guest list, the menu, and a few simple activities so the bride can spend her time with the people who came for her. A couples shower follows the same idea with both partners as guests of honor.',
          'Confirm the wedding date and the guest list with the bride or her family before you book. Alcohol is allowed, so a brunch shower with mimosas works if the bride would like one.',
        ],
      },
      {
        heading: 'Planning tips for baby and bridal showers',
        body: [
          'Most hosts find it easier to plan backward from the date. Baby showers are often held four to eight weeks before the due date, and bridal showers are often held two weeks to two months before the wedding. Pick a first-choice date and a backup before you start.',
          'Set a budget early and decide who is covering what, especially when several friends or relatives are co-hosting. The instant estimate on the pricing page gives every co-host the same figure to plan around. Before you order decorations, ask us about decorating and setup times so your purchases match your plans.',
        ],
      },
      {
        heading: 'Booking your shower at The Venue at NCC',
        body: [
          `Booking takes three steps. Pick your date on the live availability calendar and send a request with the type of shower and a rough guest count, which takes about two minutes. ${RESERVE}`,
          `If you are co-hosting, agree on the date first so one host can send the request. Questions before you book? Call ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Shower planning checklist',
      items: [
        'Confirm the date with the parent-to-be, the bride, or the family before you book.',
        'Set a budget and use the instant estimate to split costs with co-hosts.',
        `Write a draft guest list. The indoor hall holds up to ${INDOOR} guests.`,
        'Plan the food, since catering is not included. Homemade, catered, or a mix of both is up to you.',
        'Ask us whether there is a kitchen you can use if you plan to warm or serve food on site.',
        'Ask whether tables and chairs are provided and what you should bring yourself.',
        'Ask about decorating and when you can arrive to set up.',
        'Plan a simple order for the event, from food and games to gifts or the big reveal.',
      ],
    },
    faqs: [
      {
        q: 'Can I plan a gender reveal or sip-and-see at The Venue at NCC?',
        a: 'Yes. Anyone can book The Venue at NCC for gender reveals and sip-and-sees as well as baby and bridal showers. Pick your date on the availability calendar and tell us your plans in your request.',
      },
      {
        q: 'Can I bring my own food to a shower?',
        a: 'Yes. Catering is not included, so you can bring homemade food, order from a caterer, or do both. If you need to warm or chill anything on site, ask us whether there is a kitchen you can use.',
      },
      {
        q: 'When should a baby shower be held?',
        a: 'Many families hold a baby shower four to eight weeks before the due date, while there is still time to sort and set up the gifts. A sip-and-see usually happens a few weeks to a few months after the baby arrives.',
      },
      {
        q: 'How long does a baby shower or bridal shower usually last?',
        a: 'Most showers run about two to three hours, which leaves time for food, a game or two, and opening gifts. Rates depend on the day and how many hours you book, so check the instant estimate on the pricing page for your date.',
      },
    ],
    related: ['weddings', 'birthday-parties', 'receptions-banquets'],
    keywords: [
      'baby shower venue Suffolk VA',
      'bridal shower venue Suffolk VA',
      'gender reveal venue Suffolk VA',
      'sip and see venue Suffolk VA',
      'baby shower venue Hampton Roads',
    ],
  },
  {
    slug: 'birthday-parties',
    name: 'Birthdays & milestones',
    summary: 'First birthdays, sweet sixteens, big-number birthdays, and retirement parties.',
    metaTitle: 'Birthday party venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan a sweet sixteen, 50th birthday, or retirement party at The Venue at NCC in Suffolk, VA. Up to ${INDOOR} guests indoors, alcohol allowed, parking included.`,
    h1: 'Milestone birthdays and retirement parties in Suffolk',
    intro: [
      `Turning one, sixteen, or fifty deserves more than a quick cake after dinner. So does retiring after decades of work. The Venue at NCC in Suffolk has an indoor hall for up to ${INDOOR} guests and an outdoor space for up to ${OUTDOOR}, and anyone can book it for a milestone party.`,
      'Catering is not included, so the menu, the cake, and the caterer are your call. Alcohol is allowed for grown-up celebrations, and on-site parking is included with every booking.',
    ],
    sections: [
      {
        heading: 'First birthdays, sweet sixteens, and big-number birthdays',
        body: [
          'Every milestone brings a different crowd. A first birthday is really a party for parents, grandparents, and a handful of little ones, so many families plan around nap schedules and keep the program short. A sweet sixteen is built for teens and usually leans on music, photos, and a few planned moments like a toast or a candle ceremony. A fortieth, fiftieth, or seventieth often mixes generations and may include a slideshow, a few speeches, or a surprise entrance.',
          `A big guest list can move outside, where the outdoor space holds up to ${OUTDOOR}. If you plan to show photos or play music, ask us about sound and screens so you know what to bring.`,
        ],
      },
      {
        heading: 'Retirement parties and other milestone celebrations',
        body: [
          'A retirement party marks the end of a long chapter, and it often brings together coworkers, family, and friends from church or the neighborhood. Many hosts plan a short program with a meal, a few speeches, and time for guests to share stories with the retiree. Keep the speaking list short and ask each speaker for a few minutes at most so the party moves along.',
          'If an employer or team is helping with the party, settle early who is paying and who is on the guest list. The instant estimate on the pricing page gives everyone the same figure to plan around.',
        ],
      },
      {
        heading: 'How to plan a milestone birthday party',
        body: [
          'Start with the guest of honor. Decide early whether the party is a surprise, and if it is, pick one trusted person to handle the arrival. Next, set a budget and a rough guest count, since those two numbers shape the menu, the invitations, and which space you need.',
          'Send invitations four to six weeks ahead for most milestone parties, and earlier if guests are traveling. Before you book a caterer or a baker, ask us whether there is a kitchen they can use, when you can set up, and what time the party needs to end, so everyone works from the same schedule.',
        ],
      },
      {
        heading: 'Three steps to book your birthday party',
        body: [
          `Pick your date on the live availability calendar. Send a request with the occasion and about how many guests you expect, which takes about two minutes. ${RESERVE}`,
          `Rates depend on the day, the space, and how many hours you need, and the pricing page shows an instant estimate. Our address is ${ADDRESS}, and you can reach us at ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Birthday party planning checklist',
      items: [
        'Pick a first-choice date and a backup, and check both on the availability calendar.',
        'Decide early whether the party is a surprise and who will bring the guest of honor.',
        'Set a budget and get an instant estimate on the pricing page.',
        'Line up your cake, food, or caterer, since catering is not included.',
        'Plan drinks for the adults. Alcohol is allowed.',
        'Ask us whether music equipment or a screen is available, or what to bring.',
        'Ask when you can arrive to decorate and what time the party needs to end.',
        'Plan a short run of show for food, cake, speeches, and photos.',
      ],
    },
    faqs: [
      {
        q: 'Where can I host a retirement party in Suffolk, VA?',
        a: `The Venue at NCC, at ${STREET} in Suffolk, can be booked by anyone for a retirement party. The indoor hall holds up to ${INDOOR} guests, and on-site parking is included.`,
      },
      {
        q: 'Can I bring my own cake, food, and drinks?',
        a: 'Yes. Catering is not included, so you bring the cake, food, and caterer you want, and alcohol is allowed. When you send your request, ask us whether there is a kitchen your caterer can use.',
      },
      {
        q: 'How far in advance should I book a birthday party venue?',
        a: 'Many hosts book two to three months ahead for a milestone birthday and earlier for a larger party or a holiday weekend. The availability calendar shows open dates, so you can check yours right away.',
      },
      {
        q: 'How do I plan a surprise birthday party?',
        a: 'Ask guests to arrive about 30 minutes before the guest of honor, and choose one trusted person to bring them in on time. When you book, ask what time your guests can arrive so the surprise timing works.',
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
    summary: 'A place for family and friends to gather, share a meal, and remember.',
    metaTitle: 'Repast venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `A place for family and friends to gather after a funeral or memorial in Suffolk, VA. Bring your own food, and parking is included. Call ${PHONE}.`,
    h1: 'Repasts and celebrations of life in Suffolk',
    intro: [
      `When someone you love has died, the gathering after the service is often where the stories come out and people finally have time to talk. The Venue at NCC, the event space of ${CHURCH} in Suffolk, is open to any family for a repast or celebration of life, whether or not you belong to the church.`,
      `The indoor hall holds up to ${INDOOR} guests, and on-site parking is included. You may be planning this within a few days, so the first step is short: call ${PHONE}, or send a request from the availability calendar, and we will follow up with you.`,
    ],
    sections: [
      {
        heading: 'Planning a funeral repast',
        body: [
          'Most repasts begin soon after the burial or memorial service, so the service schedule usually sets the timing. Many families choose one point person to handle the repast so the closest relatives are not fielding every question. That person can confirm the date, share a rough guest count, and keep track of decisions in one place.',
          'Food is often the biggest decision. Catering is not included, so your family decides what is served. Some families hire a caterer, some ask relatives and friends to bring dishes, and some do a mix of both. Ask us whether there is a kitchen you can use and how much time you will have to set up, so the food plan works on the day.',
          'It also helps to decide early who will welcome guests, who will offer a blessing before the meal, and who will pack up leftovers and flowers at the end. Small jobs like these are easy to hand to cousins, friends, or church members who want to help.',
        ],
      },
      {
        heading: 'Hosting a celebration of life in Suffolk',
        body: [
          'A celebration of life can look different from a traditional repast. Some families want to display photos, share music the person loved, show a slideshow, or leave time for guests to tell stories. If any of that is part of your plan, ask us about sound and screens when you reach out.',
          `Celebrations of life are sometimes held weeks or months after a passing, which gives the family more time to plan and makes it easier for relatives from across Hampton Roads and farther away to attend. When more people are expected than the indoor hall holds, the outdoor space holds up to ${OUTDOOR} guests.`,
        ],
      },
      {
        heading: 'Arranging a repast at The Venue at NCC',
        body: [
          `You can call ${PHONE} or start online. Pick the date on the availability calendar, send a short request with the service time and a rough guest count, and we confirm availability. Then your booking deposit reserves the date. A best guess on numbers is fine, since attendance at a repast is often hard to know ahead of time.`,
          `Rates depend on the day and how many hours you need, and the pricing page shows an instant estimate so the family can see the cost before deciding.${REPAST_RATE} If you are coordinating with a funeral home, share our address, ${ADDRESS}, with them early.`,
        ],
      },
    ],
    checklist: {
      heading: 'Repast and celebration of life checklist',
      items: [
        'Confirm the service time and plan the repast start time around it.',
        'Choose one family point person to answer questions and keep track of decisions.',
        'Share a rough guest count, and plan food for a few more people than you expect.',
        'Decide on food. Catering is not included, so a caterer, family dishes, or both are up to you.',
        'Ask us whether there is a kitchen you can use and how much time you will have to set up and clean up.',
        'Ask whether tables and chairs are provided, and whether sound or a screen is available for a slideshow.',
        'Pick who will welcome guests and who will offer a blessing before the meal.',
        `Share the address, ${ADDRESS}, with guests and the funeral home.`,
      ],
    },
    faqs: [
      {
        q: 'What is a repast?',
        a: 'A repast is a meal shared after a funeral or memorial service, usually with family, friends, and members of the church community. It gives people time to rest, eat, and share memories together.',
      },
      {
        q: 'Do we need to be members of New Community Church to hold a repast here?',
        a: 'No. Anyone can book The Venue at NCC. Families from every church, and families without a church home, are welcome.',
      },
      {
        q: 'Can we hold a repast at The Venue at NCC right after the funeral?',
        a: `Check the date on the availability calendar or call ${PHONE}, and share the time of the service. We will talk through timing with you and confirm what works.`,
      },
      {
        q: 'Can family members bring food to a repast?',
        a: 'Yes. Catering is not included, so family and friends can bring dishes, you can hire a caterer, or you can do both.',
      },
      {
        q: 'How far ahead should we plan a celebration of life?',
        a: `Repasts are often planned within a few days of a funeral, while celebrations of life can be planned weeks or months ahead. Either way, check your date on the availability calendar or call ${PHONE}, and we will talk it through.`,
      },
    ],
    related: ['church-community-events', 'receptions-banquets'],
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
    metaDescription: `Rent meeting space in Suffolk, VA for board meetings, trainings, and workshops. Room for up to ${INDOOR} people, parking included, and instant estimates online.`,
    h1: 'Off-site meeting space in Suffolk for your team or board',
    intro: [
      `Board meetings, staff trainings, and planning days often go better away from the usual office. The Venue at NCC at ${STREET} in Suffolk has an indoor hall for up to ${INDOOR} people, and any business, nonprofit, or group can book it.`,
      'On-site parking is included with every booking, so there is nothing extra to budget for parking. Catering is not included, which means you can bring in coffee, order lunch from the place your team already likes, or hire a caterer.',
    ],
    sections: [
      {
        heading: 'Before the meeting: agendas, breaks, and presentations',
        body: [
          'Start with the agenda and work backward. Once you know what the group needs to get done, you can decide how long the session should run, when to take breaks, and whether to plan a meal. A hands-on training usually needs a different layout than a board meeting where everyone faces each other.',
          'Many organizers send the agenda, address, and start time a few days ahead, along with any reading people should do first. If you plan to present slides or bring in a remote speaker, ask us about screens, sound, and internet access before you finalize the plan.',
        ],
      },
      {
        heading: 'Workshops and training sessions in Suffolk',
        body: [
          'Workshops often run longer than a standard meeting and involve more movement, from small-group activities to hands-on practice. Think about how people will work together, what supplies each group will use, and how the day will flow from one activity to the next. If you are planning a full-day session, build in a real lunch break so people come back ready to work.',
          'For trainings that end with a certificate or sign-off, prepare sign-in sheets and materials ahead of time. Ask us whether tables and chairs are provided for your layout and how early you can arrive to set up, so everything is ready before the first person walks in.',
        ],
      },
      {
        heading: 'Meeting space for nonprofit boards and staff teams',
        body: [
          'Nonprofit boards, staff teams, and volunteer committees often need a place to meet a few times a year for planning, training, or an annual meeting. A change of setting can help a team step back from daily work and plan for the year ahead.',
          `If your group meets on a regular schedule, ask whether recurring dates are possible when you send your request. Groups coming from across Hampton Roads will find us at ${ADDRESS}.`,
        ],
      },
      {
        heading: 'How to book meeting space at The Venue at NCC',
        body: [
          `Booking takes three steps. Pick your date on the live availability calendar and send a request with your meeting type and headcount, which takes about two minutes. ${RESERVE}`,
          `Rates depend on the day, the space, and how many hours you need. The pricing page gives an instant estimate you can forward for approval, and you can reach us at ${PHONE} with any questions.`,
        ],
      },
    ],
    checklist: {
      heading: 'Meeting and training checklist',
      items: [
        'Write a short agenda with start, break, and end times.',
        `Estimate your headcount. The indoor hall holds up to ${INDOOR} people.`,
        'Get an instant estimate on the pricing page for budget approval.',
        'Ask us whether screens, sound, or Wi-Fi are available for presentations.',
        'Ask whether tables and chairs are provided for your layout.',
        'Plan coffee and lunch, since catering is not included.',
        'Ask how early you can arrive to set up and how late you can stay to pack up.',
        'Send attendees the address and start time, and let them know parking is included.',
      ],
    },
    faqs: [
      {
        q: 'What kinds of meetings can we hold at The Venue at NCC?',
        a: `Anyone can book The Venue at NCC for board meetings, trainings, workshops, and nonprofit gatherings. The indoor hall holds up to ${INDOOR} people. If your event is a little different, tell us about it in your request.`,
      },
      {
        q: 'Is there a projector or screen for presentations?',
        a: `Ask us about screens, sound, and internet access in your request or by calling ${PHONE}. Wherever you present, it is wise to bring a backup copy of your slides and any adapters your laptop needs.`,
      },
      {
        q: 'Can we bring in coffee or lunch?',
        a: 'Yes. Catering is not included, so you can bring your own coffee and lunch or have a caterer deliver. If you need to keep food warm, ask us whether there is a kitchen you can use.',
      },
      {
        q: 'Is parking included for attendees?',
        a: 'Yes. On-site parking is included with every booking.',
      },
      {
        q: 'How do I book meeting space in Suffolk at The Venue at NCC?',
        a: `Pick your date on the availability calendar and send a request with your meeting details, which takes about two minutes. ${RESERVE} The pricing page gives an instant estimate before you send it.`,
      },
    ],
    related: ['church-community-events', 'receptions-banquets'],
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
    metaDescription: `Host a graduation party or family reunion at The Venue at NCC in Suffolk, VA. Outdoor space for up to ${OUTDOOR} guests, parking included, and your own food.`,
    h1: 'Graduation parties and reunions in Suffolk',
    intro: [
      `Graduations and reunions only come around once in a while. A graduate finishes high school or college, a class marks twenty years, or the whole family finally settles on one weekend together. The Venue at NCC in Suffolk has an outdoor space for up to ${OUTDOOR} guests and an indoor hall for up to ${INDOOR}, and anyone can book it.`,
      "Catering is not included, so you can plan a potluck, hire a caterer, or put the family's best cooks in charge. On-site parking is included, which helps when relatives are driving in from across Hampton Roads and beyond.",
    ],
    sections: [
      {
        heading: 'Graduation parties for high school and college grads',
        body: [
          'A graduation party is a chance for the people who helped along the way to say congratulations in person. Grandparents, teachers, coaches, church family, and friends all get to share in the moment. Many families plan the party for the same weekend as the ceremony, so out-of-town relatives can make one trip for both.',
          `For an open-house party with a long guest list, the outdoor space holds up to ${OUTDOOR} guests. If your graduate has classmates hosting parties too, compare dates early so friends can stop by more than one. A few words from family or a display of photos from the early years makes the party feel personal.`,
        ],
      },
      {
        heading: 'Family reunion and class reunion planning tips',
        body: [
          'Reunions take more coordination than most parties because the guest list is spread out. Many families form a small committee, pick a date nine to twelve months ahead, and send a save-the-date as soon as it is set. Class reunion committees often start by rebuilding the contact list, since addresses and emails change over the years.',
          'Decide early how costs will be covered, such as a set contribution per household, a class fee, or a few family sponsors. Plan a simple program, like recognizing elders, welcoming new babies and in-laws, or reading the names of classmates who have passed. Alcohol is allowed, so a class reunion can include a bar or a toast to old friends.',
          `Relatives and classmates may be traveling from across Hampton Roads and beyond. Share the full address, ${ADDRESS}, early so everyone can plan the trip.`,
        ],
      },
      {
        heading: 'Questions to settle before you book a reunion or graduation party',
        body: [
          'Some answers are already settled. Catering is not included, so the food is yours to plan, and on-site parking is included. Bring the rest of your questions to us, such as whether tables and chairs are included and when you can set up and clean up.',
          `Your rough guest count points to the right space: up to ${INDOOR} guests in the indoor hall or up to ${OUTDOOR} in the outdoor space. That number also shapes how much food to order and how the day is set up.`,
        ],
      },
      {
        heading: 'Booking your graduation party or reunion',
        body: [
          `Booking takes three steps. Pick your date on the live availability calendar and send a request with the type of celebration and a rough guest count, which takes about two minutes. ${RESERVE}`,
          `The instant estimate on the pricing page makes it easy to work out a fair share per household or classmate. If you are planning for a reunion committee, have one point person handle the booking so the details stay in one place. Questions? Call ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Graduation party and reunion checklist',
      items: [
        'Pick a date that works around the graduation ceremony or the travel plans of most relatives.',
        'Make a rough guest count, and add a cushion for plus-ones and late additions.',
        `Choose a space: up to ${INDOOR} guests indoors or up to ${OUTDOOR} outdoors.`,
        'Get an instant estimate and decide how households or classmates will share the cost.',
        'Plan the food, since catering is not included. A potluck, a caterer, or both is up to you.',
        'Ask whether tables and chairs are included, and whether there is a kitchen your caterer can use.',
        'Ask about setup, cleanup, and end times for your event.',
        'Send save-the-dates with the full address and a note that parking is included.',
      ],
    },
    faqs: [
      {
        q: 'How far ahead should we plan a family reunion?',
        a: 'Many families start nine to twelve months ahead so relatives can save money and arrange travel. Check your date on the availability calendar as soon as the committee agrees on it.',
      },
      {
        q: 'How many guests can the venue hold for a graduation party or reunion?',
        a: `The outdoor space holds up to ${OUTDOOR} guests, and the indoor hall holds up to ${INDOOR}. Choose the space that fits your guest list when you pick your date.`,
      },
      {
        q: 'Can we bring our own food or caterer to a reunion?',
        a: 'Yes. Catering is not included, so a potluck, a caterer, or a mix of both is up to you. Alcohol is allowed too, if your reunion plans a bar or a toast.',
      },
      {
        q: 'When should we have a graduation party?',
        a: 'Many families hold the party the same weekend as the ceremony or within a few weeks after, so relatives can make one trip.',
      },
    ],
    related: ['birthday-parties', 'receptions-banquets', 'church-community-events'],
    keywords: [
      'graduation party venue Suffolk VA',
      'family reunion venue Suffolk VA',
      'class reunion venue Suffolk VA',
      'outdoor party venue Suffolk VA',
      'family reunion venue Hampton Roads',
    ],
  },
  {
    slug: 'church-community-events',
    name: 'Church & community events',
    summary: 'Conferences, fellowship events, youth nights, and community meetings.',
    metaTitle: 'Church event venue in Suffolk, VA | The Venue at NCC',
    metaDescription: `Plan a church conference, youth night, or community meeting at The Venue at NCC in Suffolk, VA. Open to any group, with room for up to ${OUTDOOR} guests outdoors.`,
    h1: 'Church and community events in Suffolk',
    intro: [
      `Much of the life of a church or community happens outside of Sunday morning. A conference, a fellowship event, a youth night, or a community meeting each needs a clear plan and a place to meet. The Venue at NCC in Suffolk has an indoor hall for up to ${INDOOR} guests and an outdoor space for up to ${OUTDOOR}, and any church or community group can book it.`,
      `The Venue at NCC is the event space of ${CHURCH}, founded in ${FOUNDED} by ${FOUNDER}, who serves as its pastor. Other churches, ministries, and neighborhood groups are welcome to book, and on-site parking is included.`,
    ],
    sections: [
      {
        heading: 'Conferences, fellowship events, and youth nights',
        body: [
          'Conferences, fellowship events, and youth nights each ask something different of the host. A conference needs a clear schedule, a check-in plan, and breaks people can count on. A fellowship event is about time together, so leave open time in the schedule for people to talk.',
          `Youth nights run best with a simple plan, enough adult volunteers, and a way to reach every parent. Community meetings need an agenda, a facilitator, and a clear way for people to share their input. A fellowship picnic or community day can use the outdoor space, which holds up to ${OUTDOOR} guests.`,
        ],
      },
      {
        heading: 'Church event planning, from purpose to run of show',
        body: [
          'Start with the purpose. Write one sentence about why the event exists and who should be there, and use it to guide every other decision. From there, set a date, a rough headcount, and a budget, and decide if attendees will need to register. The instant estimate on the pricing page makes it easy to set a budget before the leadership team meets.',
          'Build a simple run of show with start times, speakers or leaders, breaks, and an end time. Assign one point person for the day so volunteers, speakers, and the venue all have a single contact.',
          `Include the full address, ${ADDRESS}, on every flyer, email, and registration page.`,
        ],
      },
      {
        heading: 'What to ask before booking a church conference',
        body: [
          'Some answers are settled up front. Anyone can book, on-site parking is included, and catering is not included, so your team plans the food or brings in a caterer. If you have speakers or presentations, ask us about sound, microphones, and screens.',
          'Ask whether tables and chairs are provided for your format, when you can set up and clean up, and what time your event needs to end. Clear answers up front make the rest of the planning easier.',
        ],
      },
      {
        heading: 'Reserving a date for your church or community event',
        body: [
          `Pick your date on the live availability calendar and choose the space that fits your group. Send a request with the event type and a rough headcount, which takes about two minutes. ${RESERVE} After that, you can start sharing the date with your leaders, speakers, and volunteers.`,
          `Rates depend on the day, the space, and how many hours you need.${NONPROFIT_RATE} If several leaders are involved, choose one person to handle the booking so nothing gets lost between meetings. Questions? Call ${PHONE}.`,
        ],
      },
    ],
    checklist: {
      heading: 'Church and community event checklist',
      items: [
        'Write one sentence that explains the purpose of the event and who it is for.',
        'Set a date, a rough headcount, and a budget, using the instant estimate on the pricing page.',
        `Choose a space: up to ${INDOOR} guests indoors or up to ${OUTDOOR} outdoors.`,
        'Draft a run of show with start times, breaks, and a firm end time.',
        'Ask us about sound, microphones, and screens if you have speakers or presentations.',
        'Ask whether tables and chairs are provided, and when you can set up.',
        'Plan food and coffee, since catering is not included.',
        'Recruit volunteers for check-in and greeting, and name one point person for the day.',
      ],
    },
    faqs: [
      {
        q: 'Which church is The Venue at NCC part of?',
        a: `The Venue at NCC is the event space of ${CHURCH}, founded in ${FOUNDED} by ${FOUNDER}, who serves as its pastor. You can learn more about the church at ${CHURCH_SITE}.`,
      },
      {
        q: 'Can other churches and community groups book the venue?',
        a: `Yes. Anyone can book The Venue at NCC, including other churches, ministries, schools, and neighborhood groups. Membership at ${CHURCH} is not required.`,
      },
      {
        q: 'Does the venue have sound and screens for a conference?',
        a: `Ask us. Tell us what your speakers and sessions need in your request or call ${PHONE}, and we will talk it through before your date is confirmed.`,
      },
      {
        q: 'Should we require registration for a church conference?',
        a: 'Registration helps with name tags, materials, and meal counts for a conference, and a simple online form is usually enough. For a fellowship event or youth night, an RSVP or a parent sign-up may be all you need.',
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
